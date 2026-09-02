#!/usr/bin/env node
/**
 * 生图调 prompt 的本地网页：node scripts/gen-image-server.mjs（或双击根目录 gen-image.bat）。
 * 起在 http://127.0.0.1:3939，自动开浏览器；页面在 gen-image-ui.html（改完刷新即生效）。
 * 只绑 127.0.0.1——key 在本机，不对外。
 *
 * 接口：
 *   GET  /                → 页面
 *   GET  /api/config      → { model, size, hasKey, limits, presets: { style, portrait } }
 *   GET  /api/history     → scripts/out 里的历史（最新在前，含当时 system/user/参数）
 *   POST /api/generate    → { system, user, order, negative, size, model, n, seed, steps, guidance, promptExtend }
 *                         → { base, images, prompt, params, elapsed }
 *   GET  /out/<file>      → 生成的图片
 */

import { execFile } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_OUT,
  DEFAULT_SIZE,
  DEFAULT_SYSTEM,
  LIMITS,
  MODELS,
  QianfanError,
  STYLES,
  apiKey,
  composePrompt,
  defaultModel,
  generate,
  history,
  modelForStyle,
  preset,
  styleById,
} from './gen-image-core.mjs';

const PORT = Number(process.env.PORT || process.argv[2]) || 3939;
const HOST = '127.0.0.1';
const UI = resolve(fileURLToPath(import.meta.url), '../gen-image-ui.html');

const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8' };

function json(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (s += c));
    req.on('end', () => ok(s));
    req.on('error', fail);
  });
}

function sendFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('not found');
  }
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      // 每次都重读，改页面刷新即生效
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
      return res.end(readFileSync(UI, 'utf8'));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, {
        model: defaultModel(),
        size: DEFAULT_SIZE,
        hasKey: Boolean(apiKey()),
        outDir: DEFAULT_OUT,
        limits: LIMITS,
        models: MODELS,
        styles: STYLES,
        defaultSystem: DEFAULT_SYSTEM,
        presets: { style: preset('style'), portrait: preset('portrait') },
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/history') {
      return json(res, 200, history().map((h) => ({ ...h, images: h.images.map((n) => `/out/${n}`) })));
    }
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      let b;
      try {
        b = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return json(res, 400, { error: '请求体不是 JSON' });
      }
      // 画风行 → user → system（D-075）；system 不传 = 默认文案；画风决定默认模型，显式传 model 可覆盖
      const style = styleById(b.style) ? b.style : 'none';
      const styleLine = b.styleLine != null ? String(b.styleLine).trim() : styleById(style)?.line ?? '';
      const user = String(b.user ?? '').trim();
      const system = b.system != null ? String(b.system).trim() : DEFAULT_SYSTEM;
      const prompt = composePrompt({ styleLine, user, system });
      if (!prompt) return json(res, 400, { error: '画风 / user / system 都是空的' });
      const model = String(b.model || modelForStyle(style) || defaultModel()).trim();
      const size = String(b.size || DEFAULT_SIZE).trim();
      const n = Math.min(4, Math.max(1, Number(b.n) || 1));
      const opts = {
        prompt,
        model,
        size,
        n,
        negative: b.negative,
        seed: num(b.seed),
        steps: num(b.steps),
        guidance: num(b.guidance),
        promptExtend: typeof b.promptExtend === 'boolean' ? b.promptExtend : undefined,
        meta: { style, styleLine, user, system },
      };
      console.log(`[gen] ${new Date().toLocaleTimeString()} model=${model} size=${size} n=${n} prompt=${prompt.length}字\n${prompt}\n`);
      const r = await generate(opts);
      console.log(`[gen] 完成 ${r.elapsed.toFixed(1)}s → ${r.files.map((f) => basename(f)).join(', ')}`);
      return json(res, 200, { ...r, images: r.files.map((f) => `/out/${basename(f)}`), files: undefined });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/out/')) {
      const name = basename(decodeURIComponent(url.pathname.slice(5)));
      if (!/^[\w.-]+$/.test(name)) {
        res.writeHead(400);
        return res.end('bad name');
      }
      return sendFile(res, resolve(DEFAULT_OUT, name));
    }
    res.writeHead(404);
    res.end('not found');
  } catch (e) {
    console.error('[gen] 失败：', e?.message || e, e?.body ? `\n${e.body}` : '');
    if (e instanceof QianfanError) return json(res, 502, { error: e.message, detail: e.body });
    json(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  const addr = `http://${HOST}:${PORT}`;
  console.log(`生图调 prompt：${addr}`);
  console.log(`图片落在 ${DEFAULT_OUT}`);
  if (!apiKey()) console.log('⚠ 没找到千帆 key：.env.local 里填 EXPO_PUBLIC_QIANFAN_API_KEY');
  console.log('Ctrl+C 结束');
  if (!process.env.NO_OPEN) {
    const [cmd, args] =
      process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', addr]]
        : process.platform === 'darwin'
          ? ['open', [addr]]
          : ['xdg-open', [addr]];
    execFile(cmd, args, () => {});
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 被占用（可能上一个还开着）。换端口：node scripts/gen-image-server.mjs 3940`);
    process.exit(1);
  }
  throw e;
});

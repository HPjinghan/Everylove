/**
 * 生图调 prompt 工具的共用核心（CLI gen-image.mjs 与本地网页 gen-image-server.mjs 都用它）。
 * 与工程 lib/imagegen.ts 完全同一条 API：POST /v2/images/generations，同 model / size / n，
 * 返回的 http BOS 地址换 https 下载落盘（图片 URL 24 小时过期）。
 * key 读 .env.local 的 EXPO_PUBLIC_QIANFAN_API_KEY（环境变量 QIANFAN_API_KEY 可覆盖）。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENDPOINT = 'https://qianfan.baidubce.com/v2/images/generations';
export const DEFAULT_OUT = resolve(ROOT, 'scripts/out');
export const DEFAULT_SIZE = '1024x1024';

/* ─────────────── .env.local ─────────────── */

export function loadEnvLocal() {
  const p = resolve(ROOT, '.env.local');
  if (!existsSync(p)) return {};
  const env = {};
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    env[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnvLocal();

export function apiKey() {
  return (
    process.env.QIANFAN_API_KEY ||
    process.env.EXPO_PUBLIC_QIANFAN_API_KEY ||
    env.EXPO_PUBLIC_QIANFAN_API_KEY ||
    ''
  );
}

export function defaultModel() {
  return process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || 'qwen-image';
}

/* ─────────────── 工程画风尾巴（实时读 content/prompts.ts，D-017 单一来源） ─────────────── */

export function promptConst(name) {
  const src = readFileSync(resolve(ROOT, 'content/prompts.ts'), 'utf8');
  const m = src.match(new RegExp(`export const ${name} =\\s*([\\s\\S]*?);\\s*\\n`));
  if (!m) throw new Error(`content/prompts.ts 里找不到 ${name}`);
  // 这些常量只是若干字符串字面量用 + 连接，直接求值即可
  return new Function(`return (${m[1]})`)();
}

/** tail: 'none' | 'style' | 'portrait' */
export function styleTail(tail) {
  const parts = [];
  if (tail === 'portrait') parts.push(promptConst('PORTRAIT_COMPOSITION'));
  if (tail === 'portrait' || tail === 'style') {
    parts.push(promptConst('COMIC_STYLE'), promptConst('COMIC_QUALITY'), promptConst('COMIC_RULES'));
  }
  return parts;
}

export function composePrompt(body, tail) {
  return [body.trim(), ...styleTail(tail)].join('\n');
}

/* ─────────────── 生成 ─────────────── */

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export class QianfanError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * 调千帆出图并落盘。返回 { base, files, prompt, params, elapsed }。
 * files 是绝对路径；旁边同名 .txt 记录参数与完整 prompt（历史回看用）。
 */
export async function generate({ prompt, model = defaultModel(), size = DEFAULT_SIZE, n = 1, outDir = DEFAULT_OUT }) {
  const key = apiKey();
  if (!key) throw new QianfanError('缺 key：.env.local 里填 EXPO_PUBLIC_QIANFAN_API_KEY，或环境变量 QIANFAN_API_KEY', 0);
  const params = { model, size, n };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...params, prompt }),
  });
  const text = await res.text();
  if (!res.ok) throw new QianfanError(`千帆返回 ${res.status}`, res.status, text);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new QianfanError('响应不是 JSON', res.status, text);
  }
  const urls = (data.data ?? []).map((d) => d.url).filter(Boolean);
  if (!urls.length) throw new QianfanError('响应里没有图片 url', res.status, text);

  mkdirSync(outDir, { recursive: true });
  const base = stamp();
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].replace(/^http:/, 'https:');
    const img = await fetch(url);
    if (!img.ok) throw new QianfanError(`下载失败 ${img.status}`, img.status, url);
    const file = resolve(outDir, `${base}${urls.length > 1 ? `-${i + 1}` : ''}.jpg`);
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    files.push(file);
  }
  writeFileSync(resolve(outDir, `${base}.txt`), `${JSON.stringify(params, null, 2)}\n\n${prompt}\n`);
  return { base, files, prompt, params, elapsed: (Date.now() - t0) / 1000 };
}

/* ─────────────── 历史（读 scripts/out 里的 .txt + .jpg） ─────────────── */

/** 按 base 分组，最新在前：[{ base, images: ['xxx.jpg'], prompt, params, time }] */
export function history(outDir = DEFAULT_OUT) {
  if (!existsSync(outDir)) return [];
  const names = readdirSync(outDir);
  const groups = new Map();
  for (const name of names) {
    const m = name.match(/^(\d{8}-\d{6})(?:-\d+)?\.(jpg|txt)$/);
    if (!m) continue;
    const g = groups.get(m[1]) ?? { base: m[1], images: [], prompt: '', params: {} };
    if (m[2] === 'jpg') g.images.push(name);
    else {
      const raw = readFileSync(resolve(outDir, name), 'utf8');
      const sep = raw.indexOf('\n\n');
      try {
        g.params = JSON.parse(sep >= 0 ? raw.slice(0, sep) : raw);
      } catch {
        g.params = {};
      }
      g.prompt = sep >= 0 ? raw.slice(sep + 2).trim() : '';
    }
    groups.set(m[1], g);
  }
  return [...groups.values()]
    .filter((g) => g.images.length)
    .map((g) => ({ ...g, images: g.images.sort(), time: baseToTime(g.base) }))
    .sort((a, b) => (a.base < b.base ? 1 : -1));
}

function baseToTime(base) {
  const [d, t] = base.split('-');
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
}

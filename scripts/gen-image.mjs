#!/usr/bin/env node
/**
 * 调 prompt 用的小脚本：输入文字 → 千帆文生图 → 图片落到 scripts/out/。
 * 与工程 lib/imagegen.ts 完全同一条 API（POST /v2/images/generations，同 model / size / n），
 * key 读 .env.local 的 EXPO_PUBLIC_QIANFAN_API_KEY（或环境变量 QIANFAN_API_KEY 覆盖）。
 *
 * 用法：
 *   node scripts/gen-image.mjs "一句 prompt"
 *   node scripts/gen-image.mjs -f prompt.txt            # 从文件读（多行 / 中文最稳）
 *   echo "prompt" | node scripts/gen-image.mjs          # 从 stdin 读
 *   npm run gen-image -- "prompt" --style --open
 *
 * 选项：
 *   --style      追加工程当前的画风尾巴（COMIC_STYLE + COMIC_QUALITY + COMIC_RULES，实时读 content/prompts.ts）
 *   --portrait   追加立绘尾巴（PORTRAIT_COMPOSITION + 上面三条），等于 buildPortraitPrompt 的后半段
 *   --size WxH   默认 1024x1024（与工程一致）
 *   --model ID   默认 .env.local 的 EXPO_PUBLIC_QIANFAN_IMAGE_MODEL，再默认 qwen-image
 *   --n N        出几张（默认 1）
 *   --out DIR    输出目录（默认 scripts/out）
 *   --open       生成后用系统看图器打开
 *   --dry        只打印最终 prompt 与请求体，不真的调 API
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://qianfan.baidubce.com/v2/images/generations';

/* ─────────────── 参数 ─────────────── */

const argv = process.argv.slice(2);
const opts = {
  style: false,
  portrait: false,
  open: false,
  dry: false,
  size: '1024x1024',
  n: 1,
  out: 'scripts/out',
  model: undefined,
};
const promptParts = [];
let promptFile;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '-h' || a === '--help') {
    help();
    process.exit(0);
  } else if (a === '-f' || a === '--file') promptFile = next();
  else if (a === '--style') opts.style = true;
  else if (a === '--portrait') opts.portrait = true;
  else if (a === '--open') opts.open = true;
  else if (a === '--dry') opts.dry = true;
  else if (a === '--size') opts.size = next();
  else if (a === '--model') opts.model = next();
  else if (a === '--n') opts.n = Number(next()) || 1;
  else if (a === '--out') opts.out = next();
  else if (a.startsWith('--')) {
    console.error(`未知选项 ${a}`);
    help();
    process.exit(2);
  } else promptParts.push(a);
}

function help() {
  // 把文件头的注释块直接当帮助打出来
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.split('*/')[0].replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
}

/* ─────────────── .env.local ─────────────── */

function loadEnvLocal() {
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
const apiKey =
  process.env.QIANFAN_API_KEY ||
  process.env.EXPO_PUBLIC_QIANFAN_API_KEY ||
  env.EXPO_PUBLIC_QIANFAN_API_KEY;
const model =
  opts.model ||
  process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL ||
  env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL ||
  'qwen-image';

/* ─────────────── 工程画风尾巴（实时读 content/prompts.ts） ─────────────── */

function promptConst(name) {
  const src = readFileSync(resolve(ROOT, 'content/prompts.ts'), 'utf8');
  const m = src.match(new RegExp(`export const ${name} =\\s*([\\s\\S]*?);\\s*\\n`));
  if (!m) throw new Error(`content/prompts.ts 里找不到 ${name}`);
  // 这些常量只是若干字符串字面量用 + 连接，直接求值即可
  return new Function(`return (${m[1]})`)();
}

function styleTail() {
  const parts = [];
  if (opts.portrait) parts.push(promptConst('PORTRAIT_COMPOSITION'));
  if (opts.portrait || opts.style) {
    parts.push(promptConst('COMIC_STYLE'), promptConst('COMIC_QUALITY'), promptConst('COMIC_RULES'));
  }
  return parts;
}

/* ─────────────── 主流程 ─────────────── */

async function readPrompt() {
  if (promptFile) return readFileSync(resolve(promptFile), 'utf8').trim();
  if (promptParts.length) return promptParts.join(' ').trim();
  if (!process.stdin.isTTY) {
    let s = '';
    for await (const chunk of process.stdin) s += chunk;
    return s.trim();
  }
  return '';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function openFile(path) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', path]]
      : process.platform === 'darwin'
        ? ['open', [path]]
        : ['xdg-open', [path]];
  execFile(cmd, args, () => {});
}

async function main() {
  const body = await readPrompt();
  if (!body) {
    console.error('没有 prompt。用法见 --help');
    process.exit(2);
  }
  const prompt = [body, ...styleTail()].join('\n');

  const req = { model, prompt, size: opts.size, n: opts.n };
  console.log('── prompt ──────────────────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────');
  console.log(`model=${model} size=${opts.size} n=${opts.n}`);
  if (opts.dry) {
    console.log(JSON.stringify(req, null, 2));
    return;
  }

  if (!apiKey) {
    console.error('缺 key：.env.local 里填 EXPO_PUBLIC_QIANFAN_API_KEY，或环境变量 QIANFAN_API_KEY');
    process.exit(1);
  }

  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(req),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`千帆返回 ${res.status}：\n${text}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`响应不是 JSON：\n${text}`);
    process.exit(1);
  }
  const urls = (data.data ?? []).map((d) => d.url).filter(Boolean);
  if (!urls.length) {
    console.error(`响应里没有图片 url：\n${text}`);
    process.exit(1);
  }

  const outDir = resolve(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const base = stamp();
  const saved = [];
  for (let i = 0; i < urls.length; i++) {
    // 千帆给的是 http 的 BOS 地址（工程里同样换成 https 再下），24 小时过期，必须落盘
    const url = urls[i].replace(/^http:/, 'https:');
    const img = await fetch(url);
    if (!img.ok) {
      console.error(`下载失败 ${img.status}：${url}`);
      continue;
    }
    const file = resolve(outDir, `${base}${urls.length > 1 ? `-${i + 1}` : ''}.jpg`);
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    saved.push(file);
  }
  // 旁边留一份用过的 prompt，回头好对照是哪版 prompt 出的图
  writeFileSync(
    resolve(outDir, `${base}.txt`),
    `${JSON.stringify({ model, size: opts.size, n: opts.n }, null, 2)}\n\n${prompt}\n`
  );

  console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const f of saved) console.log(`→ ${f}`);
  if (opts.open) saved.forEach(openFile);
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});

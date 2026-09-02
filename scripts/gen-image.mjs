#!/usr/bin/env node
/**
 * 调 prompt 用的命令行：输入文字 → 千帆文生图 → 图片落到 scripts/out/。
 * 与工程 lib/imagegen.ts 完全同一条 API（核心在 gen-image-core.mjs；网页版见 gen-image-server.mjs / 根目录 gen-image.bat）。
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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_OUT, DEFAULT_SIZE, ROOT, composePrompt, defaultModel, generate } from './gen-image-core.mjs';

/* ─────────────── 参数 ─────────────── */

const argv = process.argv.slice(2);
const opts = { tail: 'none', open: false, dry: false, size: DEFAULT_SIZE, n: 1, out: DEFAULT_OUT, model: undefined };
const promptParts = [];
let promptFile;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '-h' || a === '--help') {
    help();
    process.exit(0);
  } else if (a === '-f' || a === '--file') promptFile = next();
  else if (a === '--style') opts.tail = 'style';
  else if (a === '--portrait') opts.tail = 'portrait';
  else if (a === '--open') opts.open = true;
  else if (a === '--dry') opts.dry = true;
  else if (a === '--size') opts.size = next();
  else if (a === '--model') opts.model = next();
  else if (a === '--n') opts.n = Number(next()) || 1;
  else if (a === '--out') opts.out = resolve(ROOT, next());
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
  const prompt = composePrompt(body, opts.tail);
  const model = opts.model || defaultModel();

  console.log('── prompt ──────────────────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────');
  console.log(`model=${model} size=${opts.size} n=${opts.n}`);
  if (opts.dry) {
    console.log(JSON.stringify({ model, prompt, size: opts.size, n: opts.n }, null, 2));
    return;
  }

  const r = await generate({ prompt, model, size: opts.size, n: opts.n, outDir: opts.out });
  console.log(`耗时 ${r.elapsed.toFixed(1)}s`);
  for (const f of r.files) console.log(`→ ${f}`);
  if (opts.open) r.files.forEach(openFile);
}

main().catch((e) => {
  console.error(e?.message || e);
  if (e?.body) console.error(e.body);
  process.exit(1);
});

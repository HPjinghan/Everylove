#!/usr/bin/env node
/**
 * 调 prompt 用的命令行：画风行 → user → system → 千帆文生图 → 图片落到 scripts/out/。
 * 与工程 lib/imagegen.ts 同一条 API（核心在 gen-image-core.mjs；网页版见 gen-image-server.mjs / 根目录 gen-image.bat）。
 *
 * 用法（位置参数 / -f / stdin 都是 user 部分）：
 *   node scripts/gen-image.mjs --art anime "这一张画什么"        # 动漫 → 自动走蒸汽机
 *   node scripts/gen-image.mjs --art shojo -f user.txt           # 其余画风 → qwen-image
 *   echo "prompt" | node scripts/gen-image.mjs --art korean --open
 *   node scripts/gen-image.mjs --list                            # 列出画风 ID
 *
 * 画风（prompt 第一行）：
 *   --art ID             anime / shojo / korean / painterly / ink / realistic / lineart / none（默认 none）
 *   --art-line TEXT      用这句替换该画风的第一行
 *
 * system（放最后；默认 = 工程约定的收尾文案 DEFAULT_SYSTEM）：
 *   --system TEXT        直接给（给空串 = 不带 system）
 *   --system-file FILE   从文件读
 *   --style / --portrait 用工程 content/prompts.ts 当前常量（画风三条 / 立绘构图+画风三条）
 *
 * 其他：
 *   --model ID           覆盖画风自动选的模型
 *   --negative TEXT      反向提示词（≤500 字符；蒸汽机不支持）
 *   --seed N             固定种子（比较两版 prompt 时用）
 *   --steps N            采样步数 1-50（蒸汽机不支持）
 *   --guidance X         0-20，默认 4（蒸汽机不支持）
 *   --no-extend          关掉平台的 prompt 改写（prompt_extend=false，所写即所画）
 *   --size WxH           默认 1024x1024（与工程一致）
 *   --n N                张数（qwen-image 只支持 1）
 *   --out DIR            输出目录（默认 scripts/out）
 *   --open               生成后用系统看图器打开
 *   --dry                只打印最终请求体，不真的调 API
 */

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_OUT,
  DEFAULT_SIZE,
  DEFAULT_SYSTEM,
  ROOT,
  STYLES,
  buildBody,
  composePrompt,
  generate,
  modelForStyle,
  preset,
  styleById,
} from './gen-image-core.mjs';

/* ─────────────── 参数 ─────────────── */

const argv = process.argv.slice(2);
const o = { art: 'none', artLine: undefined, system: DEFAULT_SYSTEM, open: false, dry: false, size: DEFAULT_SIZE, n: 1, out: DEFAULT_OUT };
const userParts = [];
let userFile;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '-h' || a === '--help') {
    help();
    process.exit(0);
  } else if (a === '--list') {
    for (const s of STYLES) console.log(`${s.id.padEnd(10)} ${s.label.padEnd(16)} → ${s.model}${s.line ? `\n${''.padEnd(11)}${s.line}` : ''}`);
    process.exit(0);
  } else if (a === '-f' || a === '--file') userFile = next();
  else if (a === '--art') o.art = next();
  else if (a === '--art-line') o.artLine = next();
  else if (a === '--system') o.system = next();
  else if (a === '--system-file') o.system = readFileSync(resolve(next()), 'utf8');
  else if (a === '--style') o.system = preset('style');
  else if (a === '--portrait') o.system = preset('portrait');
  else if (a === '--negative') o.negative = next();
  else if (a === '--seed') o.seed = Number(next());
  else if (a === '--steps') o.steps = Number(next());
  else if (a === '--guidance') o.guidance = Number(next());
  else if (a === '--no-extend') o.promptExtend = false;
  else if (a === '--open') o.open = true;
  else if (a === '--dry') o.dry = true;
  else if (a === '--size') o.size = next();
  else if (a === '--model') o.model = next();
  else if (a === '--n') o.n = Number(next()) || 1;
  else if (a === '--out') o.out = resolve(ROOT, next());
  else if (a.startsWith('--')) {
    console.error(`未知选项 ${a}`);
    help();
    process.exit(2);
  } else userParts.push(a);
}

function help() {
  // 把文件头的注释块直接当帮助打出来
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(src.split('*/')[0].replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
}

/* ─────────────── 主流程 ─────────────── */

async function readUser() {
  if (userFile) return readFileSync(resolve(userFile), 'utf8').trim();
  if (userParts.length) return userParts.join(' ').trim();
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
  const st = styleById(o.art);
  if (!st) {
    console.error(`未知画风 ${o.art}，可用：${STYLES.map((s) => s.id).join(' / ')}`);
    process.exit(2);
  }
  const styleLine = o.artLine != null ? o.artLine : st.line;
  const user = await readUser();
  const system = String(o.system ?? '').trim();
  const prompt = composePrompt({ styleLine, user, system });
  if (!prompt) {
    console.error('画风 / user / system 都是空的。用法见 --help');
    process.exit(2);
  }
  const model = o.model || modelForStyle(st.id);
  const opts = {
    prompt,
    model,
    size: o.size,
    n: o.n,
    negative: o.negative,
    seed: o.seed,
    steps: o.steps,
    guidance: o.guidance,
    promptExtend: o.promptExtend,
  };
  const body = buildBody(opts);

  console.log('── prompt ──────────────────────────────');
  console.log(prompt);
  console.log('────────────────────────────────────────');
  const { prompt: _p, ...rest } = body;
  console.log(`画风=${st.id} ${Object.entries(rest).map(([k, v]) => `${k}=${v}`).join(' ')} prompt=${prompt.length}字`);
  if (o.dry) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const r = await generate({ ...opts, outDir: o.out, meta: { style: st.id, styleLine, user, system } });
  console.log(`耗时 ${r.elapsed.toFixed(1)}s`);
  for (const f of r.files) console.log(`→ ${f}`);
  if (o.open) r.files.forEach(openFile);
}

main().catch((e) => {
  console.error(e?.message || e);
  if (e?.body) console.error(e.body);
  process.exit(1);
});

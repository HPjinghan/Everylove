/**
 * 生图调 prompt 工具的共用核心（CLI gen-image.mjs 与本地网页 gen-image-server.mjs 都用它）。
 * 与工程 lib/imagegen.ts 完全同一条 API：POST /v2/images/generations，同 model / size / n，
 * 返回的 http BOS 地址换 https 下载落盘（图片 URL 24 小时过期）。
 * key 读 .env.local 的 EXPO_PUBLIC_QIANFAN_API_KEY（环境变量 QIANFAN_API_KEY 可覆盖）。
 *
 * 接口没有 system 字段——只有一条 prompt（qwen-image ≤800 字符）+ negative_prompt（≤500）。
 * 「system / user」是本工具的结构：两段各写各的，发出前拼成一条（composePrompt）。
 * 千帆文档（qwen-image）：n 只支持 1；size 512x512～2048x2048；seed / steps(1-50) / guidance(0-20，默认 4)；
 * prompt_extend 默认 true（平台先改写 prompt 再画）。不传即平台默认 = 与工程一致。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENDPOINT = 'https://qianfan.baidubce.com/v2/images/generations';
/** 百度蒸汽机 Air-Image 走专用端点（通用端点接受请求但不回，2026-09-02 实测） */
export const MUSE_ENDPOINT = 'https://qianfan.baidubce.com/v2/musesteamer/images/generations';
export const DEFAULT_OUT = resolve(ROOT, 'scripts/out');
export const DEFAULT_SIZE = '1024x1024';
export const LIMITS = { prompt: 800, negative: 500 };

/**
 * 千帆上目前能打通的文生图模型（2026-09-02 实测；ernie-image-turbo 本账号 invalid_model，flux.1-schnell 已 offline，
 * qwen-image-2.0/3.0 千帆未上）。params = 该模型接受的可选参数，其余不发。
 */
export const MODELS = {
  'qwen-image': {
    label: 'Qwen Image（工程当前）',
    price: '0.25 元/张',
    promptMax: 800,
    params: ['negative', 'seed', 'steps', 'guidance', 'prompt_extend'],
    note: '约 60s/张；中英皆可；n 只支持 1',
  },
  'musesteamer-air-image': {
    label: '蒸汽机 Air-Image（百度）',
    price: '0.05 元/张',
    promptMax: 1000,
    params: ['seed', 'prompt_extend'],
    note: '约 8s/张；不支持 negative / steps / guidance / n',
  },
};

export function modelInfo(model) {
  return MODELS[model];
}
export function endpointFor(model) {
  return /^musesteamer/i.test(model) ? MUSE_ENDPOINT : ENDPOINT;
}
export function promptLimit(model) {
  return modelInfo(model)?.promptMax ?? LIMITS.prompt;
}

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

/* ─────────────── 工程画风常量（实时读 content/prompts.ts，D-017 单一来源） ─────────────── */

export function promptConst(name) {
  const src = readFileSync(resolve(ROOT, 'content/prompts.ts'), 'utf8');
  const m = src.match(new RegExp(`export const ${name} =\\s*([\\s\\S]*?);\\s*\\n`));
  if (!m) throw new Error(`content/prompts.ts 里找不到 ${name}`);
  // 这些常量只是若干字符串字面量用 + 连接，直接求值即可
  return new Function(`return (${m[1]})`)();
}

/** 可载入 system 框的预设：'style' = 画风三条；'portrait' = 立绘构图 + 画风三条（buildPortraitPrompt 的后半段） */
export function preset(name) {
  const parts = [];
  if (name === 'portrait') parts.push(promptConst('PORTRAIT_COMPOSITION'));
  if (name === 'portrait' || name === 'style') {
    parts.push(promptConst('COMIC_STYLE'), promptConst('COMIC_QUALITY'), promptConst('COMIC_RULES'));
  }
  return parts.join('\n');
}

/**
 * system + user 拼成一条 prompt。order: 'system-first'（默认）| 'user-first'
 * （工程 buildPortraitPrompt 是主体在前、画风在后，即 user-first）
 */
export function composePrompt({ system = '', user = '', order = 'system-first' }) {
  const s = String(system).trim();
  const u = String(user).trim();
  if (!s) return u;
  if (!u) return s;
  return order === 'user-first' ? `${u}\n\n${s}` : `${s}\n\n${u}`;
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

/** 请求体：只带用户真的填了的字段，其余交给平台默认（= 工程行为） */
export function buildBody({ prompt, model = defaultModel(), size = DEFAULT_SIZE, n = 1, negative, seed, steps, guidance, promptExtend }) {
  const info = modelInfo(model);
  const ok = (p) => !info || info.params.includes(p);
  const body = { model, prompt, size };
  // 蒸汽机的文档没有 n；未知模型按通用接口带上
  if (!/^musesteamer/i.test(model)) body.n = n;
  if (ok('negative') && negative && String(negative).trim()) body.negative_prompt = String(negative).trim();
  if (ok('seed') && Number.isFinite(seed)) body.seed = Math.floor(seed);
  if (ok('steps') && Number.isFinite(steps)) body.steps = Math.floor(steps);
  if (ok('guidance') && Number.isFinite(guidance)) body.guidance = guidance;
  if (ok('prompt_extend') && typeof promptExtend === 'boolean') body.prompt_extend = promptExtend;
  return body;
}

/**
 * 调千帆出图并落盘。返回 { base, files, prompt, params, elapsed }。
 * files 是绝对路径；旁边同名 .txt = 参数 JSON（含 meta，如 system/user/order）+ 空行 + 完整 prompt（历史回看用）。
 */
export async function generate({ outDir = DEFAULT_OUT, meta = {}, ...opts }) {
  const key = apiKey();
  if (!key) throw new QianfanError('缺 key：.env.local 里填 EXPO_PUBLIC_QIANFAN_API_KEY，或环境变量 QIANFAN_API_KEY', 0);
  const body = buildBody(opts);
  const { prompt, ...rest } = body;
  const params = { ...rest, ...meta };
  const t0 = Date.now();
  const res = await fetch(endpointFor(body.model), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
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

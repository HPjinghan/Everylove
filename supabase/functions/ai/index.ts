/**
 * AI 服务端代理（D-057 / D-166）：唯一的自有服务端组件。
 * 职责：LLM / 生图 / 语音的 API key 收在服务端（Supabase Secrets），客户端只带登录态调用；
 *      按用户限每日次数（`ai_usage` 表，防盗刷）；每个 service 只放行已知字段、模型只认白名单、长度与 token 封顶。
 *
 * 客户端协议：POST { service, body, billing?, tz? }，service ∈
 *   qianfan.chat / qianfan.images / qianfan.musesteamer / anthropic.messages（JSON；Claude 经 LLM Gateway，D-216。Secrets：LLMGATEWAY_API_KEY）
 *   baidu.asr / baidu.asr_pro（百度语音识别，JSON；D-073）
 *   baidu.tts（百度短文本语音合成 tsn.baidu.com/text2audio，body 为表单字段对象；D-073）
 *   asr.transcribe（Whisper 协议识别，日 / 韩用；D-139。Secrets：ASR_BASE_URL / ASR_API_KEY / ASR_MODEL；没配返回 503「asr not configured」，客户端回落百度）
 *   fish.tts（Fish Audio 合成 api.fish.audio/v1/tts；D-139。Secrets：FISH_API_KEY / FISH_MODEL；没配返回 503「fish not configured」，客户端回落百度）
 *   fish.tts.stream（同上，但边合成边回：24 kHz 16 bit 单声道 PCM 原样流回，打电话用；D-232）
 *   fish.asr（Fish transcribe-1 识别 api.fish.audio/v1/asr，multipart 字段 audio；同一把 FISH_API_KEY；D-139）
 * 返回：上游成功 → JSON 原样透传（二进制音频包成 { audio_base64 }）；上游失败 → { error: 'upstream', status, message }（只带上游的一句话，不带原文）；
 *      本函数出错 → { error: 'internal' }（细节只进函数日志）。
 *
 * 限流（D-166）：`increment_ai_usage(p_user, p_day, p_limit)` 是 security definer 的原子自增（insert … on conflict … where count < limit），
 * 用 service role 调（客户端对 ai_usage 表没有任何权限，改不了自己的计数）；匿名游客与真账号各一档：AI_GUEST_DAILY_LIMIT（默认 100）/ AI_DAILY_LIMIT（默认 500）。
 * 白名单（D-166）：模型只认 ANTHROPIC_MODELS / QIANFAN_CHAT_MODELS / QIANFAN_IMAGE_MODELS（逗号分隔，Secrets 可改，默认 = 客户端 core/config.ts 的默认值）；
 * max_tokens 封顶 AI_MAX_TOKENS（默认 8192）；生图 n 固定 1、size 只认 1024x1024；合成文本 ≤ 1000 字；识别音频 base64 ≤ 8 MB；请求体 ≤ 4 MB。
 * 记账（D-217）：余额只在服务器（public.wallets，supabase/wallet.sql）。每次生成前按 billing（user 她发起的 / house 平台出的 / included 通话里的；
 * 不写 = house，老包只受后台保险丝管）问 gateReason，不够回 402 { error: 'blocked', reason }；上游成功后按真实用量 wallet_charge，
 * 最新钱包放在响应头 x-wallet（WalletView JSON）。数值与算法在 _shared/economy.ts（客户端同一份）。
 *   wallet.get（可带一次性 import）/ wallet.call（通话计时，服务器时钟）/ wallet.sim（收费开关 BILLING_LIVE 打开前：订阅 / 流量包 / 分钟包 / GM 点即到账）
 * 建表与函数：docs/supabase-setup.sql、supabase/wallet.sql。部署：supabase functions deploy ai（verify_jwt 开启——平台先验 JWT，函数内再取 user 限流）。
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import {
  callAlive,
  estimateSpeechSeconds,
  costTokens,
  estimateTokens,
  gateReason,
  imageModelOf,
  slowLaneOf,
  mbFor,
  sqlEconomy,
  TRAFFIC_PACKS,
  VOICE_PACKS,
  walletView,
  type Billing,
  type MeterKind,
  type WalletRow,
  type WalletView,
} from '../_shared/economy.ts';

const QIANFAN_KEY = Deno.env.get('QIANFAN_API_KEY') ?? '';
/** Claude 统一走 LLM Gateway（D-216）：服务名仍叫 anthropic.messages（老包照旧能用），上游换成它的 Anthropic 兼容接口，不直连 Anthropic */
const LLMGATEWAY_KEY = Deno.env.get('LLMGATEWAY_API_KEY') ?? '';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '500');
const GUEST_DAILY_LIMIT = Number(Deno.env.get('AI_GUEST_DAILY_LIMIT') ?? '100');
const MAX_TOKENS_CAP = Number(Deno.env.get('AI_MAX_TOKENS') ?? '8192');
/** 真收费开关（D-217）：打开后订阅 / 流量包 / 分钟包只能经 RevenueCat 入账，wallet.sim 拒绝 */
const BILLING_LIVE = Deno.env.get('BILLING_LIVE') === '1';

const list = (name: string, fallback: string) =>
  (Deno.env.get(name) ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
/** 模型白名单：默认与客户端 core/config.ts 的默认值一致；换模型两边一起改 */
const ANTHROPIC_MODELS = list('ANTHROPIC_MODELS', 'claude-haiku-5-5,claude-sonnet-5-5,claude-sonnet-5,claude-opus-5');
const QIANFAN_CHAT_MODELS = list('QIANFAN_CHAT_MODELS', 'deepseek-v4-pro,qwen3.5-397b-a17b');
const QIANFAN_IMAGE_MODELS = list('QIANFAN_IMAGE_MODELS', 'qwen-image,musesteamer-air-image');

const BODY_MAX_BYTES = 4 * 1024 * 1024;
const AUDIO_B64_MAX = 8 * 1024 * 1024;
const TTS_TEXT_MAX = 1000;
/** 通话流式合成的采样率（D-232）：客户端按响应头 x-sample-rate 播 */
const TTS_STREAM_RATE = 24000;
const IMAGE_PROMPT_MAX = 2000;
const MESSAGES_MAX = 80;

const JSON_HEADERS = { 'content-type': 'application/json' };

/** Supabase Edge 的后台任务：响应发出去之后接着跑（记账） */
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function json(body: unknown, status = 200, wallet?: WalletView | null): Response {
  return new Response(JSON.stringify(body), { status, headers: wallet ? { ...JSON_HEADERS, 'x-wallet': JSON.stringify(wallet) } : JSON_HEADERS });
}

/** 客户端参数不合规：400 + 一句话（是客户端的 bug，不是用户的错） */
class BadRequest extends Error {}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, name: string): string => {
  if (typeof v !== 'string') throw new BadRequest(`${name} must be a string`);
  if (v.length > max) throw new BadRequest(`${name} too long`);
  return v;
};
const optStr = (v: unknown, max: number, name: string): string | undefined => (v === undefined || v === null || v === '' ? undefined : str(v, max, name));
const clampTokens = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.max(1, Math.min(MAX_TOKENS_CAP, n));
};
const oneOf = (v: unknown, allowed: string[], name: string): string => {
  if (typeof v !== 'string' || !allowed.includes(v)) throw new BadRequest(`${name} not allowed`);
  return v;
};
const messages = (v: unknown): unknown[] => {
  if (!Array.isArray(v) || v.length === 0) throw new BadRequest('messages must be a non-empty array');
  if (v.length > MESSAGES_MAX) throw new BadRequest('too many messages');
  for (const m of v) if (!isRec(m) || typeof m.role !== 'string') throw new BadRequest('bad message');
  return v;
};

/* ── 每个 service 只放行已知字段（D-166）── */

function anthropicBody(b: Rec): Rec {
  const out: Rec = {
    model: oneOf(b.model, ANTHROPIC_MODELS, 'model'),
    max_tokens: clampTokens(b.max_tokens, 1024),
    messages: messages(b.messages),
  };
  // system 可以是字符串，也可以是带 cache_control 的块数组（prompt 缓存）
  if (typeof b.system === 'string' || Array.isArray(b.system)) out.system = b.system;
  if (isRec(b.output_config)) out.output_config = { effort: oneOf(b.output_config.effort, ['low', 'medium', 'high'], 'effort') };
  if (isRec(b.thinking)) out.thinking = b.thinking;
  // 流式（D-232，通话边出字边合成）：SSE 原样流回
  if (b.stream === true) out.stream = true;
  if (typeof b.temperature === 'number') out.temperature = Math.max(0, Math.min(1, b.temperature));
  return out;
}

function qianfanChatBody(b: Rec): Rec {
  const out: Rec = {
    model: oneOf(b.model, QIANFAN_CHAT_MODELS, 'model'),
    max_tokens: clampTokens(b.max_tokens, 1024),
    messages: messages(b.messages),
  };
  if (typeof b.temperature === 'number') out.temperature = Math.max(0, Math.min(2, b.temperature));
  if (typeof b.top_p === 'number') out.top_p = Math.max(0, Math.min(1, b.top_p));
  return out;
}

function qianfanImageBody(b: Rec, muse: boolean): Rec {
  const out: Rec = {
    model: oneOf(b.model, QIANFAN_IMAGE_MODELS, 'model'),
    prompt: str(b.prompt, IMAGE_PROMPT_MAX, 'prompt'),
    size: oneOf(b.size ?? '1024x1024', ['1024x1024'], 'size'),
  };
  if (!muse) {
    out.n = 1;
    const neg = optStr(b.negative_prompt, IMAGE_PROMPT_MAX, 'negative_prompt');
    if (neg) out.negative_prompt = neg;
  }
  return out;
}

function fishTtsBody(b: Rec): Rec {
  const out: Rec = { text: str(b.text, TTS_TEXT_MAX, 'text'), format: 'mp3', latency: 'balanced' };
  const ref = optStr(b.reference_id, 64, 'reference_id');
  if (ref) out.reference_id = ref;
  return out;
}

function fishTtsStreamBody(b: Rec): Rec {
  return { ...fishTtsBody(b), format: 'pcm', sample_rate: TTS_STREAM_RATE };
}

function baiduTtsForm(b: Rec): Record<string, string> {
  return {
    tex: str(b.tex, TTS_TEXT_MAX, 'tex'),
    cuid: 'everylove-app',
    ctp: '1',
    lan: 'zh',
    per: String(optStr(b.per, 8, 'per') ?? '4115'),
    spd: '5',
    pit: '5',
    vol: '6',
    aue: '3',
  };
}

function baiduAsrBody(b: Rec): Rec {
  const speech = str(b.speech, AUDIO_B64_MAX, 'speech');
  const len = typeof b.len === 'number' && b.len > 0 ? Math.floor(b.len) : 0;
  if (!len) throw new BadRequest('len required');
  return {
    format: oneOf(b.format, ['wav', 'pcm', 'm4a', 'amr'], 'format'),
    rate: 16000,
    channel: 1,
    cuid: 'everylove-app',
    len,
    speech,
    dev_pid: typeof b.dev_pid === 'number' ? Math.floor(b.dev_pid) : 1537,
  };
}

/** Whisper 协议 / Fish 识别共用：base64 音频 + 可选语言 */
function audioUpload(b: Rec): { bytes: Uint8Array<ArrayBuffer>; mime: string; filename: string; language?: string } {
  const b64 = str(b.audio_base64, AUDIO_B64_MAX, 'audio_base64');
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return {
    bytes,
    mime: oneOf(b.mime ?? 'audio/wav', ['audio/wav', 'audio/m4a', 'audio/mp4', 'audio/mpeg'], 'mime'),
    filename: 'voice.wav',
    language: optStr(b.language, 8, 'language'),
  };
}

/* ── 上游响应：成功原样透传；失败只带一句话（D-166：不透传上游原文）── */

/** SSE 流（D-232）：原样流回；另一路边读边记 usage，流完再记账（不让她多等一趟库） */
function relaySse(r: Response, meter?: Meter): Promise<Response> | Response {
  if (!r.ok || !r.body) return relayJson(r, meter);
  const [out, tap] = r.body.tee();
  if (meter) {
    const charge = (async () => {
      const reader = tap.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      let input = 0;
      let output = 0;
      let cacheRead = 0;
      let cacheWrite = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.replace(/\r\n/g, '\n').split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const data = part
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('');
          try {
            const e = JSON.parse(data);
            if (e.type === 'message_start') {
              const u = e.message?.usage ?? {};
              input = Number(u.input_tokens ?? 0);
              cacheRead = Number(u.cache_read_input_tokens ?? 0);
              cacheWrite = Number(u.cache_creation_input_tokens ?? 0);
            }
            if (e.type === 'message_delta') output = Number(e.usage?.output_tokens ?? output);
          } catch {
            /* 不是 JSON 的行跳过 */
          }
        }
      }
      await chargeAfter(meter, { usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite } });
    })().catch((e) => console.error('[ai] 流式记账失败：', e));
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(charge);
  } else {
    void tap.cancel();
  }
  return new Response(out, { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
}

async function relayJson(r: Response, meter?: Meter): Promise<Response> {
  const text = await r.text();
  if (!r.ok) return json({ error: 'upstream', status: r.status, message: upstreamMessage(text) }, r.status);
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (meter) {
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* 不是 JSON：按估算记 */
    }
    const view = await chargeAfter(meter, data);
    if (view) headers['x-wallet'] = JSON.stringify(view);
  }
  return new Response(text, { status: r.status, headers });
}

/** 上游是 JSON 就透传；是二进制音频就包成 { audio_base64 }（客户端统一处理） */
async function audioOrJson(r: Response, meter?: Meter): Promise<Response> {
  const contentType = r.headers.get('content-type') ?? '';
  if (!r.ok || contentType.includes('application/json')) return relayJson(r, meter);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  const view = meter ? await chargeAfter(meter, null) : null;
  return json({ audio_base64: btoa(bin) }, r.status, view);
}

function upstreamMessage(text: string): string {
  try {
    const j = JSON.parse(text);
    const m = j?.error?.message ?? j?.error_msg ?? j?.message ?? j?.error;
    if (typeof m === 'string') return m.slice(0, 200);
  } catch {
    /* 不是 JSON */
  }
  return 'upstream error';
}

/* ── 限流（D-166）：service role + 原子自增；客户端对 ai_usage 没有任何权限 ── */

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function underLimit(userId: string, guest: boolean): Promise<{ ok: true } | { ok: false; limit: number }> {
  const limit = guest ? GUEST_DAILY_LIMIT : DAILY_LIMIT;
  const day = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin.rpc('increment_ai_usage', { p_user: userId, p_day: day, p_limit: limit });
  if (error) throw new Error(`ai_usage rpc: ${error.message}`);
  // 函数在 count >= limit 时不更新、返回 null
  return data === null || data === undefined ? { ok: false, limit } : { ok: true };
}

/* ── 记账（D-217）：余额只在服务器；SQL 管存取与原子扣减，算法在 _shared/economy.ts ── */

const ECONOMY = sqlEconomy();

async function walletRpc(fn: string, args: Rec): Promise<WalletRow> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (Array.isArray(data) ? data[0] : data) as WalletRow;
}

/** 一次生成的计量上下文：闸门处定下，上游成功后照它记账 */
interface Meter {
  user: string;
  tz: string | null;
  kind: MeterKind;
  billing: Billing;
  service: string;
  body: Rec;
}

/** 这个服务记哪种账；不花钱的返回 null */
function meterKindOf(service: string, body: Rec): MeterKind | null {
  switch (service) {
    case 'anthropic.messages':
      return 'chat';
    case 'qianfan.chat':
      // 看图走同一个聊天接口：消息里带图就按看图记
      return JSON.stringify(body.messages ?? '').includes('"image_url"') ? 'vision' : 'chat';
    case 'qianfan.images':
    case 'qianfan.musesteamer':
      return 'image';
    case 'baidu.asr':
    case 'baidu.asr_pro':
    case 'asr.transcribe':
    case 'fish.asr':
      return 'asr';
    case 'fish.tts':
    case 'fish.tts.stream':
    case 'baidu.tts':
      return 'tts';
    default:
      return null;
  }
}

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  generated_images?: number;
  total_tokens?: number;
};

/** 上游成功之后按真实用量记账，返回最新钱包；记账失败只记日志，不拦已经生成好的东西 */
async function chargeAfter(m: Meter, data: unknown): Promise<WalletView | null> {
  try {
    const usage = (data as { usage?: Usage } | null)?.usage;
    const u = usage ?? {};
    let mb = 0;
    let voiceSec = 0;
    let houseKtok = 0;
    let houseImages = 0;
    let houseTts = 0;
    let fairKtok = 0;
    let fairImages = 0;
    let tokens: number | undefined;
    let estimated = false;
    if (m.kind === 'chat' || m.kind === 'vision') {
      // D-233：按真实成本折，缓存住的前缀也算
      const real = costTokens({
        input: u.input_tokens ?? u.prompt_tokens,
        output: u.output_tokens ?? u.completion_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
      });
      if (real > 0) tokens = real;
      else {
        // 供应商没返回 usage：按字数估
        estimated = true;
        const d = data as Rec | null;
        tokens = costTokens({
          input: estimateTokens(JSON.stringify(m.body.system ?? '') + JSON.stringify(m.body.messages ?? '')),
          output: estimateTokens(JSON.stringify(d?.content ?? d?.choices ?? '')),
        });
      }
      if (m.billing === 'user') {
        mb = mbFor({ kind: m.kind, tokens });
        fairKtok = tokens / 1000;
      } else if (m.billing === 'house') houseKtok = tokens / 1000;
    } else if (m.kind === 'image') {
      // D-219：按张（n 固定 1；上游报了张数就用它），D-234：qwen 与蒸汽机两档
      const images = u.generated_images && u.generated_images > 0 ? u.generated_images : 1;
      estimated = !usage;
      if (m.billing === 'user') {
        mb = mbFor({ kind: 'image', images, model: imageModelOf(m.service) });
        fairImages = images;
      } else if (m.billing === 'house') houseImages = images;
    } else if (m.kind === 'asr') {
      // 16 kHz 16 bit 单声道 ≈ 32 KB / 秒；百度带 len（字节），其余按 base64 长度折
      const bytes = typeof m.body.len === 'number' ? m.body.len : (String(m.body.speech ?? m.body.audio_base64 ?? '').length * 3) / 4;
      estimated = true;
      if (m.billing === 'user') mb = mbFor({ kind: 'asr', seconds: bytes / 32000 });
    } else if (m.kind === 'tts') {
      const sec = estimateSpeechSeconds(String(m.body.text ?? m.body.tex ?? ''));
      if (m.billing === 'user') voiceSec = sec;
      else if (m.billing === 'house') houseTts = sec;
    }
    const w = await walletRpc('wallet_charge', {
      p_user: m.user,
      p_tz: m.tz,
      p_c: ECONOMY,
      p_mb: mb,
      p_voice_sec: voiceSec,
      p_voice_use: 'message',
      p_house_ktok: houseKtok,
      p_house_images: houseImages,
      p_house_tts: houseTts,
      p_fair_ktok: fairKtok,
      p_fair_images: fairImages,
      p_entry: mb > 0 ? { kind: m.kind, tokens, provider: m.service, estimated } : null,
    });
    return walletView(w, BILLING_LIVE);
  } catch (e) {
    console.error('[ai] 记账失败：', e);
    return null;
  }
}

/** 生成前：定账单归属、问还能不能花。返回计量上下文；不花钱的服务返回 null；不够花返回 402 */
async function gate(user: string, tz: string | null, service: string, body: Rec, billingIn: unknown): Promise<Meter | Response | null> {
  const kind = meterKindOf(service, body);
  if (!kind) return null;
  // 不写 = 老包：按平台出的算，只受后台保险丝管
  let billing: Billing = billingIn === 'user' || billingIn === 'included' || billingIn === 'house' ? billingIn : 'house';
  let w = await walletRpc('wallet_open', { p_user: user, p_tz: tz, p_c: ECONOMY });
  if (billing === 'included') {
    // 通话里的：电话真在打才算含在通话分钟里（顺手按服务器时钟计一段）；否则按她发起的记
    if (callAlive(w, Date.now())) w = await walletRpc('wallet_call_tick', { p_user: user, p_tz: tz, p_c: ECONOMY, p_end: false });
    else billing = 'user';
  }
  const view = walletView(w, BILLING_LIVE);
  const reason = gateReason(w, view, kind, billing);
  if (reason) return json({ error: 'blocked', reason }, 402, view);
  // Max 过线降速（D-220）：领一个号，没轮到就先等；要等太久的不等，让她过会儿再来
  const lane = slowLaneOf(w, kind, billing);
  if (lane) {
    const { data, error } = await admin.rpc('wallet_slow_slot', { p_user: user, p_lane: lane.lane, p_gap: lane.gapSec, p_max_wait: lane.maxWaitSec });
    if (error) throw new Error(`wallet_slow_slot: ${error.message}`);
    const wait = Number(data);
    if (wait < 0) return json({ error: 'blocked', reason: lane.lane === 'image' ? 'slow' : 'busy' }, 402, view);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait * 1000));
  }
  return { user, tz, kind, billing, service, body };
}

/** wallet.*：读钱包（可带一次性搬家）、通话计时、收费开关打开前的模拟到账 */
async function walletService(user: string, tz: string | null, service: string, body: Rec): Promise<Response> {
  const base = { p_user: user, p_tz: tz, p_c: ECONOMY };
  const grant = (mb: number | null, sec: number | null, plan: string | null, kind: string) =>
    walletRpc('wallet_grant', { ...base, p_mb: mb, p_voice_sec: sec, p_plan: plan, p_kind: kind });
  let w: WalletRow;
  if (service === 'wallet.get') {
    const imp = isRec(body.import) && !BILLING_LIVE ? body.import : null;
    w = imp
      ? await walletRpc('wallet_import', {
          ...base,
          p_plan: typeof imp.plan === 'string' ? imp.plan : null,
          p_mb: typeof imp.mb === 'number' ? imp.mb : 0,
          p_pack_sec: typeof imp.packSec === 'number' ? imp.packSec : 0,
          p_bonus_sec: typeof imp.bonusSec === 'number' ? imp.bonusSec : null,
        })
      : await walletRpc('wallet_open', base);
  } else if (service === 'wallet.call') {
    w = await walletRpc('wallet_call_tick', { ...base, p_end: body.end === true });
  } else if (service === 'wallet.sim') {
    if (BILLING_LIVE) return json({ error: 'billing live' }, 403);
    if (body.plan !== undefined) {
      w = await grant(null, null, oneOf(body.plan, ['free', 'pro', 'max'], 'plan'), 'plan');
    } else if (body.traffic_pack !== undefined) {
      const p = TRAFFIC_PACKS.find((x) => x.id === body.traffic_pack);
      if (!p) throw new BadRequest('traffic_pack not allowed');
      w = await grant(p.mb, null, null, 'pack');
    } else if (body.voice_pack !== undefined) {
      const p = VOICE_PACKS.find((x) => x.id === body.voice_pack);
      if (!p) throw new BadRequest('voice_pack not allowed');
      // 分钟包只卖给订阅用户（D-210）
      const cur = await walletRpc('wallet_open', base);
      if (cur.plan === 'free') return json({ error: 'subscribers only' }, 403, walletView(cur, BILLING_LIVE));
      w = await grant(null, p.min * 60, null, 'voice-pack');
    } else if (body.gm === 'traffic') {
      w = await grant(1000, null, null, 'gm');
    } else if (body.gm === 'voice') {
      w = await grant(null, 30 * 60, null, 'gm');
    } else {
      throw new BadRequest('nothing to grant');
    }
  } else {
    return json({ error: 'unknown service' }, 400);
  }
  const view = walletView(w, BILLING_LIVE);
  return json(view, 200, view);
}

/**
 * 认人（D-232）：先用项目的公钥（JWKS，ES256，取一次缓存住）在本地验 JWT，省掉每次一趟 auth 服务器；
 * 验不过（老的 HS256 令牌、换钥匙的空档）再回落 getUser 问 auth 服务器。只认已登录角色（含匿名游客），anon key 本身不算人。
 */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

async function caller(req: Request): Promise<{ id: string; is_anonymous: boolean } | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' });
    if (payload.role === 'authenticated' && typeof payload.sub === 'string') return { id: payload.sub, is_anonymous: payload.is_anonymous === true };
  } catch {
    /* 回落 auth 服务器 */
  }
  // 用请求者的 JWT 建客户端只为认人（getUser），不用它碰任何表
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
  } = await asUser.auth.getUser();
  return user ? { id: user.id, is_anonymous: Boolean(user.is_anonymous) } : null;
}

/** 发给模型网关的请求（普通 / 流式同一个） */
function gatewayFetch(body: Rec, signal?: AbortSignal): Promise<Response> {
  return fetch('https://api.llmgateway.io/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${LLMGATEWAY_KEY}`, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(anthropicBody(body)),
    signal,
  });
}

/** 发给 Fish 的流式合成请求 */
function fishStreamFetch(body: Rec, signal?: AbortSignal): Promise<Response> {
  return fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${Deno.env.get('FISH_API_KEY') ?? ''}`, model: Deno.env.get('FISH_MODEL') || 's2.1-pro' },
    body: JSON.stringify(fishTtsStreamBody(body)),
    signal,
  });
}

/**
 * 实时通话要快（D-232）：流式的模型请求与流式合成，上游请求和次数 / 记账闸门同时发出去（离库远的时候能省半秒到一秒），
 * 闸门不放行就当场掐掉上游；被拦的极少，最多白花一点上游。参数不合规照样在这里就抛 400。
 */
function earlyUpstream(service: string, body: Rec): { response: Promise<Response>; abort: AbortController } | null {
  const realtime = (service === 'anthropic.messages' && body.stream === true && LLMGATEWAY_KEY) || (service === 'fish.tts.stream' && Deno.env.get('FISH_API_KEY'));
  if (!realtime) return null;
  const abort = new AbortController();
  const response = service === 'fish.tts.stream' ? fishStreamFetch(body, abort.signal) : gatewayFetch(body, abort.signal);
  response.catch(() => {});
  return { response, abort };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const user = await caller(req);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const raw = await req.text();
    if (raw.length > BODY_MAX_BYTES) return json({ error: 'payload too large' }, 413);
    const parsed = JSON.parse(raw) as { service?: unknown; body?: unknown; billing?: unknown; tz?: unknown };
    const service = typeof parsed.service === 'string' ? parsed.service : '';
    const body = isRec(parsed.body) ? parsed.body : null;
    if (!service || !body) return json({ error: 'bad request' }, 400);
    const tz = typeof parsed.tz === 'string' && parsed.tz.length <= 64 ? parsed.tz : null;

    // 钱包服务不占 AI 次数
    if (service.startsWith('wallet.')) return await walletService(user.id, tz, service, body);

    // 次数与记账闸门（D-217）一起问（D-232：并行省一趟）；不够花回 402，放行的带着计量上下文去调上游
    const early = earlyUpstream(service, body);
    let limit: Awaited<ReturnType<typeof underLimit>>;
    let gated: Awaited<ReturnType<typeof gate>>;
    try {
      [limit, gated] = await Promise.all([underLimit(user.id, user.is_anonymous), gate(user.id, tz, service, body, parsed.billing)]);
    } catch (e) {
      early?.abort.abort();
      throw e;
    }
    if (!limit.ok || gated instanceof Response) early?.abort.abort();
    if (!limit.ok) return json({ error: 'rate_limited', limit: limit.limit }, 429);
    if (gated instanceof Response) return gated;
    const meter = gated ?? undefined;

    if (service === 'anthropic.messages') {
      if (!LLMGATEWAY_KEY) return json({ error: 'llmgateway key not configured' }, 503);
      const r = early ? await early.response : await gatewayFetch(body);
      if (body.stream === true) return relaySse(r, meter);
      return relayJson(r, meter);
    }

    // Whisper 协议识别（D-139）：key 只在 Secrets
    if (service === 'asr.transcribe') {
      const base = (Deno.env.get('ASR_BASE_URL') ?? '').replace(/\/+$/, '');
      const key = Deno.env.get('ASR_API_KEY') ?? '';
      if (!base || !key) return json({ error: 'asr not configured' }, 503);
      const a = audioUpload(body);
      const form = new FormData();
      form.append('file', new Blob([a.bytes], { type: a.mime }), a.filename);
      form.append('model', Deno.env.get('ASR_MODEL') || 'whisper-large-v3-turbo');
      if (a.language) form.append('language', a.language);
      form.append('response_format', 'json');
      const r = await fetch(`${base}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
      return relayJson(r, meter);
    }

    // Fish transcribe-1 识别（D-139）：multipart 字段叫 audio
    if (service === 'fish.asr') {
      const key = Deno.env.get('FISH_API_KEY') ?? '';
      if (!key) return json({ error: 'fish not configured' }, 503);
      const a = audioUpload(body);
      const form = new FormData();
      form.append('audio', new Blob([a.bytes], { type: a.mime }), a.filename);
      if (a.language) form.append('language', a.language);
      const r = await fetch('https://api.fish.audio/v1/asr', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
      return relayJson(r, meter);
    }

    // Fish Audio 合成（D-139）：text / reference_id 放行，format / latency 固定，模型走 header
    if (service === 'fish.tts') {
      const key = Deno.env.get('FISH_API_KEY') ?? '';
      if (!key) return json({ error: 'fish not configured' }, 503);
      const r = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, model: Deno.env.get('FISH_MODEL') || 's2.1-pro' },
        body: JSON.stringify(fishTtsBody(body)),
      });
      return await audioOrJson(r, meter);
    }

    // 通话的流式合成（D-232）：PCM 边合成边回，记账放到流回之后（不让她多等一趟库）
    if (service === 'fish.tts.stream') {
      if (!Deno.env.get('FISH_API_KEY')) return json({ error: 'fish not configured' }, 503);
      const r = early ? await early.response : await fishStreamFetch(body);
      if (!r.ok || !r.body || (r.headers.get('content-type') ?? '').includes('application/json')) return relayJson(r, meter);
      if (meter) {
        const charge = chargeAfter(meter, null);
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(charge);
      }
      return new Response(r.body, { status: 200, headers: { 'content-type': 'audio/pcm', 'x-sample-rate': String(TTS_STREAM_RATE) } });
    }

    // 千帆 v2 与百度语音同一把 bce-v3 key
    if (!QIANFAN_KEY) return json({ error: 'qianfan key not configured' }, 503);
    const qianfan = (url: string, payload: Rec, form = false) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json',
          authorization: `Bearer ${QIANFAN_KEY}`,
        },
        body: form ? new URLSearchParams(payload as Record<string, string>).toString() : JSON.stringify(payload),
      });

    switch (service) {
      case 'qianfan.chat':
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/chat/completions', qianfanChatBody(body)), meter);
      case 'qianfan.images':
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/images/generations', qianfanImageBody(body, false)), meter);
      // 百度蒸汽机 Air-Image 专用端点（D-071 / D-076：动漫画风走它；通用端点对它不回）
      case 'qianfan.musesteamer':
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/musesteamer/images/generations', qianfanImageBody(body, true)), meter);
      case 'baidu.asr':
        return relayJson(await qianfan('https://vop.baidu.com/server_api', baiduAsrBody(body)), meter);
      case 'baidu.asr_pro':
        return relayJson(await qianfan('https://vop.baidu.com/pro_api', baiduAsrBody(body)), meter);
      case 'baidu.tts':
        return await audioOrJson(await qianfan('https://tsn.baidu.com/text2audio', baiduTtsForm(body), true), meter);
      default:
        return json({ error: 'unknown service' }, 400);
    }
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: 'bad request', message: e.message }, 400);
    console.error('[ai] internal error:', e);
    return json({ error: 'internal' }, 500);
  }
});

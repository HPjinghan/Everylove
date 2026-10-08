/**
 * AI 服务端代理（D-057 / D-166）：唯一的自有服务端组件。
 * 职责：LLM / 生图 / 语音的 API key 收在服务端（Supabase Secrets），客户端只带登录态调用；
 *      按用户限每日次数（`ai_usage` 表，防盗刷）；每个 service 只放行已知字段、模型只认白名单、长度与 token 封顶。
 *
 * 客户端协议：POST { service, body }，service ∈
 *   qianfan.chat / qianfan.images / qianfan.musesteamer / anthropic.messages（JSON）
 *   baidu.asr / baidu.asr_pro（百度语音识别，JSON；D-073）
 *   baidu.tts（百度短文本语音合成 tsn.baidu.com/text2audio，body 为表单字段对象；D-073）
 *   asr.transcribe（Whisper 协议识别，日 / 韩用；D-139。Secrets：ASR_BASE_URL / ASR_API_KEY / ASR_MODEL；没配返回 503「asr not configured」，客户端回落百度）
 *   fish.tts（Fish Audio 合成 api.fish.audio/v1/tts；D-139。Secrets：FISH_API_KEY / FISH_MODEL；没配返回 503「fish not configured」，客户端回落百度）
 *   fish.asr（Fish transcribe-1 识别 api.fish.audio/v1/asr，multipart 字段 audio；同一把 FISH_API_KEY；D-139）
 * 返回：上游成功 → JSON 原样透传（二进制音频包成 { audio_base64 }）；上游失败 → { error: 'upstream', status, message }（只带上游的一句话，不带原文）；
 *      本函数出错 → { error: 'internal' }（细节只进函数日志）。
 *
 * 限流（D-166）：`increment_ai_usage(p_user, p_day, p_limit)` 是 security definer 的原子自增（insert … on conflict … where count < limit），
 * 用 service role 调（客户端对 ai_usage 表没有任何权限，改不了自己的计数）；匿名游客与真账号各一档：AI_GUEST_DAILY_LIMIT（默认 100）/ AI_DAILY_LIMIT（默认 500）。
 * 白名单（D-166）：模型只认 ANTHROPIC_MODELS / QIANFAN_CHAT_MODELS / QIANFAN_IMAGE_MODELS（逗号分隔，Secrets 可改，默认 = 客户端 core/config.ts 的默认值）；
 * max_tokens 封顶 AI_MAX_TOKENS（默认 8192）；生图 n 固定 1、size 只认 1024x1024；合成文本 ≤ 1000 字；识别音频 base64 ≤ 8 MB；请求体 ≤ 4 MB。
 * 建表与函数：docs/supabase-setup.sql。部署：supabase functions deploy ai（verify_jwt 开启——平台先验 JWT，函数内再取 user 限流）。
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const QIANFAN_KEY = Deno.env.get('QIANFAN_API_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '500');
const GUEST_DAILY_LIMIT = Number(Deno.env.get('AI_GUEST_DAILY_LIMIT') ?? '100');
const MAX_TOKENS_CAP = Number(Deno.env.get('AI_MAX_TOKENS') ?? '8192');

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
const IMAGE_PROMPT_MAX = 2000;
const MESSAGES_MAX = 80;

const JSON_HEADERS = { 'content-type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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

async function relayJson(r: Response): Promise<Response> {
  const text = await r.text();
  if (r.ok) return new Response(text, { status: r.status, headers: JSON_HEADERS });
  return json({ error: 'upstream', status: r.status, message: upstreamMessage(text) }, r.status);
}

/** 上游是 JSON 就透传；是二进制音频就包成 { audio_base64 }（客户端统一处理） */
async function audioOrJson(r: Response): Promise<Response> {
  const contentType = r.headers.get('content-type') ?? '';
  if (!r.ok || contentType.includes('application/json')) return relayJson(r);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return json({ audio_base64: btoa(bin) }, r.status);
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

async function underLimit(userId: string, guest: boolean): Promise<{ ok: true } | { ok: false; limit: number }> {
  const limit = guest ? GUEST_DAILY_LIMIT : DAILY_LIMIT;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const day = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin.rpc('increment_ai_usage', { p_user: userId, p_day: day, p_limit: limit });
  if (error) throw new Error(`ai_usage rpc: ${error.message}`);
  // 函数在 count >= limit 时不更新、返回 null
  return data === null || data === undefined ? { ok: false, limit } : { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    // 用请求者的 JWT 建客户端只为认人（getUser），不用它碰任何表
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = await asUser.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const raw = await req.text();
    if (raw.length > BODY_MAX_BYTES) return json({ error: 'payload too large' }, 413);
    const parsed = JSON.parse(raw) as { service?: unknown; body?: unknown };
    const service = typeof parsed.service === 'string' ? parsed.service : '';
    const body = isRec(parsed.body) ? parsed.body : null;
    if (!service || !body) return json({ error: 'bad request' }, 400);

    const gate = await underLimit(user.id, Boolean(user.is_anonymous));
    if (!gate.ok) return json({ error: 'rate_limited', limit: gate.limit }, 429);

    if (service === 'anthropic.messages') {
      if (!ANTHROPIC_KEY) return json({ error: 'anthropic key not configured' }, 503);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(anthropicBody(body)),
      });
      return relayJson(r);
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
      return relayJson(r);
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
      return relayJson(r);
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
      return await audioOrJson(r);
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
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/chat/completions', qianfanChatBody(body)));
      case 'qianfan.images':
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/images/generations', qianfanImageBody(body, false)));
      // 百度蒸汽机 Air-Image 专用端点（D-071 / D-076：动漫画风走它；通用端点对它不回）
      case 'qianfan.musesteamer':
        return relayJson(await qianfan('https://qianfan.baidubce.com/v2/musesteamer/images/generations', qianfanImageBody(body, true)));
      case 'baidu.asr':
        return relayJson(await qianfan('https://vop.baidu.com/server_api', baiduAsrBody(body)));
      case 'baidu.asr_pro':
        return relayJson(await qianfan('https://vop.baidu.com/pro_api', baiduAsrBody(body)));
      case 'baidu.tts':
        return await audioOrJson(await qianfan('https://tsn.baidu.com/text2audio', baiduTtsForm(body), true));
      default:
        return json({ error: 'unknown service' }, 400);
    }
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: 'bad request', message: e.message }, 400);
    console.error('[ai] internal error:', e);
    return json({ error: 'internal' }, 500);
  }
});

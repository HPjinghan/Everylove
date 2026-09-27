/**
 * AI 服务端代理的客户端（D-057）：调 Supabase Edge Function `ai`。
 * 走代理的条件 = 配了 Supabase（没登录时自动建匿名游客身份，D-088）；本地配了 key 时引擎仍走直连（开发自测优先）。
 * 协议见 supabase/functions/ai/index.ts。
 */

import {
  authConfigured,
  currentSession,
  ensureGuestSession,
  hasSessionSync,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '@/lib/auth';

/** 同步近似判断（UI 可用性）：配置齐 + 会话缓存在 */
export function proxyReadySync(): boolean {
  return authConfigured() && hasSessionSync();
}

/** 准确判断（发请求前用） */
export async function proxyAvailable(): Promise<boolean> {
  if (!authConfigured()) return false;
  return Boolean((await currentSession()) ?? (await ensureGuestSession()));
}

/**
 * 带超时、可取消的请求（D-109 / D-171）：RN 的 fetch 不能设超时，iOS 会落到 NSURLSession 默认 60 秒——生图（qwen-image 约 1 分钟）经代理常常超过，
 * 客户端只看到「Network request failed」。用 XMLHttpRequest 的 timeout 显式设；超时 / 断网 / 取消都抛带原因的 Error。
 * 全 App 的直连（聊天 / 看图 / 识别 / 合成 / 生图 / 天气 / 地图）与代理都走这里，不再有裸 fetch。
 */
export interface TimedResponse {
  ok: boolean;
  status: number;
  /** 文本响应（binary 时为空） */
  text: string;
  contentType: string;
  /** binary 时的响应体 */
  buffer?: ArrayBuffer;
}

export interface TimedRequest {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** 已序列化的请求体（JSON 字符串 / 表单串）；GET 不传 */
  body?: string;
  timeoutMs: number;
  /** 要二进制响应（语音合成） */
  binary?: boolean;
  /** 取消：调用方 `AbortController.abort()` */
  signal?: AbortSignal;
}

/** 各类直连请求的超时（D-171）：聊天 / 看图与代理一致 90 s（思考模型慢）、识别 60 s、合成 30 s、天气 / 地图 15 s；生图在 lib/imagegen 自己 180 s */
export const TIMEOUTS = { chat: 90_000, asr: 60_000, tts: 30_000, web: 15_000 } as const;

export function requestWithTimeout(url: string, req: TimedRequest): Promise<TimedResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(req.method ?? 'POST', url);
    xhr.timeout = req.timeoutMs;
    if (req.binary) xhr.responseType = 'arraybuffer';
    for (const [k, v] of Object.entries(req.headers ?? {})) xhr.setRequestHeader(k, v);
    const onAbort = () => {
      xhr.abort();
      reject(new Error('请求已取消'));
    };
    if (req.signal?.aborted) return onAbort();
    req.signal?.addEventListener('abort', onAbort, { once: true });
    const done = () => req.signal?.removeEventListener('abort', onAbort);
    xhr.onload = () => {
      done();
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: req.binary ? '' : xhr.responseText,
        contentType: xhr.getResponseHeader('content-type') ?? '',
        buffer: req.binary ? (xhr.response as ArrayBuffer) : undefined,
      });
    };
    xhr.onerror = () => {
      done();
      reject(new Error('网络请求失败'));
    };
    xhr.ontimeout = () => {
      done();
      reject(new Error(`请求超时（${Math.round(req.timeoutMs / 1000)} 秒）`));
    };
    xhr.send(req.body);
  });
}

/** POST JSON（content-type 自动带上） */
export function postJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<TimedResponse> {
  return requestWithTimeout(url, { headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), timeoutMs, signal });
}

/** GET JSON：非 2xx 抛错 */
export async function getJsonWithTimeout<T>(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<T> {
  const res = await requestWithTimeout(url, { method: 'GET', headers, timeoutMs });
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return JSON.parse(res.text) as T;
}

/** 默认 90 秒；生图这类慢请求调用方自己传更长的 */
const PROXY_TIMEOUT_MS = 90_000;

/** 调一次代理，返回上游 JSON；失败抛错（调用方决定回落） */
export async function proxyJson<T = unknown>(service: string, body: unknown, timeoutMs = PROXY_TIMEOUT_MS): Promise<T> {
  const session = (await currentSession()) ?? (await ensureGuestSession());
  if (!session) throw new Error('没有登录态、也建不了游客身份，无法走服务端代理');
  const res = await postJsonWithTimeout(
    `${SUPABASE_URL}/functions/v1/ai`,
    {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    { service, body },
    timeoutMs
  );
  if (!res.ok) throw new Error(`proxy ${res.status}: ${res.text.slice(0, 160)}`);
  return JSON.parse(res.text) as T;
}

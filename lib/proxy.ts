/**
 * AI 服务端代理的客户端（D-057）：调 Supabase Edge Function `ai`。
 * 走代理的条件 = 配了 Supabase（没登录时自动建匿名游客身份，D-088）；本地配了 key 时引擎仍走直连（开发自测优先）。
 * 协议见 supabase/functions/ai/index.ts。
 */

import { fetch as streamingFetch } from 'expo/fetch';

import { GenerationBlockedError, type Billing } from '@/core/usage';
import { t } from '@/lib/i18n';
import type { WalletView } from '@/supabase/functions/_shared/economy';
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
  /** 请求时点名要的响应头（小写名 → 值） */
  headers?: Record<string, string>;
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
  /** 要读回来的响应头（代理的 x-wallet，D-217） */
  responseHeaders?: string[];
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
        headers: req.responseHeaders
          ? Object.fromEntries(req.responseHeaders.map((h) => [h.toLowerCase(), xhr.getResponseHeader(h) ?? '']))
          : undefined,
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

export interface ProxyOptions {
  timeoutMs?: number;
  /** 这笔账算给谁（D-217：服务器按它扣账；不写服务器按平台出的算） */
  billing?: Billing;
}

/** 服务器钱包的监听者（D-217）：每次代理响应带回最新钱包（响应头 x-wallet），features/traffic.ts 写进 store */
let walletListener: ((v: WalletView) => void) | null = null;
export function onServerWallet(fn: ((v: WalletView) => void) | null): void {
  walletListener = fn;
}

/** 她所在的时区：服务器按它算「今天」（每天免费的、每天的语音额度） */
function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** 服务器拦下的原因 → 一句话（与本机闸门同一套文案） */
const BLOCKED: Record<string, string> = { traffic: '流量用完了', voice: '语音时长用完了', house: '今天的后台生成到顶了', fair: '今天先到这里，明天再来', slow: '照片还在冲洗，过几分钟再拍', busy: 'TA 这会儿忙，等一下再说' };

/**
 * 调一个自有 Edge Function（带登录态；没有就建游客身份）：原样返回响应，带回来的最新钱包（x-wallet）交给监听者。
 * body 里自动带上她的时区。
 */
export async function callFunction(name: string, body: Record<string, unknown>, timeoutMs = PROXY_TIMEOUT_MS): Promise<TimedResponse> {
  const session = (await currentSession()) ?? (await ensureGuestSession());
  if (!session) throw new Error('没有登录态、也建不了游客身份，无法走服务端代理');
  const res = await requestWithTimeout(`${SUPABASE_URL}/functions/v1/${name}`, {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ ...body, tz: timeZone() }),
    timeoutMs,
    responseHeaders: ['x-wallet'],
  });
  const wallet = res.headers?.['x-wallet'];
  if (wallet && walletListener) {
    try {
      walletListener(JSON.parse(wallet) as WalletView);
    } catch {
      /* 头坏了就当没有 */
    }
  }
  return res;
}

/** 调一次代理，返回上游 JSON；失败抛错（调用方决定回落）；余额不够抛 GenerationBlockedError */
export async function proxyJson<T = unknown>(service: string, body: unknown, opts: number | ProxyOptions = {}): Promise<T> {
  const { timeoutMs = PROXY_TIMEOUT_MS, billing } = typeof opts === 'number' ? { timeoutMs: opts } : opts;
  const res = await callFunction('ai', { service, body, billing }, timeoutMs);
  if (res.status === 402) {
    let reason = '';
    try {
      reason = (JSON.parse(res.text) as { reason?: string }).reason ?? '';
    } catch {}
    throw new GenerationBlockedError(t(BLOCKED[reason] ?? '流量用完了'));
  }
  if (!res.ok) throw new Error(`proxy ${res.status}: ${res.text.slice(0, 160)}`);
  return JSON.parse(res.text) as T;
}

/**
 * 调一次代理的流式服务（D-232，现在只有 fish.tts.stream）：返回响应体的读取器，边到边读；
 * 余额不够抛 GenerationBlockedError，其余失败抛错。signal 用来在她打断 TA 时掐掉。
 */
export async function proxyStream(
  service: string,
  body: unknown,
  opts: { billing?: Billing; signal?: AbortSignal } = {}
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; headers: Headers }> {
  const session = (await currentSession()) ?? (await ensureGuestSession());
  if (!session) throw new Error('没有登录态、也建不了游客身份，无法走服务端代理');
  const res = await streamingFetch(`${SUPABASE_URL}/functions/v1/ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ service, body, billing: opts.billing, tz: timeZone() }),
    signal: opts.signal,
  });
  if (res.status === 402) {
    let reason = '';
    try {
      reason = ((await res.json()) as { reason?: string }).reason ?? '';
    } catch {}
    throw new GenerationBlockedError(t(BLOCKED[reason] ?? '语音时长用完了'));
  }
  if (!res.ok || !res.body) throw new Error(`proxy ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return { reader: res.body.getReader(), headers: res.headers };
}

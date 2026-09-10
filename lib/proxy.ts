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
 * 带超时的 POST（D-109）：RN 的 fetch 不能设超时，iOS 会落到 NSURLSession 默认 60 秒——生图（qwen-image 约 1 分钟）经代理常常超过，
 * 客户端只看到「Network request failed」。用 XMLHttpRequest 的 timeout 显式放宽；超时 / 断网都抛带原因的 Error。
 */
export function postJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('网络请求失败'));
    xhr.ontimeout = () => reject(new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`));
    xhr.send(JSON.stringify(body));
  });
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

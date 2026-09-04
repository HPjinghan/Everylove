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

/** 调一次代理，返回上游 JSON；失败抛错（调用方决定回落） */
export async function proxyJson<T = unknown>(service: string, body: unknown): Promise<T> {
  const session = (await currentSession()) ?? (await ensureGuestSession());
  if (!session) throw new Error('没有登录态、也建不了游客身份，无法走服务端代理');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ service, body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`proxy ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text) as T;
}

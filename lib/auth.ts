/**
 * 账号（D-054）：Supabase 认证——Apple 登录 + 邮箱验证码（OTP，无密码，省掉整条「忘记密码」流）。
 * 注册不是门，是保险箱：游客 = 纯本地（默认体验完全不变），登录只为云备份/跨设备（lib/sync.ts）。
 * 游客身份（D-088）：没本地 AI key 的分发包要走服务端代理，代理按人限量——所以没登录时悄悄匿名登录一次
 * 拿个 JWT（Supabase Anonymous sign-ins）。匿名会话**不算登录**：登录墙 / 云备份 / 共享池只认 isSignedIn。
 * 供应商抽象：界面只认这里导出的函数——正式版若迁自建/LeanCloud，只改本文件。
 * key 在 .env.local：EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY（改后重启 expo start）。
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

import { CONFIG } from '@/core/config';

export const SUPABASE_URL = CONFIG.supabaseUrl;
export const SUPABASE_ANON_KEY = CONFIG.supabaseAnonKey;

/** env 里配好了 Supabase 才可用；没配时设置页显示引导，其他一切照旧 */
export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;
/** 会话缓存：给需要同步判断「已登录？」的地方（imageKeyReady 等）用 */
let cachedSession: Session | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!authConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    client.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
    });
  }
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  cachedSession = data.session ?? null;
  return cachedSession;
}

/** 同步版登录判断（可能落后一拍；准确判断用 currentSession） */
export function hasSessionSync(): boolean {
  return cachedSession !== null;
}

/** 真正登录（Apple / 邮箱）才算；匿名会话只是给服务端代理用的游客身份（D-088） */
export function isSignedIn(session: Session | null | undefined): session is Session {
  return Boolean(session) && !session!.user.is_anonymous;
}

/** 登录态会话（排除匿名）：登录墙、云备份、共享池等「需要真账号」的地方用 */
export async function signedInSession(): Promise<Session | null> {
  const s = await currentSession();
  return isSignedIn(s) ? s : null;
}

let guestSignIn: Promise<Session | null> | null = null;
/** 游客身份（D-088）：没有任何会话时匿名登录一次，只为让服务端代理认得出「一个人」并按人限量；失败返回 null（不打扰） */
export async function ensureGuestSession(): Promise<Session | null> {
  const existing = await currentSession();
  if (existing) return existing;
  const sb = getSupabase();
  if (!sb) return null;
  if (!guestSignIn) {
    guestSignIn = sb.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error) throw error;
        cachedSession = data.session ?? null;
        return cachedSession;
      })
      .catch((e: unknown) => {
        console.warn('[auth] 匿名会话建立失败：', e instanceof Error ? e.message : e);
        return null;
      })
      .finally(() => {
        guestSignIn = null;
      });
  }
  return guestSignIn;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** Apple 登录（iOS）：expo-apple-authentication 拿 identityToken → Supabase 换会话 */
export async function signInWithApple(): Promise<Session> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 未配置');
  const AppleAuthentication = await import('expo-apple-authentication');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('没有拿到 Apple 凭证');
  const { data, error } = await sb.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data.session!;
}

export async function sendEmailOtp(email: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 未配置');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, code: string): Promise<Session> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 未配置');
  const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  return data.session!;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

/** 账号的展示名：邮箱，或「Apple 用户」 */
export function sessionLabel(session: Session): string {
  return session.user.email || 'Apple 用户';
}

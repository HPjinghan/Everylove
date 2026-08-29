/**
 * 账号（D-054）：Supabase 认证——Apple 登录 + 邮箱验证码（OTP，无密码，省掉整条「忘记密码」流）。
 * 注册不是门，是保险箱：游客 = 纯本地（默认体验完全不变），登录只为云备份/跨设备（lib/sync.ts）。
 * 供应商抽象：界面只认这里导出的函数——正式版若迁自建/LeanCloud，只改本文件。
 * key 在 .env.local：EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY（改后重启 expo start）。
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** env 里配好了 Supabase 才可用；没配时设置页显示引导，其他一切照旧 */
export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;

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
  }
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
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

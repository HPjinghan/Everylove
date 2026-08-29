/**
 * 云备份（D-054 快照同步 v0）：本地优先，云端是保险箱——「换手机也不会失去 TA」。
 * 同步单位 = zustand persist 的整份快照（AsyncStorage 'everylove-store'，含聊天/记忆，按最高敏感级）。
 * 冲突策略 last-write-wins；登录态下 store 变化后防抖 60s 自动上传；恢复 = 覆写本地 + rehydrate。
 * 服务端只有一张表 snapshots（建表 SQL 见 docs/supabase-setup.sql，RLS 只许本人读写）。
 * 正式版演进：按实体增量同步 + 服务端记忆库（D-016 预留），接口保持本文件不变。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentSession, getSupabase } from '@/lib/auth';
import { useAppStore } from '@/store/app-store';

/** zustand persist 的存储键（store/app-store.ts 的 name） */
const STORE_KEY = 'everylove-store';

let lastSyncAt: number | null = null;
export function lastSyncTime(): number | null {
  return lastSyncAt;
}

/** 上传当前本地快照（覆盖云端） */
export async function uploadSnapshot(): Promise<'ok' | 'no-session' | 'fail'> {
  const sb = getSupabase();
  const session = await currentSession();
  if (!sb || !session) return 'no-session';
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return 'fail';
    const { error } = await sb.from('snapshots').upsert({
      user_id: session.user.id,
      data: JSON.parse(raw),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    lastSyncAt = Date.now();
    return 'ok';
  } catch (e) {
    console.warn('[sync] 上传失败：', e);
    return 'fail';
  }
}

/** 云端快照的更新时间；没有则 null */
export async function cloudSnapshotAt(): Promise<number | null> {
  const sb = getSupabase();
  const session = await currentSession();
  if (!sb || !session) return null;
  const { data, error } = await sb
    .from('snapshots')
    .select('updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return new Date(data.updated_at as string).getTime();
}

/** 用云端快照覆盖本机并重新水合（调用方先向用户确认——这会覆盖本机数据） */
export async function restoreSnapshot(): Promise<boolean> {
  const sb = getSupabase();
  const session = await currentSession();
  if (!sb || !session) return false;
  const { data, error } = await sb
    .from('snapshots')
    .select('data')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data?.data) return false;
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data.data));
  await useAppStore.persist.rehydrate();
  lastSyncAt = Date.now();
  return true;
}

/** 删除云端数据（App Store 要求账号可删；试装先删数据 + 退出，账号本体删除待服务端函数） */
export async function deleteCloudData(): Promise<boolean> {
  const sb = getSupabase();
  const session = await currentSession();
  if (!sb || !session) return false;
  const { error } = await sb.from('snapshots').delete().eq('user_id', session.user.id);
  if (error) {
    console.warn('[sync] 删除云端数据失败：', error);
    return false;
  }
  lastSyncAt = null;
  return true;
}

/** 自动备份：store 变化后防抖 60s 上传（uploadSnapshot 自带登录态判断）。返回退订函数。 */
export function startAutoBackup(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsub = useAppStore.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void uploadSnapshot(), 60_000);
  });
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

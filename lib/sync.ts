/**
 * 云同步（D-054 快照 v0 → D-057 云端为主）：数据尽量存云端，本地 AsyncStorage 是工作缓存。
 * - 登录态下：store 变化 15s 防抖自动上传；App 退后台立即冲刷；启动/登录时对账（reconcile）——
 *   云端更新且本地无未同步改动 → 静默拉下来；本地有改动 → 本地覆盖云端（正在用的设备赢）。
 * - 离线/未登录：一切照旧跑在本地缓存上，回线后按上面规则补同步。
 * 同步单位 = zustand persist 的整份快照（含聊天/记忆，按最高敏感级）。
 * 服务端只有一张表 snapshots（建表 SQL 见 docs/supabase-setup.sql，RLS 只许本人读写）。
 * 正式版演进：按实体增量同步 + 服务端记忆库（D-016 预留），接口保持本文件不变。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { currentSession, getSupabase, onAuthChange } from '@/lib/auth';
import { useAppStore } from '@/store/app-store';

/** zustand persist 的存储键（store/app-store.ts 的 name） */
const STORE_KEY = 'everylove-store';
/** 同步元数据（本机）：上次成功同步时间 + 是否有未上传的改动 */
const META_KEY = 'everylove-sync-meta';

let lastSyncAt: number | null = null;
export function lastSyncTime(): number | null {
  return lastSyncAt;
}

interface SyncMeta {
  lastSyncedAt: number;
  dirty: boolean;
}

let meta: SyncMeta = { lastSyncedAt: 0, dirty: false };
let metaLoaded = false;
/** 恢复中：rehydrate 会触发 store.subscribe，别把「恢复」误记成本地改动 */
let restoring = false;

async function loadMeta(): Promise<void> {
  if (metaLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) meta = { ...meta, ...JSON.parse(raw) };
  } catch {}
  metaLoaded = true;
  lastSyncAt = meta.lastSyncedAt || null;
}

function saveMeta(): void {
  void AsyncStorage.setItem(META_KEY, JSON.stringify(meta)).catch(() => {});
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
    meta.lastSyncedAt = lastSyncAt;
    meta.dirty = false;
    saveMeta();
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
  restoring = true;
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data.data));
    await useAppStore.persist.rehydrate();
  } finally {
    setTimeout(() => {
      restoring = false;
    }, 500);
  }
  lastSyncAt = Date.now();
  meta.lastSyncedAt = lastSyncAt;
  meta.dirty = false;
  saveMeta();
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

/**
 * 对账（D-057 云端为主）：云端更新且本地干净 → 静默恢复云端；本地有未同步改动 → 上传覆盖
 * （正在用的设备赢——她手里这台永远不丢字）。登录时、启动时、回线时都可调用。
 */
export async function reconcileNow(): Promise<'pulled' | 'pushed' | 'noop'> {
  await loadMeta();
  const session = await currentSession();
  if (!session) return 'noop';
  const cloudAt = await cloudSnapshotAt();
  if (cloudAt == null) {
    // 云端还没有备份：把本机第一份传上去
    const r = await uploadSnapshot();
    return r === 'ok' ? 'pushed' : 'noop';
  }
  if (meta.dirty) {
    const r = await uploadSnapshot();
    return r === 'ok' ? 'pushed' : 'noop';
  }
  if (cloudAt > meta.lastSyncedAt + 1500) {
    const ok = await restoreSnapshot();
    if (ok) console.log('[sync] 云端较新，已静默恢复');
    return ok ? 'pulled' : 'noop';
  }
  return 'noop';
}

/**
 * 云同步总开关（在根布局水合后启动）：
 * 变化标脏 + 防抖 15s 上传；退后台立即冲刷；登录时对账。返回退订函数。
 */
export function initCloudSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleUpload = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void uploadSnapshot(), 15_000);
  };

  const unsubStore = useAppStore.subscribe(() => {
    if (restoring) return;
    meta.dirty = true;
    saveMeta();
    scheduleUpload();
  });

  const unsubAuth = onAuthChange((session) => {
    if (session) void reconcileNow();
  });

  const appStateSub = AppState.addEventListener('change', (s) => {
    if (s === 'background' && meta.dirty) void uploadSnapshot();
    if (s === 'active') void reconcileNow();
  });

  void reconcileNow();

  return () => {
    unsubStore();
    unsubAuth();
    appStateSub.remove();
    if (timer) clearTimeout(timer);
  };
}

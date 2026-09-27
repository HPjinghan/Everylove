/**
 * 云同步（D-054 快照 v0 → D-057 云端为主）：数据尽量存云端，本地 AsyncStorage 是工作缓存。
 * - 登录态下：store 变化 15s 防抖自动上传；App 退后台立即冲刷；启动/登录时对账（reconcile）——
 *   云端更新且本地无未同步改动 → 静默拉下来；本地有改动 → 本地覆盖云端（正在用的设备赢）。
 * - **新设备 / 换账号（D-096）**：这台手机还没和这个账号对过账时，本机不许覆盖云端——
 *   本机是空的（还没认识 TA）→ 静默把云端接回来；本机已有关系 → 返回 conflict，由登录界面问她「接回云端 / 用本机覆盖」。
 * - 离线/未登录：一切照旧跑在本地缓存上，回线后按上面规则补同步。
 * 同步单位 = zustand persist 的整份快照（含聊天/记忆，按最高敏感级；归档的旧消息与共享池缓存不在里面，D-201）。
 * 服务端只有一张表 snapshots（建表 SQL 见 docs/supabase-setup.sql，RLS 只许本人读写）。
 * 版本号 rev（D-202）：每次上传 rev + 1 且只在云端 rev 等于本机记的那个时才更新——别的设备写过就会更不到，
 *   这时按 D-057「正在用的设备赢」覆盖，但记一笔 warn 并对齐 rev；上传失败按 30 / 60 / 120 s 重试三次；同一时刻只有一份上传在跑。
 * 正式版演进：按实体增量同步 + 服务端记忆库（D-016 预留），接口保持本文件不变。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { getSupabase, isSignedIn, onAuthChange, signedInSession, syncAccountLanguage } from '@/lib/auth';
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
  /** 上次对账的账号（D-096）：换账号登录 = 这台手机对新账号而言是「新设备」 */
  userId?: string;
  /** 本机最后一次见到的云端版本号（D-202） */
  rev?: number;
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

/** 重试节奏（D-202） */
const RETRY_MS = [30_000, 60_000, 120_000];
let uploading: Promise<'ok' | 'no-session' | 'fail'> | null = null;
let uploadAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

/** 上传当前本地快照（覆盖云端）；正在传时再叫 = 传完再传一次；失败自动按节奏重试 */
export function uploadSnapshot(): Promise<'ok' | 'no-session' | 'fail'> {
  if (uploading) {
    uploadAgain = true;
    return uploading;
  }
  uploading = doUpload().finally(() => {
    uploading = null;
    if (uploadAgain) {
      uploadAgain = false;
      void uploadSnapshot();
    }
  });
  return uploading;
}

async function doUpload(): Promise<'ok' | 'no-session' | 'fail'> {
  const sb = getSupabase();
  const session = await signedInSession();
  if (!sb || !session) return 'no-session';
  await loadMeta();
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return 'fail';
    const uid = session.user.id;
    const payload = { data: JSON.parse(raw) as unknown, updated_at: new Date().toISOString() };
    const expected = meta.rev ?? 0;
    // 条件更新：只在云端还是本机见过的那个版本时才写
    const upd = await sb.from('snapshots').update({ ...payload, rev: expected + 1 }).eq('user_id', uid).eq('rev', expected).select('rev').maybeSingle();
    if (upd.error) throw upd.error;
    let rev = upd.data?.rev as number | undefined;
    if (rev === undefined) {
      const cloud = await sb.from('snapshots').select('rev').eq('user_id', uid).maybeSingle();
      if (cloud.error) throw cloud.error;
      if (!cloud.data) {
        const ins = await sb.from('snapshots').insert({ user_id: uid, ...payload, rev: 1 }).select('rev').maybeSingle();
        if (ins.error) throw ins.error;
        rev = 1;
      } else {
        // 别的设备写过（D-202）：正在用的这台赢（D-057），覆盖并对齐版本号
        const cloudRev = Number(cloud.data.rev) || 0;
        console.warn(`[sync] 云端已被别的设备改过（rev ${cloudRev} ≠ 本机 ${expected}），以这台为准覆盖`);
        const force = await sb.from('snapshots').update({ ...payload, rev: cloudRev + 1 }).eq('user_id', uid).select('rev').maybeSingle();
        if (force.error) throw force.error;
        rev = cloudRev + 1;
      }
    }
    lastSyncAt = Date.now();
    meta.lastSyncedAt = lastSyncAt;
    meta.dirty = false;
    meta.userId = uid;
    meta.rev = rev;
    saveMeta();
    retryCount = 0;
    return 'ok';
  } catch (e) {
    console.warn('[sync] 上传失败：', e);
    if (retryCount < RETRY_MS.length) {
      const wait = RETRY_MS[retryCount++];
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void uploadSnapshot(), wait);
    }
    return 'fail';
  }
}

/** 云端快照的更新时间；没有则 null */
export async function cloudSnapshotAt(): Promise<number | null> {
  const sb = getSupabase();
  const session = await signedInSession();
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
  const session = await signedInSession();
  if (!sb || !session) return false;
  const { data, error } = await sb
    .from('snapshots')
    .select('data, rev')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !data?.data) return false;
  restoring = true;
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data.data));
    // rehydrate 会按 persist 的 version 跑 migrate（云端是老版本的快照也能接回来，D-202）
    await useAppStore.persist.rehydrate();
  } finally {
    setTimeout(() => {
      restoring = false;
    }, 500);
  }
  lastSyncAt = Date.now();
  meta.lastSyncedAt = lastSyncAt;
  meta.dirty = false;
  meta.userId = session.user.id;
  meta.rev = Number(data.rev) || 0;
  saveMeta();
  return true;
}

/** 删除云端数据（App Store 要求账号可删；试装先删数据 + 退出，账号本体删除待服务端函数） */
export async function deleteCloudData(): Promise<boolean> {
  const sb = getSupabase();
  const session = await signedInSession();
  if (!sb || !session) return false;
  const { error } = await sb.from('snapshots').delete().eq('user_id', session.user.id);
  if (error) {
    console.warn('[sync] 删除云端数据失败：', error);
    return false;
  }
  lastSyncAt = null;
  return true;
}

export type ReconcilePlan = 'push-first' | 'pull' | 'push' | 'conflict' | 'noop';

/**
 * 对账决策（纯函数，D-057 + D-096）——测试锁定：
 * - 云端没有备份 → 把本机第一份传上去；
 * - 这台手机没和这个账号对过账（新手机 / 重装 / 换账号）→ 本机不许覆盖云端：本机空 → 拉云端；本机有关系 → conflict 交给界面问；
 * - 之后照 D-057：本机有未同步改动 → 推（正在用的设备赢）；云端更新 → 拉；否则不动。
 */
export function planReconcile(input: {
  cloudAt: number | null;
  meta: SyncMeta;
  userId: string;
  localFresh: boolean;
}): ReconcilePlan {
  const { cloudAt, meta: m, userId, localFresh } = input;
  if (cloudAt == null) return 'push-first';
  // 没记过账号的旧存档（D-096 之前同步过的）视为同一账号，不打扰老用户
  const neverSyncedHere = m.lastSyncedAt === 0 || (m.userId !== undefined && m.userId !== userId);
  if (neverSyncedHere) return localFresh ? 'pull' : 'conflict';
  if (m.dirty) return 'push';
  if (cloudAt > m.lastSyncedAt + 1500) return 'pull';
  return 'noop';
}

/** 本机「还是空的」：没建过关系（羁绊 / 自创角色）、也没拍过照 / 写过记事本（D-202）——试聊记录属于免费层，本就会过期，不算 */
export function localIsFresh(): boolean {
  const s = useAppStore.getState();
  return !s.onboarded || (s.bonds.length === 0 && !s.customCharacters.some((c) => !c.shared) && s.album.length === 0 && s.notes.length === 0);
}

export type ReconcileResult = 'pulled' | 'pushed' | 'conflict' | 'noop';

let reconcileInflight: Promise<ReconcileResult> | null = null;

/**
 * 对账（D-057 云端为主；D-096 新设备以云端为准）。登录时、启动时、回线时都可调用；同一时刻只跑一份。
 * 返回 conflict 时什么都没动——登录界面负责问她并调 resolveConflict。
 */
export function reconcileNow(): Promise<ReconcileResult> {
  if (reconcileInflight) return reconcileInflight;
  reconcileInflight = doReconcile().finally(() => {
    reconcileInflight = null;
  });
  return reconcileInflight;
}

async function doReconcile(): Promise<ReconcileResult> {
  await loadMeta();
  const session = await signedInSession();
  if (!session) return 'noop';
  const cloudAt = await cloudSnapshotAt();
  const plan = planReconcile({ cloudAt, meta, userId: session.user.id, localFresh: localIsFresh() });
  switch (plan) {
    case 'push-first':
    case 'push': {
      const r = await uploadSnapshot();
      return r === 'ok' ? 'pushed' : 'noop';
    }
    case 'pull': {
      const ok = await restoreSnapshot();
      if (ok) console.log('[sync] 云端较新，已静默恢复');
      return ok ? 'pulled' : 'noop';
    }
    case 'conflict':
      return 'conflict';
    default:
      return 'noop';
  }
}

/** 新设备上本机与云端都有关系时（conflict），她选一边：接回云端 / 用本机覆盖云端 */
export async function resolveConflict(choice: 'use-cloud' | 'keep-local'): Promise<boolean> {
  if (choice === 'use-cloud') return restoreSnapshot();
  return (await uploadSnapshot()) === 'ok';
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
    if (!isSignedIn(session)) return;
    void syncAccountLanguage(useAppStore.getState().language); // D-163：邮件按账号语言
    void reconcileNow();
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

/**
 * 内购（RevenueCat，D-218）：整条购买路——身份、商品、一次购买、向服务器确认、启动 / 回前台补交。
 * 碰 SDK 的只有 lib/purchases.ts，纯规则在 lib/iap-rules.ts，服务器在 supabase/functions/iap（流程与坑：docs/revenuecat.md）。
 * - 身份：只有真登录（不是匿名游客）才连 RevenueCat，App User ID 用服务器发的随机 UUID（手机上存一份，拿不到就先不连）；签出只把购买藏起来、不 logOut。
 * - 一次购买：同一时间只许一笔；交易号先写进手机再问服务器；当场最多问一分钟（202 按它说的间隔、没回话 1/2/4/8 秒退避），
 *   之后说「还在确认中」并在 15 秒 / 30 秒 / 1 分钟 / 2 分钟各追问一次；同一笔只问一次、只说一次「已到账」。
 * - 启动 / 回前台：先交手机上留着的交易号，再「有理由才」全量读。
 * - 一个商品值多少只看服务器商品表；RevenueCat offering 里的包与它取交集才显示。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobs } from '@/core/jobs';
import { notify } from '@/core/turn';
import { getSupabase, onAuthChange, signedInSession } from '@/lib/auth';
import { t } from '@/lib/i18n';
import {
  addPending,
  ASK_TIMEOUT_MS,
  backoffMs,
  classifyBuyError,
  CONFIRM_WINDOW_MS,
  EMPTY_FULL_READ,
  FOLLOW_UPS_MS,
  fullReadReason,
  leavesPurchaseMark,
  prunePending,
  readSyncReply,
  type FullReadState,
  type PendingTxn,
  type SyncStatus,
} from '@/lib/iap-rules';
import { callFunction } from '@/lib/proxy';
import {
  buyPackage,
  IdentityMismatchError,
  identifyPurchases,
  loadPackages,
  onPurchasesChanged,
  oneTimePurchaseCount,
  purchaseErrorCode,
  purchasesSupported,
  restorePurchases,
  type StorePackage,
} from '@/lib/purchases';

/** 能买的一样东西：StoreKit 的价格 + 服务器商品表的内容 */
export interface StoreItem {
  productId: string;
  priceString: string;
  kind: 'traffic' | 'voice' | 'plan';
  mb: number;
  voiceSec: number;
  plan: 'pro' | 'max' | null;
  subscription: boolean;
  store: StorePackage;
}

/* ── 给界面的状态（useSyncExternalStore）── */

let ready: { userId: string; appUserId: string } | null = null;
let buying: string | null = null;
let items: StoreItem[] = [];
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version++;
  listeners.forEach((fn) => fn());
}
export function subscribeIap(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function iapVersion(): number {
  return version;
}
/** supported = 这个包能真买；ready = 已登录且 SDK 停在这个人身上；buying = 正在买的商品 */
export function iapState() {
  return { supported: purchasesSupported(), ready: !!ready, buying, items };
}

/* ── 手机上存的东西（按账号分开）── */

const idKey = (userId: string) => `everylove-iap-id:${userId}`;
const pendingKey = (userId: string) => `everylove-iap-pending:${userId}`;
const fullReadKey = (userId: string) => `everylove-iap-fullread:${userId}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJson(key: string, v: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
}

async function loadPending(userId: string): Promise<PendingTxn[]> {
  return prunePending(await readJson<PendingTxn[]>(pendingKey(userId), []), Date.now());
}
async function removePending(userId: string, txn: string): Promise<void> {
  await writeJson(pendingKey(userId), (await loadPending(userId)).filter((p) => p.transactionId !== txn));
}

/* ── 身份 ── */

/** 这个账号的 App User ID：手机上有就用（永不改，断网也能用同一个启动），没有才问服务器；都拿不到 = null（先不连，永远不退回账号 id） */
async function appUserIdFor(userId: string): Promise<string | null> {
  const cached = await AsyncStorage.getItem(idKey(userId)).catch(() => null);
  if (cached) return cached;
  try {
    const res = await callFunction('iap', { action: 'id' }, ASK_TIMEOUT_MS);
    const j = JSON.parse(res.text) as { userId?: string; appUserId?: string };
    // 答案里带着账号 id：核对是给这个人的
    if (res.ok && j.userId === userId && typeof j.appUserId === 'string') {
      await AsyncStorage.setItem(idKey(userId), j.appUserId).catch(() => {});
      return j.appUserId;
    }
  } catch (e) {
    console.warn('[iap] 拿不到 App User ID：', e);
  }
  return null;
}

let identifying: Promise<void> = Promise.resolve();

/** 让 SDK 停在现在登录的这个人身上；签出 / 拿不到 id 就把购买藏起来 */
export function identify(): Promise<void> {
  const run = async () => {
    if (!purchasesSupported()) return;
    const session = await signedInSession();
    const appUserId = session ? await appUserIdFor(session.user.id) : null;
    const ok = session && appUserId ? await identifyPurchases(appUserId).catch(() => false) : false;
    // 期间又换了人：以最新的为准，这一次作废
    const now = await signedInSession();
    ready = ok && session && appUserId && now?.user.id === session.user.id ? { userId: session.user.id, appUserId } : null;
    emit();
    if (ready) await refreshCatalog();
  };
  identifying = identifying.then(run, run).catch((e) => console.warn('[iap] 身份切换失败：', e));
  return identifying;
}

/* ── 商品：offering ∩ 服务器商品表 ── */

const KIND_ORDER = { plan: 0, traffic: 1, voice: 2 } as const;

async function refreshCatalog(): Promise<void> {
  try {
    const sb = getSupabase();
    const [pkgs, rows] = await Promise.all([
      loadPackages(),
      sb ? sb.from('iap_products').select('product_id, kind, mb, voice_sec, plan').eq('active', true) : Promise.resolve({ data: [] }),
    ]);
    const table = new Map(
      ((rows.data ?? []) as { product_id: string; kind: StoreItem['kind']; mb: number; voice_sec: number; plan: StoreItem['plan'] }[]).map((r) => [r.product_id, r])
    );
    items = pkgs
      .flatMap((p): StoreItem[] => {
        const r = table.get(p.productId);
        return r
          ? [{ productId: p.productId, priceString: p.priceString, kind: r.kind, mb: Number(r.mb), voiceSec: Number(r.voice_sec), plan: r.plan, subscription: p.subscription, store: p }]
          : [];
      })
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.plan === 'max' ? 1 : 0) - (b.plan === 'max' ? 1 : 0) || a.mb + a.voiceSec - (b.mb + b.voiceSec));
    emit();
  } catch (e) {
    console.warn('[iap] 读商品失败：', e);
  }
}

/* ── 向服务器确认 ── */

/** 问服务器一次：一笔交易 / 订阅权益 / 全量读（null） */
async function askServer(what: PendingTxn | 'subscription' | null): Promise<{ status: SyncStatus; retryAfterMs?: number } | null> {
  const body =
    what === null
      ? { action: 'sync' }
      : what === 'subscription' || what.subscription
        ? { action: 'sync', subscription: true }
        : { action: 'sync', transactionId: what.transactionId };
  try {
    const res = await callFunction('iap', body, what ? ASK_TIMEOUT_MS : 35_000);
    return readSyncReply(res.status, res.text);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 正在问的交易号：好几条路都可能交同一笔，只问一次 */
const asking = new Set<string>();
/** 已经说过「已到账」的 */
const announced = new Set<string>();

/** 问到有答案为止（最多 windowMs；0 = 只问一次）；返回服务器的结论，没问到 = null */
async function confirm(userId: string, p: PendingTxn, windowMs: number): Promise<SyncStatus | null> {
  if (asking.has(p.transactionId)) return null;
  asking.add(p.transactionId);
  try {
    const end = Date.now() + windowMs;
    for (let attempt = 0; ; ) {
      if (ready?.userId !== userId) return null;
      const r = await askServer(p);
      if (r && r.status !== 'pending') {
        await removePending(userId, p.transactionId);
        if ((r.status === 'credited' || r.status === 'already') && !announced.has(p.transactionId)) {
          announced.add(p.transactionId);
          notify(t('已到账'));
        }
        return r.status;
      }
      const wait = r ? (r.retryAfterMs ?? 3000) : backoffMs(attempt++);
      if (Date.now() + wait > end) return null;
      await sleep(wait);
    }
  } finally {
    asking.delete(p.transactionId);
  }
}

function followUp(userId: string, p: PendingTxn, step = 0): void {
  if (step >= FOLLOW_UPS_MS.length) return;
  setTimeout(async () => {
    // 换了账号就停；已经确认掉的（别的路交过）也停
    if (ready?.userId !== userId) return;
    if (!(await loadPending(userId)).some((x) => x.transactionId === p.transactionId)) return;
    if (!(await confirm(userId, p, 0))) followUp(userId, p, step + 1);
  }, FOLLOW_UPS_MS[step]);
}

/* ── 一次购买 ── */

export type BuyOutcome = 'credited' | 'confirming' | 'cancelled' | 'pending-approval' | 'not-allowed' | 'before-payment' | 'maybe-paid' | 'unavailable';

async function markPurchase(userId: string): Promise<void> {
  const s = await readJson<FullReadState>(fullReadKey(userId), EMPTY_FULL_READ);
  await writeJson(fullReadKey(userId), { ...s, purchaseMarkAt: Date.now() });
}

export async function buy(productId: string): Promise<BuyOutcome> {
  const who = ready;
  const item = items.find((i) => i.productId === productId);
  if (buying || !who || !item) return 'unavailable';
  buying = productId;
  emit();
  try {
    let res;
    try {
      res = await buyPackage(item.store, who.appUserId);
    } catch (e) {
      if (e instanceof IdentityMismatchError) {
        void identify();
        return 'unavailable';
      }
      const kind = classifyBuyError(purchaseErrorCode(e));
      if (leavesPurchaseMark(kind)) await markPurchase(who.userId);
      if (kind === 'maybe-paid') void catchUp();
      return kind === 'cancelled' ? 'cancelled' : kind;
    }
    await markPurchase(who.userId);
    const p: PendingTxn = { transactionId: res.transactionId ?? `sub-${Date.now()}`, productId, subscription: item.subscription, at: Date.now() };
    if (!res.transactionId && !item.subscription) {
      // 拿不到苹果交易号：全量读会补上
      void catchUp();
      return 'confirming';
    }
    await writeJson(pendingKey(who.userId), addPending(await loadPending(who.userId), p));
    const status = await confirm(who.userId, p, CONFIRM_WINDOW_MS);
    if (status === 'credited' || status === 'already') return 'credited';
    followUp(who.userId, p);
    return 'confirming';
  } finally {
    buying = null;
    emit();
  }
}

/** 恢复购买（订阅）：让 SDK 把这个 Apple ID 的购买交给 RevenueCat，再问服务器订阅与全量 */
export async function restore(): Promise<boolean> {
  const who = ready;
  if (!who) return false;
  try {
    await restorePurchases();
  } catch (e) {
    console.warn('[iap] 恢复购买失败：', e);
    return false;
  }
  const sub = await askServer('subscription');
  await askServer(null);
  return !!sub;
}

/* ── 启动 / 回前台：先交手机上留着的交易号，再有理由才全量读 ── */

async function catchUp(): Promise<void> {
  const who = ready;
  if (!who) return;
  for (const p of await loadPending(who.userId)) await confirm(who.userId, p, 0);
  const s = await readJson<FullReadState>(fullReadKey(who.userId), EMPTY_FULL_READ);
  const count = await oneTimePurchaseCount();
  const now = Date.now();
  const reason = fullReadReason(s, count, now);
  if (!reason) {
    if (count !== null && count < s.seenCount) await writeJson(fullReadKey(who.userId), { ...s, seenCount: count });
    return;
  }
  const r = await askServer(null);
  if (!r) return;
  await writeJson(fullReadKey(who.userId), {
    ...s,
    seenCount: count ?? s.seenCount,
    countReadAt: reason === 'count' ? now : s.countReadAt,
    markReadAt: reason === 'recent' ? now : s.markReadAt,
  });
}

jobs.register({
  id: 'iap-sync',
  on: ['launch', 'foreground'],
  run: async () => {
    if (!purchasesSupported()) return;
    if (!ready) await identify();
    await catchUp();
  },
});

if (purchasesSupported()) {
  onAuthChange(() => void identify());
  // 家长后来批准的、别处恢复的：客户信息一变就去补交
  onPurchasesChanged(() => void catchUp());
}

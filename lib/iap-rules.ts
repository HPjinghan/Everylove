/**
 * 内购的纯规则（D-218）：错误码分类、服务器答复的读法、追问节奏、什么时候全量读、手机上留着的交易号。
 * 全是纯函数（tests/iap.test.ts 用假时钟测）；碰 SDK 的只有 lib/purchases.ts，整条购买路在 features/iap.ts。
 */

/**
 * 确定发生在付款之前的错误码（PURCHASES_ERROR_CODE）：取消、等家长批准、这台手机关了购买、商品不卖、配置错误、商品请求超时、连不上 App Store。
 * 其余所有错误都可能已经扣了款——永远不说「购买失败」（docs/revenuecat.md 第 23 条）。
 */
const BEFORE_PAYMENT = new Set([
  '1', // PURCHASE_CANCELLED_ERROR
  '3', // PURCHASE_NOT_ALLOWED_ERROR
  '5', // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  '11', // INVALID_CREDENTIALS_ERROR
  '20', // PAYMENT_PENDING_ERROR（等家长批准：批了以后启动时会交上来）
  '23', // CONFIGURATION_ERROR
  '32', // PRODUCT_REQUEST_TIMED_OUT_ERROR
  '35', // OFFLINE_CONNECTION_ERROR
]);

export type BuyErrorKind = 'cancelled' | 'pending-approval' | 'not-allowed' | 'before-payment' | 'maybe-paid';

export function classifyBuyError(code: string | null): BuyErrorKind {
  if (code === '1') return 'cancelled';
  if (code === '20') return 'pending-approval';
  if (code === '3') return 'not-allowed';
  if (code && BEFORE_PAYMENT.has(code)) return 'before-payment';
  return 'maybe-paid';
}

/** 付款之前就结束的（取消、关了购买、连不上 App Store）不留「24 小时内开始过购买」的标记（第 27 条），否则白白触发一整天的全量读 */
export function leavesPurchaseMark(kind: BuyErrorKind | 'ok'): boolean {
  return kind === 'ok' || kind === 'maybe-paid' || kind === 'pending-approval';
}

/* ── 服务器的答复（supabase/functions/iap）── */

export type SyncStatus = 'credited' | 'refunded' | 'already' | 'pending';

/** 读 iap sync 的答复：2xx 不等于有答案——正文读不全、不是 JSON、没有 status 都算失败（下次再问） */
export function readSyncReply(status: number, text: string): { status: SyncStatus; retryAfterMs?: number } | null {
  if (status === 429) return { status: 'pending', retryAfterMs: 15_000 };
  if (status < 200 || status >= 300) return null;
  try {
    const j = JSON.parse(text) as { status?: unknown; retryAfterMs?: unknown };
    if (j.status !== 'credited' && j.status !== 'refunded' && j.status !== 'already' && j.status !== 'pending') return null;
    return { status: j.status, retryAfterMs: typeof j.retryAfterMs === 'number' ? j.retryAfterMs : undefined };
  } catch {
    return null;
  }
}

/* ── 追问节奏（第 24 条）── */

/** 每次问服务器自己的时限（短于包住它的那个等待） */
export const ASK_TIMEOUT_MS = 20_000;
/** 一次购买当场最多问多久；之后说「还在确认中」 */
export const CONFIRM_WINDOW_MS = 60_000;
/** 没回话时的退避（秒）：1、2、4、8 */
export function backoffMs(attempt: number): number {
  return Math.min(8, 2 ** attempt) * 1000;
}
/** 一分钟还没确认之后的追问：15 秒、30 秒、1 分钟、2 分钟 */
export const FOLLOW_UPS_MS = [15_000, 30_000, 60_000, 120_000];

/* ── 手机上留着的交易号（第 22 条：先写进手机、再问服务器；按账号分开、七天后丢、最多 20 笔）── */

export interface PendingTxn {
  transactionId: string;
  productId: string;
  subscription: boolean;
  at: number;
}

export const PENDING_MAX = 20;
export const PENDING_TTL_MS = 7 * 24 * 3600_000;

export function addPending(list: PendingTxn[], p: PendingTxn): PendingTxn[] {
  return prunePending([...list.filter((x) => x.transactionId !== p.transactionId), p], p.at);
}

export function prunePending(list: PendingTxn[], now: number): PendingTxn[] {
  return list.filter((x) => now - x.at < PENDING_TTL_MS).slice(-PENDING_MAX);
}

/* ── 启动 / 回前台：有理由才全量读（第 27 条）── */

export interface FullReadState {
  /** 这台手机上次看到的一次性购买数 */
  seenCount: number;
  /** 上次因为「数变多了」去读的时刻 */
  countReadAt: number;
  /** 最近一次在这台手机上开始购买的时刻（付款前就结束的不算） */
  purchaseMarkAt: number;
  /** 上次因为「24 小时内买过」去读的时刻 */
  markReadAt: number;
}

export const EMPTY_FULL_READ: FullReadState = { seenCount: 0, countReadAt: 0, purchaseMarkAt: 0, markReadAt: 0 };

/** 该不该全量读：RevenueCat 记着的一次性购买比上次多（至多每 30 秒）、或 24 小时内在这台手机上买过（至多每 10 分钟） */
export function fullReadReason(s: FullReadState, count: number | null, now: number): 'count' | 'recent' | null {
  if (count !== null && count > s.seenCount && now - s.countReadAt >= 30_000) return 'count';
  if (s.purchaseMarkAt && now - s.purchaseMarkAt < 24 * 3600_000 && now - s.markReadAt >= 10 * 60_000) return 'recent';
  return null;
}

/**
 * RevenueCat 服务端（D-218）：v2 API 读购买与权益、webhook 事件处理——iap / iap-webhook / iap-cron 三个函数共用。
 * 流程与坑见 docs/revenuecat.md（编号「第 n 条」指它）。钱的落账全在 SQL（supabase/iap.sql：iap_apply / iap_set_plan）。
 * Secrets：RC_SECRET_KEY（v2 secret key，权限：Customer information 的 Purchases 读 / Customers 读写 + Project configuration 的 Products 与 Entitlements 读）、RC_PROJECT_ID。
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { sqlEconomy, walletView, type Plan, type WalletRow, type WalletView } from './economy.ts';

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
export const ECONOMY = sqlEconomy();
export const BILLING_LIVE = Deno.env.get('BILLING_LIVE') === '1';

const RC_BASE = 'https://api.revenuecat.com/v2';

/** RevenueCat 调用失败：retryable = 429 / 423（客户正在被改，比如转移中）/ 5xx / 回话读不全，下次再问 */
export class RcError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export function rcConfigured(): boolean {
  return !!Deno.env.get('RC_SECRET_KEY') && !!Deno.env.get('RC_PROJECT_ID');
}

/** GET 一个 v2 路径（相对项目，或 next_page 给的完整路径）；2xx 但读不全也算失败（第 142 行：「没有」只能来自读完了的答案） */
async function rcGet<T>(path: string): Promise<T> {
  const key = Deno.env.get('RC_SECRET_KEY');
  const project = Deno.env.get('RC_PROJECT_ID');
  if (!key || !project) throw new RcError('revenuecat not configured', 503, false);
  const url = path.startsWith('/v2/') ? `https://api.revenuecat.com${path}` : `${RC_BASE}/projects/${project}${path}`;
  let r: Response;
  try {
    r = await fetch(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new RcError(`revenuecat fetch: ${e}`, 0, true);
  }
  const text = await r.text();
  if (!r.ok) throw new RcError(`revenuecat ${r.status}: ${text.slice(0, 160)}`, r.status, r.status === 423 || r.status === 429 || r.status >= 500);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RcError('revenuecat: bad json', r.status, true);
  }
}

type Page<T> = { items?: T[]; next_page?: string | null };

/** 读完一个列表（每页 100，按 next_page 往下翻）；items 不是数组 = 没读全 */
async function rcList<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = `${path}${path.includes('?') ? '&' : '?'}limit=100`;
  for (let i = 0; next && i < 50; i++) {
    const page: Page<T> = await rcGet<Page<T>>(next);
    if (!Array.isArray(page.items)) throw new RcError('revenuecat: list without items', 200, true);
    out.push(...page.items);
    next = page.next_page ?? null;
  }
  return out;
}

/* ── 商品与权益的 id 映射（第 20 条：v2 购买记录里的 product_id 是 RevenueCat 自己的 prod…，不是 App Store 的商品 ID）── */

let productMap = new Map<string, string>();
let productMapAt = 0;
let entitlementMap = new Map<string, string>();
let entitlementMapAt = 0;

/** RevenueCat 商品 id → App Store 商品 ID；没见过的 id 至多每分钟重读一次 */
export async function storeProductId(rcProductId: string): Promise<string | null> {
  if (!productMap.has(rcProductId) && Date.now() - productMapAt > 60_000) {
    const items = await rcList<{ id: string; store_identifier: string }>('/products');
    productMap = new Map(items.map((p) => [p.id, p.store_identifier]));
    productMapAt = Date.now();
  }
  return productMap.get(rcProductId) ?? null;
}

/** RevenueCat 权益 id → lookup_key（我们建的是 pro / max） */
async function entitlementKey(id: string): Promise<string | null> {
  if (!entitlementMap.has(id) && Date.now() - entitlementMapAt > 60_000) {
    const items = await rcList<{ id: string; lookup_key: string }>('/entitlements');
    entitlementMap = new Map(items.map((e) => [e.id, e.lookup_key]));
    entitlementMapAt = Date.now();
  }
  return entitlementMap.get(id) ?? null;
}

/* ── 账号 ── */

export async function appUserIdOf(userId: string): Promise<string> {
  const { data, error } = await admin.rpc('iap_app_user_id', { p_user: userId });
  if (error || !data) throw new Error(`iap_app_user_id: ${error?.message}`);
  return String(data);
}

/** 按 RevenueCat 报来的一串 id 找我们的账号（第 11 条：app_user_id / original_app_user_id / aliases 都查） */
async function userByIds(ids: (string | null | undefined)[]): Promise<string | null> {
  const list = ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (!list.length) return null;
  const { data, error } = await admin.rpc('iap_user_by_ids', { p_ids: list });
  if (error) throw new Error(`iap_user_by_ids: ${error.message}`);
  return (data as string | null) ?? null;
}

/* ── 订阅：权益为准 ── */

/** 读这个 App User ID 现在的权益 → 档位（max 优先）；客户在 RevenueCat 不存在 = 什么都没有 */
async function planOf(appUserId: string): Promise<{ plan: Plan; expiresAt: string | null }> {
  type Customer = { active_entitlements?: { items?: { entitlement_id: string; expires_at: number | null }[] } | null };
  let c: Customer;
  try {
    c = await rcGet<Customer>(`/customers/${encodeURIComponent(appUserId)}`);
  } catch (e) {
    if (e instanceof RcError && e.status === 404) return { plan: 'free', expiresAt: null };
    throw e;
  }
  let best: { plan: Plan; expires: number | null } = { plan: 'free', expires: null };
  for (const it of c.active_entitlements?.items ?? []) {
    const key = await entitlementKey(it.entitlement_id);
    const plan: Plan | null = key === 'max' ? 'max' : key === 'pro' ? 'pro' : null;
    if (!plan) continue;
    if (best.plan === 'free' || (plan === 'max' && best.plan === 'pro')) best = { plan, expires: it.expires_at };
  }
  return { plan: best.plan, expiresAt: best.expires ? new Date(best.expires).toISOString() : null };
}

export async function syncPlan(userId: string, tz: string | null = null): Promise<WalletRow> {
  const { plan, expiresAt } = await planOf(await appUserIdOf(userId));
  const { data, error } = await admin.rpc('iap_set_plan', { p_user: userId, p_plan: plan, p_expires_at: expiresAt, p_tz: tz, p_c: ECONOMY });
  if (error) throw new Error(`iap_set_plan: ${error.message}`);
  return (Array.isArray(data) ? data[0] : data) as WalletRow;
}

/* ── 消耗型：iap_apply ── */

export type ApplyResult = 'credited' | 'refunded' | 'already' | 'unknown_product' | 'unknown_user' | 'skipped';

async function apply(args: {
  txn: string;
  user: string | null;
  product: string;
  env: string | null;
  purchasedAt: string | null;
  state: 'owned' | 'refunded' | 'reinstated';
  eventMs: number | null;
  tz?: string | null;
}): Promise<ApplyResult> {
  const { data, error } = await admin.rpc('iap_apply', {
    p_store: 'app_store',
    p_txn: args.txn,
    p_user: args.user,
    p_product: args.product,
    p_env: args.env,
    p_purchased_at: args.purchasedAt,
    p_state: args.state,
    p_event_ms: args.eventMs,
    p_tz: args.tz ?? null,
    p_c: ECONOMY,
  });
  if (error) throw new Error(`iap_apply: ${error.message}`);
  return data as ApplyResult;
}

async function productKind(storeId: string): Promise<'traffic' | 'voice' | 'plan' | null> {
  const { data } = await admin.from('iap_products').select('kind').eq('product_id', storeId).maybeSingle();
  return (data?.kind as 'traffic' | 'voice' | 'plan' | undefined) ?? null;
}

/** v2 的一条购买记录 */
export interface RcPurchase {
  id: string;
  customer_id: string;
  original_customer_id: string;
  product_id: string;
  purchased_at: number;
  status: 'owned' | 'refunded';
  environment: 'production' | 'sandbox';
  store: string;
  store_purchase_identifier: string;
}

/** 从 API 读到的一条购买是「观察」：能补入账、能扣回退款，但不推进先后顺序（第 12 条） */
export async function applyObserved(p: RcPurchase, userId: string, tz: string | null = null): Promise<ApplyResult> {
  if (p.store !== 'app_store') return 'skipped';
  const storeId = await storeProductId(p.product_id);
  if (!storeId) return 'unknown_product';
  if ((await productKind(storeId)) === 'plan') return 'skipped';
  return apply({
    txn: String(p.store_purchase_identifier),
    user: userId,
    product: storeId,
    env: p.environment,
    purchasedAt: new Date(p.purchased_at).toISOString(),
    state: p.status === 'refunded' ? 'refunded' : 'owned',
    eventMs: null,
    tz,
  });
}

/** 按苹果交易号查（app 上报那条路、对账补查）；只认属于这个 App User ID 的 */
export async function purchasesByTransaction(txn: string): Promise<RcPurchase[]> {
  const page = await rcGet<Page<RcPurchase>>(`/purchases?store_purchase_identifier=${encodeURIComponent(txn)}`);
  if (!Array.isArray(page.items)) throw new RcError('revenuecat: purchases without items', 200, true);
  return page.items;
}

/** 一个人在 RevenueCat 的全部购买；客户不存在 = 空 */
export async function purchasesOfCustomer(appUserId: string): Promise<RcPurchase[]> {
  try {
    return await rcList<RcPurchase>(`/customers/${encodeURIComponent(appUserId)}/purchases`);
  } catch (e) {
    if (e instanceof RcError && e.status === 404) return [];
    throw e;
  }
}

/* ── webhook 事件（第 10 条：消耗型只有三种事件动钱；订阅类一律去读权益） ── */

export interface RcEvent {
  id: string;
  type: string;
  event_timestamp_ms: number;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  transaction_id?: string;
  purchased_at_ms?: number;
  environment?: string;
  store?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}

const PLAN_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

/** 处理一条事件：done = 处理完；ignored = 不归我们管；出错抛（收件箱记 failed、定时任务重试） */
export async function processEvent(ev: RcEvent): Promise<'done' | 'ignored'> {
  if (ev.type === 'TEST') return 'ignored';
  if (ev.store && ev.store !== 'APP_STORE') return 'ignored';

  if (ev.type === 'TRANSFER') {
    // 币不跟着走（第 14 条）；订阅权益两边各读一次
    let any = false;
    for (const id of [...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])]) {
      const u = await userByIds([id]);
      if (u) {
        await syncPlan(u);
        any = true;
      }
    }
    return any ? 'done' : 'ignored';
  }

  const user = await userByIds([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? [])]);
  if (PLAN_EVENTS.has(ev.type)) {
    if (!user) return 'ignored';
    await syncPlan(user);
    return 'done';
  }

  if (ev.type === 'NON_RENEWING_PURCHASE' || ev.type === 'CANCELLATION' || ev.type === 'REFUND_REVERSED') {
    const product = ev.product_id ?? '';
    const kind = await productKind(product);
    if (kind === 'plan' || (!kind && ev.type !== 'NON_RENEWING_PURCHASE')) {
      // 订阅的 CANCELLATION 多半是关了自动续订，不是退款：读权益为准
      if (!user) return 'ignored';
      await syncPlan(user);
      return 'done';
    }
    if (!ev.transaction_id) throw new Error(`${ev.type} without transaction_id`);
    const r = await apply({
      txn: ev.transaction_id,
      user,
      product,
      env: ev.environment ? ev.environment.toLowerCase() : null,
      purchasedAt: ev.purchased_at_ms ? new Date(ev.purchased_at_ms).toISOString() : null,
      state: ev.type === 'NON_RENEWING_PURCHASE' ? 'owned' : ev.type === 'CANCELLATION' ? 'refunded' : 'reinstated',
      eventMs: ev.event_timestamp_ms,
    });
    // 有人付了钱、商品表里没有：记 failed 并报警，补上那一行后重试入账（第 17 条）
    if (r === 'unknown_product') throw new Error(`unknown product ${product}`);
    // 我们库里找不到的人：不动钱
    if (r === 'unknown_user') return 'ignored';
    return 'done';
  }
  return 'ignored';
}

export function viewOf(w: WalletRow | null): WalletView | null {
  return w ? walletView(w, BILLING_LIVE) : null;
}

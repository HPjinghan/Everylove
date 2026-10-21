/**
 * 内购的 app 上报接口（D-218，要登录）：POST { action, transactionId?, subscription?, tz? }
 *   id    → { appUserId }：这个账号的 RevenueCat App User ID（服务器发的随机 UUID，docs/revenuecat.md 第 1 条）；匿名游客不发（买东西先登录）
 *   sync  → 交了苹果交易号：向 RevenueCat v2 核实（只认属于这个人的）后入账；subscription = true 时读权益定档位；
 *           不带交易号 = 全量读这个人的购买（每分钟至多一次）。返回 { status: credited | refunded | already | pending }，
 *           pending（202）= RevenueCat 还没记下这笔，稍后再问；最新钱包在响应头 x-wallet。
 * 不信客户端：商品值多少只看商品表，钱只按 RevenueCat 的记录入。限流每人每 10 分钟 30 次。
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  admin,
  appUserIdOf,
  applyObserved,
  ECONOMY,
  purchasesByTransaction,
  purchasesOfCustomer,
  RcError,
  rcConfigured,
  syncPlan,
  viewOf,
  type ApplyResult,
} from '../_shared/revenuecat.ts';
import type { WalletRow, WalletView } from '../_shared/economy.ts';

const JSON_HEADERS = { 'content-type': 'application/json' };

function json(body: unknown, status = 200, wallet?: WalletView | null): Response {
  return new Response(JSON.stringify(body), { status, headers: wallet ? { ...JSON_HEADERS, 'x-wallet': JSON.stringify(wallet) } : JSON_HEADERS });
}

async function walletOf(userId: string, tz: string | null): Promise<WalletView | null> {
  const { data } = await admin.rpc('wallet_open', { p_user: userId, p_tz: tz, p_c: ECONOMY });
  return viewOf((Array.isArray(data) ? data[0] : data) as WalletRow | null);
}

/** 每人每 10 分钟 30 次；超了返回还要等几秒 */
async function overLimit(userId: string): Promise<number> {
  await appUserIdOf(userId);
  const { data } = await admin.from('iap_app_user_ids').select('sync_window_at, sync_count').eq('user_id', userId).single();
  const start = data?.sync_window_at ? Date.parse(data.sync_window_at) : 0;
  const fresh = Date.now() - start > 10 * 60_000;
  const count = fresh ? 0 : (data?.sync_count ?? 0);
  if (count >= 30) return Math.ceil((start + 10 * 60_000 - Date.now()) / 1000);
  await admin
    .from('iap_app_user_ids')
    .update(fresh ? { sync_window_at: new Date().toISOString(), sync_count: 1 } : { sync_count: count + 1 })
    .eq('user_id', userId);
  return 0;
}

/** 我们账上已经有这笔：照实答（RevenueCat 读不到时用） */
async function fromBooks(userId: string, txn: string): Promise<'refunded' | 'already' | null> {
  const { data } = await admin.from('iap_transactions').select('user_id, refunded').eq('store', 'app_store').eq('transaction_id', txn).maybeSingle();
  if (!data || data.user_id !== userId) return null;
  return data.refunded ? 'refunded' : 'already';
}

function summarize(results: ApplyResult[]): 'credited' | 'refunded' | 'already' {
  if (results.includes('credited')) return 'credited';
  if (results.includes('refunded')) return 'refunded';
  return 'already';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = await asUser.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);
    // 匿名游客不连 RevenueCat：买东西先登录（D-215）
    if (user.is_anonymous) return json({ error: 'sign in first' }, 403);

    const body = (await req.json().catch(() => ({}))) as { action?: unknown; transactionId?: unknown; subscription?: unknown; tz?: unknown };
    const tz = typeof body.tz === 'string' && body.tz.length <= 64 ? body.tz : null;

    if (body.action === 'id') return json({ appUserId: await appUserIdOf(user.id), userId: user.id });
    if (body.action !== 'sync') return json({ error: 'bad request' }, 400);
    if (!rcConfigured()) return json({ error: 'revenuecat not configured' }, 503);

    const wait = await overLimit(user.id);
    if (wait > 0) return json({ error: 'rate_limited', retryAfterSec: wait }, 429);
    const appUserId = await appUserIdOf(user.id);

    // 订阅：读权益定档位
    if (body.subscription === true) {
      const w = await syncPlan(user.id, tz);
      return json({ status: w.plan === 'free' ? 'pending' : 'credited' }, w.plan === 'free' ? 202 : 200, viewOf(w));
    }

    // 消耗型：按苹果交易号核实
    if (typeof body.transactionId === 'string' && body.transactionId) {
      const txn = body.transactionId.slice(0, 255);
      let items;
      try {
        items = await purchasesByTransaction(txn);
      } catch (e) {
        const known = await fromBooks(user.id, txn);
        if (known) return json({ status: known }, 200, await walletOf(user.id, tz));
        console.warn('[iap] 核单读不到：', e);
        return json({ status: 'pending', retryAfterMs: 3000 }, 202);
      }
      const mine = items.filter((p) => p.customer_id === appUserId || p.original_customer_id === appUserId);
      if (!items.length) {
        // RevenueCat 还没记下（少见的竞态），或者 webhook 已经先入了账
        const known = await fromBooks(user.id, txn);
        if (known) return json({ status: known }, 200, await walletOf(user.id, tz));
        return json({ status: 'pending', retryAfterMs: 3000 }, 202);
      }
      if (!mine.length) return json({ error: 'not yours' }, 403);
      const results: ApplyResult[] = [];
      for (const p of mine) results.push(await applyObserved(p, user.id, tz));
      if (results.includes('unknown_product')) {
        // 商品 id 映射没读到（密钥缺 Products 读权限 / RevenueCat 出错）：账上有就照实答，没有就让 app 再问，webhook 照样会入账
        console.warn('[iap] 商品 id 映射失败或商品表里没有：', mine.map((p) => p.product_id).join(','));
        const known = await fromBooks(user.id, txn);
        if (known) return json({ status: known }, 200, await walletOf(user.id, tz));
        return json({ status: 'pending', retryAfterMs: 3000 }, 202);
      }
      return json({ status: summarize(results) }, 200, await walletOf(user.id, tz));
    }

    // 全量读：补丢在半路的购买、家长后来才批准的购买；同一个人每分钟至多一次
    const { data: row } = await admin.from('iap_app_user_ids').select('last_full_sync_at').eq('user_id', user.id).single();
    if (row?.last_full_sync_at && Date.now() - Date.parse(row.last_full_sync_at) < 60_000) {
      return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
    }
    await admin.from('iap_app_user_ids').update({ last_full_sync_at: new Date().toISOString() }).eq('user_id', user.id);
    const results: ApplyResult[] = [];
    for (const p of await purchasesOfCustomer(appUserId)) results.push(await applyObserved(p, user.id, tz));
    const w = await syncPlan(user.id, tz);
    return json({ status: summarize(results) }, 200, viewOf(w));
  } catch (e) {
    if (e instanceof RcError && e.retryable) return json({ status: 'pending', retryAfterMs: 5000 }, 202);
    console.error('[iap] internal error:', e);
    return json({ error: 'internal' }, 500);
  }
});

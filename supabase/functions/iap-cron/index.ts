/**
 * 内购定时任务（D-218）：pg_cron 每 10 分钟经 pg_net 调一次（supabase/iap.sql），头 x-cron-secret = Secrets IAP_CRON_SECRET（同一个值在 Vault 的 iap_cron_secret）。
 * 1. 重试收件箱里失败 / 卡住的 webhook 事件：从 5 分钟起翻倍、最长 12 小时，永不放弃（docs/revenuecat.md 第 7 条）。
 * 2. 对账：补 webhook 丢掉的退款。每轮 60 人：最近 120 天有仍有效的购买、或有真订阅的，7 天没核对过的，最久没核对的排前面。
 *    TRANSFER 之后原买家的购买列表是空的（§5 步骤 4）：账上仍有效、列表里却没有的交易按交易号逐笔补查（最新 30 笔）；有一笔没问到这个人就不算核对过。
 * 3. 报警盯结果：失败超过 1 小时的事件、该核对而超期的买家，有就打 error 日志（§8.1）。
 */

import {
  admin,
  applyObserved,
  processEvent,
  purchasesByTransaction,
  purchasesOfCustomer,
  rcConfigured,
  syncPlan,
  type RcEvent,
} from '../_shared/revenuecat.ts';

const CRON_SECRET = Deno.env.get('IAP_CRON_SECRET') ?? '';

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function retryEvents(): Promise<{ done: number; failed: number }> {
  const now = new Date().toISOString();
  const stuck = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await admin
    .from('iap_events')
    .select('id, attempts, status, event')
    .or(`and(status.eq.failed,next_retry_at.lte.${now}),and(status.eq.pending,received_at.lte.${stuck})`)
    .order('received_at')
    .limit(50);
  let done = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      const status = await processEvent(row.event as RcEvent);
      await admin.from('iap_events').update({ status, error: null }).eq('id', row.id);
      done++;
    } catch (e) {
      const attempts = (row.attempts ?? 0) + 1;
      const delay = Math.min(5 * 60_000 * 2 ** (attempts - 1), 12 * 3600_000);
      await admin
        .from('iap_events')
        .update({ status: 'failed', attempts, error: String(e).slice(0, 500), next_retry_at: new Date(Date.now() + delay).toISOString() })
        .eq('id', row.id);
      failed++;
    }
  }
  return { done, failed };
}

async function reconcile(): Promise<{ checked: number; skipped: number }> {
  const { data: batch, error } = await admin.rpc('iap_reconcile_batch', { p_limit: 60 });
  if (error) throw new Error(`iap_reconcile_batch: ${error.message}`);
  let checked = 0;
  let skipped = 0;
  for (const { user_id: userId, app_user_id: appUserId } of (batch ?? []) as { user_id: string; app_user_id: string }[]) {
    try {
      const listed = await purchasesOfCustomer(String(appUserId));
      const seen = new Set<string>();
      for (const p of listed) {
        seen.add(String(p.store_purchase_identifier));
        await applyObserved(p, userId);
      }
      const { data: ours } = await admin
        .from('iap_transactions')
        .select('transaction_id')
        .eq('user_id', userId)
        .eq('credited', true)
        .order('purchased_at', { ascending: false })
        .limit(30);
      for (const { transaction_id: txn } of ours ?? []) {
        if (seen.has(txn)) continue;
        // 退款按交易行找账号，不管它是从谁的列表读到的（第 14 条）：iap_apply 对已有的行不看传进去的人
        for (const p of await purchasesByTransaction(txn)) await applyObserved(p, userId);
      }
      await syncPlan(userId);
      await admin.from('iap_app_user_ids').update({ last_reconciled_at: new Date().toISOString() }).eq('user_id', userId);
      checked++;
    } catch (e) {
      console.warn(`[iap-cron] 对账 ${userId} 没读全，下轮再问：`, e);
      skipped++;
    }
  }
  return { checked, skipped };
}

async function alarms(): Promise<void> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: stale } = await admin.from('iap_events').select('id', { count: 'exact', head: true }).eq('status', 'failed').lte('received_at', hourAgo);
  if (stale) console.error(`[iap-cron][ALERT] ${stale} 条 webhook 事件失败超过 1 小时（可能有人付了钱还没到账）`);
  const { data: overdue } = await admin.rpc('iap_reconcile_overdue');
  if (overdue) console.error(`[iap-cron][ALERT] ${overdue} 个买家该对账而超期没读`);
}

Deno.serve(async (req) => {
  if (!sameSecret(req.headers.get('x-cron-secret') ?? '', CRON_SECRET)) return new Response('forbidden', { status: 403 });
  try {
    const events = await retryEvents();
    const rec = rcConfigured() ? await reconcile() : { checked: 0, skipped: 0, note: 'revenuecat not configured' };
    await alarms();
    return new Response(JSON.stringify({ events, reconcile: rec }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('[iap-cron] internal error:', e);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
  }
});

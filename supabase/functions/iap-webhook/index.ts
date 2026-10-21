/**
 * RevenueCat webhook（D-218，不要求登录：签名就是唯一的钥匙，supabase/config.toml verify_jwt = false）。
 * 先验签、再读任何字段（docs/revenuecat.md 第 6 条）：头 X-RevenueCat-Webhook-Signature: t=<秒>,v1=<hex>，HMAC-SHA256 签 "<t>.<原始 body>"，
 * 平台自带的常数时间 verify；t 与现在差 5 分钟以上拒（只拦重放）。没配密钥一律 503（RevenueCat 会重试约 80 分钟，期间配上就不丢）。
 * Secrets：RC_WEBHOOK_SECRETS（逗号分隔，轮换时新旧并存，第 9 条）；可选 RC_WEBHOOK_AUTH（集成里另设的固定 Authorization 值，设了就两样都要对）。
 * 先写下、再处理（第 7 条）：事件进收件箱 iap_events（主键 = 事件 id，重送原样答复）；处理出错记 failed、由 iap-cron 翻倍重试，仍回 200。
 * 只有收件箱根本没写进去才回非 200，让 RevenueCat 重送。
 */

import { admin, processEvent, type RcEvent } from '../_shared/revenuecat.ts';

const SECRETS = (Deno.env.get('RC_WEBHOOK_SECRETS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const AUTH = Deno.env.get('RC_WEBHOOK_AUTH') ?? '';
const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return null;
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function signatureOk(header: string | null, raw: Uint8Array<ArrayBuffer>): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=', 2) as [string, string]));
  const t = Number(parts.t);
  const sig = hexToBytes(parts.v1 ?? '');
  if (!Number.isFinite(t) || !sig) return false;
  const prefix = enc.encode(`${parts.t}.`);
  const data = new Uint8Array(new ArrayBuffer(prefix.length + raw.length));
  data.set(prefix);
  data.set(raw, prefix.length);
  let ok = false;
  for (const secret of SECRETS) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (await crypto.subtle.verify('HMAC', key, sig, data)) {
      ok = true;
      break;
    }
  }
  // 签名对了再看时间
  return ok && Math.abs(Date.now() / 1000 - t) <= 300;
}

/** 收件箱只存代码读的字段 */
function slim(ev: Record<string, unknown>): RcEvent {
  const keep = [
    'id',
    'type',
    'event_timestamp_ms',
    'app_user_id',
    'original_app_user_id',
    'aliases',
    'product_id',
    'transaction_id',
    'purchased_at_ms',
    'environment',
    'store',
    'transferred_from',
    'transferred_to',
    'price',
    'cancel_reason',
  ];
  return Object.fromEntries(keep.filter((k) => ev[k] !== undefined).map((k) => [k, ev[k]])) as unknown as RcEvent;
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!SECRETS.length) return new Response('webhook secret not configured', { status: 503 });
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await signatureOk(req.headers.get('x-revenuecat-webhook-signature'), raw))) return new Response('bad signature', { status: 401 });
  if (AUTH && req.headers.get('authorization') !== AUTH) return new Response('bad authorization', { status: 401 });

  let ev: RcEvent;
  try {
    const body = JSON.parse(new TextDecoder().decode(raw)) as { event?: Record<string, unknown> };
    if (!body.event || typeof body.event.id !== 'string' || typeof body.event.type !== 'string') throw new Error('no event');
    ev = slim(body.event);
  } catch {
    return new Response('bad body', { status: 400 });
  }

  // 先写下：重送的同一事件原样答复
  const { error: insertError } = await admin.from('iap_events').insert({ id: ev.id, type: ev.type, event: ev });
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[iap-webhook] 收件箱写不进去：', insertError);
      return new Response('inbox unavailable', { status: 500 });
    }
    const { data } = await admin.from('iap_events').select('status').eq('id', ev.id).single();
    if (data?.status === 'done' || data?.status === 'ignored') return ok({ status: data.status, duplicate: true });
  }

  try {
    const status = await processEvent(ev);
    await admin.from('iap_events').update({ status, error: null }).eq('id', ev.id);
    return ok({ status });
  } catch (e) {
    console.error(`[iap-webhook] ${ev.type} ${ev.id} 处理失败：`, e);
    const { data } = await admin.from('iap_events').select('attempts').eq('id', ev.id).single();
    const attempts = (data?.attempts ?? 0) + 1;
    await admin
      .from('iap_events')
      .update({ status: 'failed', attempts, error: String(e).slice(0, 500), next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq('id', ev.id);
    return ok({ status: 'failed' });
  }
});

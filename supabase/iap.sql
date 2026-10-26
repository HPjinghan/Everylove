-- 内购（RevenueCat，D-218）：在 supabase/wallet.sql 之后跑，幂等。流程与坑见 docs/revenuecat.md。
-- 三条路（webhook / app 上报交易号 / 定时对账）都走同一个 iap_apply：交易按（商店，交易号）唯一，谁先到谁入账，后到的什么都不改。
-- 锁的顺序固定：交易行 → 钱包（wallet_open）。钱的表不挂 auth.users 外键（删号留凭证）。

-- 商品表：一个商品值多少只写在这里（商品 ID 里不写数量，代码永远不解析 ID）。所有人可读，app 只显示这里有的
create table if not exists public.iap_products (
  product_id text primary key,
  kind text not null check (kind in ('traffic', 'voice', 'plan')),
  mb numeric not null default 0,
  voice_sec numeric not null default 0,
  plan text check (plan in ('pro', 'max')),
  active boolean not null default true
);
-- 流量包五档（D-239）；语音分钟包停售（D-236）：不再列给 app，老交易照旧能入账（iap_apply 不看 active）。重跑以本文件为准
insert into public.iap_products (product_id, kind, mb, voice_sec, plan, active) values
  ('ringring.pro.monthly', 'plan', 0, 0, 'pro', true),
  ('ringring.max.monthly', 'plan', 0, 0, 'max', true),
  ('ringring.traffic.s', 'traffic', 2500, 0, null, true),
  ('ringring.traffic.m', 'traffic', 5500, 0, null, true),
  ('ringring.traffic.l', 'traffic', 12000, 0, null, true),
  ('ringring.traffic.xl', 'traffic', 32000, 0, null, true),
  ('ringring.traffic.xxl', 'traffic', 65000, 0, null, true),
  ('ringring.voice.s', 'voice', 0, 1800, null, false),
  ('ringring.voice.m', 'voice', 0, 3600, null, false),
  ('ringring.voice.l', 'voice', 0, 10800, null, false)
on conflict (product_id) do update set
  kind = excluded.kind, mb = excluded.mb, voice_sec = excluded.voice_sec, plan = excluded.plan, active = excluded.active;

-- App User ID：服务器给每个账号发的随机 UUID（不用账号 id：知道 id 的人能以他的身份调 RevenueCat），第一次问时发、永不改
create table if not exists public.iap_app_user_ids (
  user_id uuid primary key,
  app_user_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 全量读与对账的节流
  last_full_sync_at timestamptz,
  last_reconciled_at timestamptz,
  sync_window_at timestamptz,
  sync_count integer not null default 0
);

-- 交易：一笔一行，行说「现在是什么」，钱包跟着行走
create table if not exists public.iap_transactions (
  store text not null,
  transaction_id text not null,
  -- 第一次见到时定下、永不改（TRANSFER 之后的退款也从这里扣）
  user_id uuid not null,
  product_id text not null,
  -- 第一次见到时按商品表定下，之后改价不影响
  mb numeric not null default 0,
  voice_sec numeric not null default 0,
  environment text,
  purchased_at timestamptz,
  refunded boolean not null default false,
  -- 钱包里现在算没算这笔
  credited boolean not null default false,
  refund_count integer not null default 0,
  reinstate_count integer not null default 0,
  last_refund_ms bigint,
  last_reinstate_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store, transaction_id)
);
create index if not exists iap_transactions_user on public.iap_transactions (user_id, purchased_at desc);

-- webhook 收件箱：先写下再处理；处理失败记 failed 由定时任务翻倍重试、永不放弃
create table if not exists public.iap_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'done', 'ignored', 'failed')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  error text,
  event jsonb not null
);
create index if not exists iap_events_retry on public.iap_events (next_retry_at) where status in ('pending', 'failed');

alter table public.iap_products enable row level security;
alter table public.iap_app_user_ids enable row level security;
alter table public.iap_transactions enable row level security;
alter table public.iap_events enable row level security;
drop policy if exists "products readable" on public.iap_products;
create policy "products readable" on public.iap_products for select using (true);
revoke insert, update, delete on table public.iap_products from anon, authenticated;
revoke all on table public.iap_app_user_ids from anon, authenticated;
revoke all on table public.iap_transactions from anon, authenticated;
revoke all on table public.iap_events from anon, authenticated;

-- 这个账号的 App User ID（没有就发一个）
create or replace function public.iap_app_user_id(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  insert into public.iap_app_user_ids (user_id) values (p_user) on conflict (user_id) do nothing;
  select app_user_id into id from public.iap_app_user_ids where user_id = p_user;
  return id;
end $$;

-- 按 RevenueCat 报来的一串 id（app_user_id / original_app_user_id / aliases）找我们的账号；找不到 = null
create or replace function public.iap_user_by_ids(p_ids text[])
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.iap_app_user_ids where app_user_id::text = any(p_ids) limit 1;
$$;

/*
 * 一笔消耗型交易的状态 → 钱包（D-218）。p_state：
 *   owned      购买成立（事件或 API 读到的）：没见过就记下并入账；见过的什么都不改（也不会撤销一次退款）
 *   refunded   退款（事件带时间，API 读到的不带）：扣回；比上一次撤销退款还旧的事件忽略；API 的观察永不推翻一次已宣布的撤销
 *   reinstated 撤销退款（只认带时间、且比它撤销的那次退款新的事件）；从没见过的交易 = 购买成立
 * 退款扣不够记欠账（debt_mb），余额永不为负；下一次买流量先还欠账。分钟包扣到 0 为止。
 * 返回：credited / refunded / already / unknown_product / unknown_user
 */
create or replace function public.iap_apply(
  p_store text, p_txn text, p_user uuid, p_product text, p_env text, p_purchased_at timestamptz,
  p_state text, p_event_ms bigint, p_tz text, p_c jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  t public.iap_transactions;
  prod public.iap_products;
  w public.wallets;
  want boolean;
  pay numeric;
  take numeric;
  v_idem text;
begin
  select * into t from public.iap_transactions where store = p_store and transaction_id = p_txn for update;
  if not found then
    select * into prod from public.iap_products where product_id = p_product;
    if not found or prod.kind = 'plan' then
      return 'unknown_product';
    end if;
    if p_user is null then
      return 'unknown_user';
    end if;
    insert into public.iap_transactions (store, transaction_id, user_id, product_id, mb, voice_sec, environment, purchased_at, refunded, refund_count, last_refund_ms)
    values (p_store, p_txn, p_user, p_product, prod.mb, prod.voice_sec, p_env, p_purchased_at,
            p_state = 'refunded', case when p_state = 'refunded' then 1 else 0 end, case when p_state = 'refunded' then p_event_ms end)
    on conflict (store, transaction_id) do nothing;
    select * into t from public.iap_transactions where store = p_store and transaction_id = p_txn for update;
  elsif p_state = 'refunded' and not t.refunded
        and ((p_event_ms is not null and p_event_ms > coalesce(t.last_reinstate_ms, 0)) or (p_event_ms is null and t.reinstate_count = 0)) then
    t.refunded := true;
    t.refund_count := t.refund_count + 1;
    t.last_refund_ms := coalesce(p_event_ms, t.last_refund_ms);
  elsif p_state = 'reinstated' and t.refunded and p_event_ms is not null and p_event_ms > coalesce(t.last_refund_ms, 0) then
    t.refunded := false;
    t.reinstate_count := t.reinstate_count + 1;
    t.last_reinstate_ms := p_event_ms;
  end if;

  want := not t.refunded;
  if want = t.credited then
    update public.iap_transactions set refunded = t.refunded, refund_count = t.refund_count, reinstate_count = t.reinstate_count,
      last_refund_ms = t.last_refund_ms, last_reinstate_ms = t.last_reinstate_ms, updated_at = now()
    where store = p_store and transaction_id = p_txn;
    return 'already';
  end if;

  w := public.wallet_open(t.user_id, p_tz, p_c);
  if want then
    pay := least(w.debt_mb, t.mb);
    w.debt_mb := w.debt_mb - pay;
    w.balance_mb := w.balance_mb + t.mb - pay;
    w.voice_pack_sec := w.voice_pack_sec + t.voice_sec;
    v_idem := 'iap:' || p_store || ':' || p_txn || case when t.reinstate_count > 0 then ':reinstate:' || t.reinstate_count else '' end;
  else
    take := least(w.balance_mb, t.mb);
    w.balance_mb := w.balance_mb - take;
    w.debt_mb := w.debt_mb + (t.mb - take);
    w.voice_pack_sec := greatest(0, w.voice_pack_sec - t.voice_sec);
    v_idem := 'iap:' || p_store || ':' || p_txn || ':refund:' || t.refund_count;
  end if;
  perform public._wallet_save(w);
  insert into public.wallet_ledger (user_id, kind, mb, charged_mb, sec, provider, idem)
  values (t.user_id, case when want then 'iap' else 'iap-refund' end, case when want then t.mb else -t.mb end, 0,
          case when want then t.voice_sec else -t.voice_sec end, t.product_id, v_idem)
  on conflict (idem) do nothing;
  update public.iap_transactions set refunded = t.refunded, credited = want, refund_count = t.refund_count, reinstate_count = t.reinstate_count,
    last_refund_ms = t.last_refund_ms, last_reinstate_ms = t.last_reinstate_ms, updated_at = now()
  where store = p_store and transaction_id = p_txn;
  return case when want then 'credited' else 'refunded' end;
end $$;

-- 订阅权益 → 档位（D-218）：RevenueCat 读到的 active entitlement 为准；free 只撤 iap 来的档位（试装模拟的不动）
create or replace function public.iap_set_plan(p_user uuid, p_plan text, p_expires_at timestamptz, p_tz text, p_c jsonb)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  changed boolean := false;
begin
  if p_plan = 'free' then
    if w.plan_source = 'iap' then
      w.plan := 'free';
      w.plan_expires_at := null;
    end if;
  else
    if w.plan <> p_plan then
      w := public._wallet_switch_plan(w, p_plan, p_c);
      changed := true;
    end if;
    w.plan_source := 'iap';
    w.plan_expires_at := p_expires_at;
  end if;
  perform public._wallet_save(w);
  -- 换到 Pro：这个月没发过的当场发
  if changed then
    w := public.wallet_open(p_user, p_tz, p_c);
  end if;
  return w;
end $$;

-- 对账这一轮读谁：最近 120 天有仍有效的购买、或有真订阅的，7 天没核对过的；最久没核对的在前（从没核对过的按建号时间，不让新来的永远插队）
create or replace function public.iap_reconcile_batch(p_limit integer)
returns table (user_id uuid, app_user_id uuid) language sql stable security definer set search_path = public as $$
  select a.user_id, a.app_user_id from public.iap_app_user_ids a
  where (a.last_reconciled_at is null or a.last_reconciled_at < now() - interval '7 days')
    and (exists (select 1 from public.iap_transactions t where t.user_id = a.user_id and t.credited and t.purchased_at > now() - interval '120 days')
         or exists (select 1 from public.wallets w where w.user_id = a.user_id and w.plan_source = 'iap' and w.plan <> 'free'))
  order by coalesce(a.last_reconciled_at, a.created_at)
  limit p_limit;
$$;

-- 该对账而超期没读的买家数（报警用：第一笔有效购买过了一天还没读过，或上次读已过 8 天）
create or replace function public.iap_reconcile_overdue()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.iap_app_user_ids a
  where exists (select 1 from public.iap_transactions t where t.user_id = a.user_id and t.credited and t.purchased_at > now() - interval '120 days')
    and ((a.last_reconciled_at is null and (select min(t.purchased_at) from public.iap_transactions t where t.user_id = a.user_id and t.credited) < now() - interval '1 day')
         or a.last_reconciled_at < now() - interval '8 days');
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.iap_reconcile_batch(integer)',
    'public.iap_reconcile_overdue()',
    'public.iap_app_user_id(uuid)',
    'public.iap_user_by_ids(text[])',
    'public.iap_apply(text, text, uuid, text, text, timestamptz, text, bigint, text, jsonb)',
    'public.iap_set_plan(uuid, text, timestamptz, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 定时任务（每 10 分钟调一次 iap-cron：重试失败的 webhook 事件 + 对账）。密钥在 Vault（iap_cron_secret），不进仓库
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('iap-cron') where exists (select 1 from cron.job where jobname = 'iap-cron');
select cron.schedule('iap-cron', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://ehdqdibvvzxcnzekqhmq.supabase.co/functions/v1/iap-cron',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'iap_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$cron$);

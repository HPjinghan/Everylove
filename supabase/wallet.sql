-- 流量 / 语音时长 / 订阅的服务器账（D-217）。幂等：在 SQL Editor 跑一遍，或经管理 API 执行。
-- 余额只在这里：客户端对两张表只能读自己的、不能写；所有写都经下面的 security definer 函数，只给 service_role 执行（Edge Function `ai` 调）。
-- 数值不写死在 SQL 里：每个函数收一个 p_c jsonb（supabase/functions/_shared/economy.ts sqlEconomy()）。
-- 钱的表不加指向 auth.users 的外键：删号时流水留作凭证（docs/revenuecat.md §3）。

create table if not exists public.wallets (
  user_id uuid primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'max')),
  plan_grant_at timestamptz,
  balance_mb numeric not null default 0 check (balance_mb >= 0),
  -- 退款扣不够记的欠账（接 RevenueCat 后用）
  debt_mb numeric not null default 0 check (debt_mb >= 0),
  -- 当天计数（按 tz 的自然日；换日一起清零）
  day date,
  free_used_mb numeric not null default 0,
  voice_used_sec numeric not null default 0,
  house_ktok numeric not null default 0,
  house_images integer not null default 0,
  house_tts_sec numeric not null default 0,
  voice_pack_sec numeric not null default 0 check (voice_pack_sec >= 0),
  call_bonus_sec numeric not null default 0 check (call_bonus_sec >= 0),
  call_tick_at timestamptz,
  tz text not null default 'UTC',
  tz_changed_at timestamptz,
  -- 收费开关打开前，把手机上试装攒下的余额搬上来一次
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_ledger (
  id bigserial primary key,
  user_id uuid not null,
  at timestamptz not null default now(),
  -- chat / image / vision / asr / grant / pack / voice-pack / plan / gm / import
  kind text not null,
  -- 这笔的用量（MB）与实际扣掉的（Max 不扣、免费额度先扣）
  mb numeric not null default 0,
  charged_mb numeric not null default 0,
  sec numeric not null default 0,
  tokens integer,
  provider text,
  estimated boolean not null default false
);
create index if not exists wallet_ledger_user_at on public.wallet_ledger (user_id, at desc);

alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
drop policy if exists "own wallet select" on public.wallets;
create policy "own wallet select" on public.wallets for select using (auth.uid() = user_id);
drop policy if exists "own ledger select" on public.wallet_ledger;
create policy "own ledger select" on public.wallet_ledger for select using (auth.uid() = user_id);
revoke insert, update, delete on table public.wallets from anon, authenticated;
revoke insert, update, delete on table public.wallet_ledger from anon, authenticated;

-- 写回一整行（各函数改完内存里的 w 用它落盘）
create or replace function public._wallet_save(w public.wallets)
returns void language sql security definer set search_path = public as $$
  update public.wallets set
    plan = w.plan, plan_grant_at = w.plan_grant_at, balance_mb = w.balance_mb, debt_mb = w.debt_mb,
    day = w.day, free_used_mb = w.free_used_mb, voice_used_sec = w.voice_used_sec,
    house_ktok = w.house_ktok, house_images = w.house_images, house_tts_sec = w.house_tts_sec,
    voice_pack_sec = w.voice_pack_sec, call_bonus_sec = w.call_bonus_sec, call_tick_at = w.call_tick_at,
    tz = w.tz, tz_changed_at = w.tz_changed_at, imported = w.imported, updated_at = now()
  where user_id = w.user_id;
$$;

-- 打开（并锁住）钱包：没有就建（送新用户的通话）、换时区、滚日、订阅到期发流量。所有写函数的第一句
create or replace function public.wallet_open(p_user uuid, p_tz text, p_c jsonb)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets;
  today date;
  period interval := make_interval(days => (p_c ->> 'grant_period_days')::int);
  monthly numeric := (p_c ->> 'pro_monthly_mb')::numeric;
  n int;
begin
  insert into public.wallets (user_id, call_bonus_sec) values (p_user, (p_c ->> 'new_user_call_sec')::numeric)
  on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id = p_user for update;
  -- 时区：认得的才换，20 小时内最多换一次（来回切时区多领不了每天免费的）
  if p_tz is not null and p_tz <> w.tz
     and (w.tz_changed_at is null or w.tz_changed_at < now() - interval '20 hours')
     and exists (select 1 from pg_timezone_names where name = p_tz) then
    w.tz := p_tz;
    w.tz_changed_at := now();
  end if;
  today := (now() at time zone w.tz)::date;
  if w.day is distinct from today then
    w.day := today;
    w.free_used_mb := 0;
    w.voice_used_sec := 0;
    w.house_ktok := 0;
    w.house_images := 0;
    w.house_tts_sec := 0;
  end if;
  -- Pro 每 30 天发一笔（最多补 2 笔）；Max 不限不发；Free 不发
  if w.plan = 'pro' and monthly > 0 then
    if w.plan_grant_at is null then
      n := 1;
      w.plan_grant_at := now();
    else
      n := least(2, floor(extract(epoch from now() - w.plan_grant_at) / extract(epoch from period))::int);
      if n > 0 then
        w.plan_grant_at := greatest(w.plan_grant_at + n * period, now() - period);
      end if;
    end if;
    if n > 0 then
      w.balance_mb := w.balance_mb + n * monthly;
      insert into public.wallet_ledger (user_id, kind, mb, charged_mb) values (p_user, 'grant', n * monthly, 0);
    end if;
  end if;
  perform public._wallet_save(w);
  return w;
end $$;

-- 扣语音秒数（内存里）：先今天的订阅额度，电话再用送的，最后分钟包；扣到 0 为止
create or replace function public._wallet_voice(w public.wallets, p_sec numeric, p_use text, p_c jsonb)
returns public.wallets language plpgsql immutable as $$
declare
  rest numeric := greatest(0, p_sec);
  take numeric;
begin
  take := least(rest, greatest(0, (p_c -> 'voice_daily_sec' ->> w.plan)::numeric - w.voice_used_sec));
  w.voice_used_sec := w.voice_used_sec + take;
  rest := rest - take;
  if p_use = 'call' then
    take := least(rest, w.call_bonus_sec);
    w.call_bonus_sec := w.call_bonus_sec - take;
    rest := rest - take;
  end if;
  take := least(rest, w.voice_pack_sec);
  w.voice_pack_sec := w.voice_pack_sec - take;
  return w;
end $$;

-- 一次生成之后记账：她的流量（先今天免费的、再余额，Max 不扣）/ TA 的语音秒数 / 后台保险丝；p_entry 有就记一行流水
create or replace function public.wallet_charge(
  p_user uuid, p_tz text, p_c jsonb,
  p_mb numeric, p_voice_sec numeric, p_voice_use text,
  p_house_ktok numeric, p_house_images integer, p_house_tts numeric,
  p_entry jsonb
) returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  free numeric := 0;
  bal numeric := 0;
begin
  if p_mb > 0 and w.plan <> 'max' then
    free := least(p_mb, greatest(0, (p_c ->> 'daily_free_mb')::numeric - w.free_used_mb));
    bal := least(p_mb - free, w.balance_mb);
    w.free_used_mb := w.free_used_mb + free;
    w.balance_mb := w.balance_mb - bal;
  end if;
  if p_voice_sec > 0 then
    w := public._wallet_voice(w, p_voice_sec, p_voice_use, p_c);
  end if;
  w.house_ktok := w.house_ktok + coalesce(p_house_ktok, 0);
  w.house_images := w.house_images + coalesce(p_house_images, 0);
  w.house_tts_sec := w.house_tts_sec + coalesce(p_house_tts, 0);
  perform public._wallet_save(w);
  if p_entry is not null then
    insert into public.wallet_ledger (user_id, kind, mb, charged_mb, tokens, provider, estimated)
    values (p_user, p_entry ->> 'kind', p_mb, free + bal, (p_entry ->> 'tokens')::int, p_entry ->> 'provider', coalesce((p_entry ->> 'estimated')::boolean, false));
  end if;
  return w;
end $$;

-- 通话计时（服务器时钟）：距上次计时的秒数（封顶 call_tick_max_sec）从语音时长里扣；太久没动静的算新的一通、不往回补
create or replace function public.wallet_call_tick(p_user uuid, p_tz text, p_c jsonb, p_end boolean)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  gap numeric;
begin
  if w.call_tick_at is not null then
    gap := extract(epoch from now() - w.call_tick_at);
    if gap <= (p_c ->> 'call_alive_sec')::numeric then
      w := public._wallet_voice(w, least(gap, (p_c ->> 'call_tick_max_sec')::numeric), 'call', p_c);
    end if;
  end if;
  w.call_tick_at := case when p_end then null else now() end;
  perform public._wallet_save(w);
  return w;
end $$;

-- 到账：流量包 / 语音分钟包 / 换订阅档 / GM（收费开关打开前点即到账；之后只给 RevenueCat 的入账用）
create or replace function public.wallet_grant(p_user uuid, p_tz text, p_c jsonb, p_mb numeric, p_voice_sec numeric, p_plan text, p_kind text)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  changed boolean := p_plan is not null and p_plan <> w.plan;
begin
  if changed then
    w.plan := p_plan;
    w.plan_grant_at := null;
  end if;
  w.balance_mb := w.balance_mb + coalesce(p_mb, 0);
  w.voice_pack_sec := w.voice_pack_sec + coalesce(p_voice_sec, 0);
  perform public._wallet_save(w);
  insert into public.wallet_ledger (user_id, kind, mb, charged_mb, sec) values (p_user, p_kind, coalesce(p_mb, 0), 0, coalesce(p_voice_sec, 0));
  -- 换到 Pro：当场发这个月的
  if changed then
    w := public.wallet_open(p_user, p_tz, p_c);
  end if;
  return w;
end $$;

-- 一次性搬家：试装期手机上的余额 / 分钟包 / 订阅档搬到服务器（有上限；搬过就不再搬）
create or replace function public.wallet_import(p_user uuid, p_tz text, p_c jsonb, p_plan text, p_mb numeric, p_pack_sec numeric, p_bonus_sec numeric)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
begin
  if w.imported then
    return w;
  end if;
  w.imported := true;
  if p_plan in ('free', 'pro', 'max') then
    w.plan := p_plan;
    -- 这个月的手机上已经发过了
    w.plan_grant_at := case when p_plan = 'pro' then now() else null end;
  end if;
  w.balance_mb := w.balance_mb + least(greatest(coalesce(p_mb, 0), 0), 100000);
  w.voice_pack_sec := w.voice_pack_sec + least(greatest(coalesce(p_pack_sec, 0), 0), 36000);
  w.call_bonus_sec := least(greatest(coalesce(p_bonus_sec, w.call_bonus_sec), 0), (p_c ->> 'new_user_call_sec')::numeric);
  perform public._wallet_save(w);
  insert into public.wallet_ledger (user_id, kind, mb, charged_mb, sec) values (p_user, 'import', least(greatest(coalesce(p_mb, 0), 0), 100000), 0, least(greatest(coalesce(p_pack_sec, 0), 0), 36000));
  return w;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public._wallet_save(public.wallets)',
    'public.wallet_open(uuid, text, jsonb)',
    'public._wallet_voice(public.wallets, numeric, text, jsonb)',
    'public.wallet_charge(uuid, text, jsonb, numeric, numeric, text, numeric, integer, numeric, jsonb)',
    'public.wallet_call_tick(uuid, text, jsonb, boolean)',
    'public.wallet_grant(uuid, text, jsonb, numeric, numeric, text, text)',
    'public.wallet_import(uuid, text, jsonb, text, numeric, numeric, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

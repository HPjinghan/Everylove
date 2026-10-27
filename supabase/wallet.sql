-- 流量 / 订阅 / TA 的声音的服务器账（D-217；D-240：声音按分钟、不扣流量——订阅每期给的分钟 + 新用户送的通话 + 分钟包）。幂等：在 SQL Editor 跑一遍，或经管理 API 执行。
-- 余额只在这里：客户端对两张表只能读自己的、不能写；所有写都经下面的 security definer 函数，只给 service_role 执行（Edge Function `ai` 调）。
-- 数值不写死在 SQL 里：每个函数收一个 p_c jsonb（supabase/functions/_shared/economy.ts sqlEconomy()）。
-- 钱的表不加指向 auth.users 的外键：删号时流水留作凭证（docs/revenuecat.md §3）。

create table if not exists public.wallets (
  user_id uuid primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'max')),
  plan_grant_at timestamptz,
  -- 档位从哪来（D-218）：sim = 收费开关打开前的模拟；iap = RevenueCat 的订阅权益，到期自动回 Free
  plan_source text not null default 'sim' check (plan_source in ('sim', 'iap')),
  plan_expires_at timestamptz,
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
-- 这一期订阅给的语音分钟还剩几秒（D-240：随流量一起发，下一期清零重给）
alter table public.wallets add column if not exists plan_voice_sec numeric not null default 0 check (plan_voice_sec >= 0);
alter table public.wallets add column if not exists plan_source text not null default 'sim' check (plan_source in ('sim', 'iap'));
alter table public.wallets add column if not exists plan_expires_at timestamptz;
-- 她发起的用量今天累计（D-219：只拿来管 Max 的合理使用，所有档都记）
alter table public.wallets add column if not exists fair_ktok numeric not null default 0;
alter table public.wallets add column if not exists fair_images integer not null default 0;
-- Max 过线降速的两条车道（D-220）：下一个号最早什么时候能用；只由 wallet_slow_slot 写，_wallet_save 不碰
alter table public.wallets add column if not exists slow_chat_at timestamptz;
alter table public.wallets add column if not exists slow_image_at timestamptz;
-- 内购入账 / 退款扣回 / 撤销退款各自的幂等键（D-218：iap:<商店>:<交易号>[:refund:n | :reinstate:n]）
alter table public.wallet_ledger add column if not exists idem text unique;
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
    plan = w.plan, plan_grant_at = w.plan_grant_at, plan_source = w.plan_source, plan_expires_at = w.plan_expires_at, balance_mb = w.balance_mb, debt_mb = w.debt_mb,
    day = w.day, free_used_mb = w.free_used_mb, voice_used_sec = w.voice_used_sec,
    house_ktok = w.house_ktok, house_images = w.house_images, house_tts_sec = w.house_tts_sec,
    fair_ktok = w.fair_ktok, fair_images = w.fair_images,
    plan_voice_sec = w.plan_voice_sec, voice_pack_sec = w.voice_pack_sec, call_bonus_sec = w.call_bonus_sec, call_tick_at = w.call_tick_at,
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
  monthly numeric;
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
  -- 真订阅到期（D-218）：过了到期时间 10 分钟还没续上就回 Free；续订事件到了会再升回来
  if w.plan_source = 'iap' and w.plan <> 'free' and w.plan_expires_at is not null and w.plan_expires_at < now() - interval '10 minutes' then
    w.plan := 'free';
  end if;
  today := (now() at time zone w.tz)::date;
  if w.day is distinct from today then
    w.day := today;
    w.free_used_mb := 0;
    w.voice_used_sec := 0;
    w.house_ktok := 0;
    w.house_images := 0;
    w.house_tts_sec := 0;
    w.fair_ktok := 0;
    w.fair_images := 0;
  end if;
  -- Pro / Max 每 30 天发一笔流量（最多补 2 笔）+ 这一期的语音分钟（清零重给、不累积，D-240）；Free 两样都没有
  if w.plan = 'free' then
    w.plan_voice_sec := 0;
  end if;
  monthly := coalesce((p_c -> 'plan_monthly_mb' ->> w.plan)::numeric, case when w.plan = 'pro' then (p_c ->> 'pro_monthly_mb')::numeric else 0 end);
  if w.plan in ('pro', 'max') and monthly > 0 then
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
      w.plan_voice_sec := coalesce((p_c -> 'plan_voice_sec' ->> w.plan)::numeric, 0);
      insert into public.wallet_ledger (user_id, kind, mb, charged_mb, sec) values (p_user, 'grant', n * monthly, 0, w.plan_voice_sec);
    end if;
  end if;
  perform public._wallet_save(w);
  return w;
end $$;

-- 扣 TA 的声音（内存里，D-240）：电话先用送的，然后这一期订阅的分钟，最后分钟包；扣到 0 为止，不碰流量。
-- voice_used_sec 只记今天用了多少秒
create or replace function public._wallet_voice(w public.wallets, p_sec numeric, p_use text, p_c jsonb)
returns public.wallets language plpgsql immutable as $$
declare
  rest numeric := greatest(0, p_sec);
  take numeric;
begin
  w.voice_used_sec := w.voice_used_sec + rest;
  if p_use = 'call' then
    take := least(rest, w.call_bonus_sec);
    w.call_bonus_sec := w.call_bonus_sec - take;
    rest := rest - take;
  end if;
  take := least(rest, w.plan_voice_sec);
  w.plan_voice_sec := w.plan_voice_sec - take;
  rest := rest - take;
  take := least(rest, w.voice_pack_sec);
  w.voice_pack_sec := w.voice_pack_sec - take;
  return w;
end $$;

-- 一次生成之后记账：她的流量（先今天免费的、再余额）/ TA 的语音（按秒扣分钟）/ 后台保险丝 / 合理使用计数；p_entry 有就记一行流水
-- D-219 加了两个带默认值的参数：先删旧签名再建（同一次执行里），没升级的代理按名字传参照样能调
drop function if exists public.wallet_charge(uuid, text, jsonb, numeric, numeric, text, numeric, integer, numeric, jsonb);
create or replace function public.wallet_charge(
  p_user uuid, p_tz text, p_c jsonb,
  p_mb numeric, p_voice_sec numeric, p_voice_use text,
  p_house_ktok numeric, p_house_images integer, p_house_tts numeric,
  p_entry jsonb,
  p_fair_ktok numeric default 0, p_fair_images integer default 0
) returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  free numeric := 0;
  bal numeric := 0;
begin
  if p_mb > 0 then
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
  w.fair_ktok := w.fair_ktok + coalesce(p_fair_ktok, 0);
  w.fair_images := w.fair_images + coalesce(p_fair_images, 0);
  perform public._wallet_save(w);
  if p_entry is not null then
    insert into public.wallet_ledger (user_id, kind, mb, charged_mb, sec, tokens, provider, estimated)
    values (p_user, p_entry ->> 'kind', p_mb, free + bal, coalesce(p_voice_sec, 0), (p_entry ->> 'tokens')::int, p_entry ->> 'provider', coalesce((p_entry ->> 'estimated')::boolean, false));
  end if;
  return w;
end $$;

-- 通话计时（服务器时钟）：距上次计时的秒数（封顶 call_tick_max_sec）按接通时长扣（送的通话 → 订阅的分钟 → 分钟包）；太久没动静的算新的一通、不往回补
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
-- 换档位时这个月发没发过（D-218）：30 天内发过的不再发（来回切档白拿不了），更早的作废、换上去当场发一笔；
-- 升到额度更大的档（Pro → Max）当场发新档的一整笔（流量 + 分钟）
create or replace function public._wallet_switch_plan(w public.wallets, p_plan text, p_c jsonb)
returns public.wallets language plpgsql immutable as $$
begin
  if w.plan_grant_at is not null and w.plan_grant_at <= now() - make_interval(days => (p_c ->> 'grant_period_days')::int) then
    w.plan_grant_at := null;
  end if;
  if coalesce((p_c -> 'plan_monthly_mb' ->> p_plan)::numeric, 0) > coalesce((p_c -> 'plan_monthly_mb' ->> w.plan)::numeric, 0) then
    w.plan_grant_at := null;
  end if;
  w.plan := p_plan;
  return w;
end $$;

create or replace function public.wallet_grant(p_user uuid, p_tz text, p_c jsonb, p_mb numeric, p_voice_sec numeric, p_plan text, p_kind text)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare
  w public.wallets := public.wallet_open(p_user, p_tz, p_c);
  changed boolean := p_plan is not null and p_plan <> w.plan;
begin
  if changed then
    w := public._wallet_switch_plan(w, p_plan, p_c);
    w.plan_source := 'sim';
    w.plan_expires_at := null;
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
  if p_plan in ('free', 'pro', 'max') and w.plan_source = 'sim' then
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

-- 领一个慢车道的号（D-220）：返回要等几秒；要等的超过 p_max_wait 返回 -1 且不占号。同一行加锁，并发的请求依次排开
create or replace function public.wallet_slow_slot(p_user uuid, p_lane text, p_gap numeric, p_max_wait numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz;
  v_next timestamptz;
  v_wait numeric;
begin
  select case when p_lane = 'image' then slow_image_at else slow_chat_at end into v_at
  from public.wallets where user_id = p_user for update;
  v_next := greatest(now(), coalesce(v_at, now()));
  v_wait := extract(epoch from v_next - now());
  if v_wait > p_max_wait then
    return -1;
  end if;
  if p_lane = 'image' then
    update public.wallets set slow_image_at = v_next + make_interval(secs => p_gap) where user_id = p_user;
  else
    update public.wallets set slow_chat_at = v_next + make_interval(secs => p_gap) where user_id = p_user;
  end if;
  return round(v_wait, 1);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public._wallet_save(public.wallets)',
    'public.wallet_open(uuid, text, jsonb)',
    'public._wallet_voice(public.wallets, numeric, text, jsonb)',
    'public._wallet_switch_plan(public.wallets, text, jsonb)',
    'public.wallet_charge(uuid, text, jsonb, numeric, numeric, text, numeric, integer, numeric, jsonb, numeric, integer)',
    'public.wallet_call_tick(uuid, text, jsonb, boolean)',
    'public.wallet_grant(uuid, text, jsonb, numeric, numeric, text, text)',
    'public.wallet_import(uuid, text, jsonb, text, numeric, numeric, numeric)',
    'public.wallet_slow_slot(uuid, text, numeric, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 云备份建表（D-054）：在 Supabase Dashboard → SQL Editor 里跑一次。
-- 另外在 Dashboard → Authentication → Providers 里：
--   1. 开启 Email（勾选 Email OTP / 关闭 "Confirm email" 也可，OTP 即验证）
--   2. 开启 Apple（Services ID 用 Expo Go 时填 host.exp.Exponent；正式 dev build 换自己的 bundle id）

create table if not exists public.snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

-- 只许本人读写自己的快照
create policy "own snapshot select" on public.snapshots
  for select using (auth.uid() = user_id);
create policy "own snapshot insert" on public.snapshots
  for insert with check (auth.uid() = user_id);
create policy "own snapshot update" on public.snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshot delete" on public.snapshots
  for delete using (auth.uid() = user_id);

-- 共享角色池（D-060）与共享世界池（D-111）：所有人可读（含匿名），只有本人可写删。
create table if not exists public.shared_characters (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.shared_characters enable row level security;
create policy "shared characters read" on public.shared_characters for select using (true);
create policy "shared characters insert" on public.shared_characters for insert with check (auth.uid() = owner_id);
create policy "shared characters update" on public.shared_characters for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "shared characters delete" on public.shared_characters for delete using (auth.uid() = owner_id);

-- shared_worlds：世界书已下线（D-150），这张表留着不用；新环境可以不建
create table if not exists public.shared_worlds (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.shared_worlds enable row level security;
create policy "shared worlds read" on public.shared_worlds for select using (true);
create policy "shared worlds insert" on public.shared_worlds for insert with check (auth.uid() = owner_id);
create policy "shared worlds update" on public.shared_worlds for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "shared worlds delete" on public.shared_worlds for delete using (auth.uid() = owner_id);

-- AI 代理用量（D-057 / D-166）：Edge Function `ai` 按人按天计次。
-- 客户端（anon / authenticated）对这张表**没有任何权限**：开 RLS 且不建 policy、再显式 revoke；
-- 只有函数 increment_ai_usage（security definer，只给 service_role 执行）能改它——Edge Function 用 service role 调它，原子自增、到线不加。
-- 老环境若已有同名表（早期经管理 API 建的），下面的语句都是幂等的：跑一遍即可收权 + 建函数。
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day text not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

create or replace function public.increment_ai_usage(p_user uuid, p_day text, p_limit integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  where ai_usage.count < p_limit
  returning count;
$$;
revoke all on function public.increment_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, text, integer) to service_role;

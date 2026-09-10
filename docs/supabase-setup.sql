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

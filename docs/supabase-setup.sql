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

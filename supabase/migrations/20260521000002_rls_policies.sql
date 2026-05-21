-- Vibe Mailer — Row Level Security 정책
-- 수강생: 자기 자신의 데이터만 조회 가능
-- 관리자(profiles.is_admin = true): 모든 데이터 조회 가능
-- 쓰기는 Edge Function의 service_role 키로 RLS bypass

-- =========================================================
-- profiles
-- =========================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- name 정도만 본인이 수정. current_status / is_admin 은 server-side 에서만 변경
drop policy if exists "profiles_self_update_name" on public.profiles;
create policy "profiles_self_update_name"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =========================================================
-- action_logs
-- =========================================================
alter table public.action_logs enable row level security;

drop policy if exists "action_logs_self_select" on public.action_logs;
create policy "action_logs_self_select"
  on public.action_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "action_logs_admin_select_all" on public.action_logs;
create policy "action_logs_admin_select_all"
  on public.action_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT는 Edge Function(service_role)에서만. 클라이언트 직접 INSERT 금지.
-- 정책을 명시하지 않으면 RLS 활성 + 정책 부재 = 거부 → 의도된 동작.

-- =========================================================
-- email_logs
-- =========================================================
alter table public.email_logs enable row level security;

drop policy if exists "email_logs_self_select" on public.email_logs;
create policy "email_logs_self_select"
  on public.email_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "email_logs_admin_select_all" on public.email_logs;
create policy "email_logs_admin_select_all"
  on public.email_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT/UPDATE는 service_role 전용 (정책 없음 → 클라이언트 거부)

-- =========================================================
-- 익명 SELECT 차단 (명시적)
-- =========================================================
revoke all on public.profiles from anon;
revoke all on public.action_logs from anon;
revoke all on public.email_logs from anon;

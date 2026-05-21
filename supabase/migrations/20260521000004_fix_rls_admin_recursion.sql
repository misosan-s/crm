-- Vibe Mailer — RLS 무한 재귀 fix
-- 문제: profiles_admin_select_all 가 EXISTS(SELECT FROM profiles ...) 로 자기 자신을 조회 →
--       그 inner SELECT 가 다시 같은 정책을 평가 → infinite recursion
-- 해결: is_admin 체크를 SECURITY DEFINER 함수로 캡슐화하여 RLS 우회 (재귀 끊김)

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

-- =========================================================
-- profiles
-- =========================================================
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_current_user_admin());

-- =========================================================
-- action_logs
-- =========================================================
drop policy if exists "action_logs_admin_select_all" on public.action_logs;
create policy "action_logs_admin_select_all"
  on public.action_logs
  for select
  to authenticated
  using (public.is_current_user_admin());

-- =========================================================
-- email_logs
-- =========================================================
drop policy if exists "email_logs_admin_select_all" on public.email_logs;
create policy "email_logs_admin_select_all"
  on public.email_logs
  for select
  to authenticated
  using (public.is_current_user_admin());

-- Data API explicit grants — Supabase 2026-10-30 public 기본 권한 변경 대응 (https://github.com/orgs/supabase/discussions/45329)
-- 근거: D:\OneDrive\AI\Claude\supabase\team\2026-10-21-public-grants\ (04-개발-데이터.md · harness/ 의 CRM (가) 옛 기본값 재생 − (다) 회수 기본값 재생 차이)
-- 이 파일은 옛 기본값을 재현하는 GRANT 보충이다(운영에서는 이미 가진 권한 — precheck already_held). 이후 의도적 권한 축소(anon 회수 등)는 이 파일을 고치지 말고 별도 마이그레이션으로 한다.
-- 함수·시퀀스는 anon 에 주지 않는다(03-보안 통제 1·2). 표·뷰의 anon 은 맨 아래 블록에 따로 모았다.

-- tables
grant select, insert, update, delete on table public.action_logs to authenticated, service_role;
grant select, insert, update, delete on table public.email_logs to authenticated, service_role;
grant select, insert, update, delete on table public.profiles to authenticated, service_role;

-- functions (PUBLIC 에서 회수됐고 역할 기본 권한에만 기대던 것)
grant execute on function public.is_current_user_admin() to service_role;

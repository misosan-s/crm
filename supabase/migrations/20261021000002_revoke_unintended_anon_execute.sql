-- P1 의도 없이 남은 실행권 회수 — 옛 Supabase 기본 권한이 anon 에 직접 준 EXECUTE 는 `revoke … from public` 으로 지워지지 않았다.
-- 사이클: D:\OneDrive\AI\Claude\supabase\team\2026-10-21-public-grants-2\ (04-개발-데이터.md) · 근거: 직전 사이클 …\2026-10-21-public-grants\03-보안.md §2·§3·§7 P1, 03-보안-부록 A, 03-데이터-부록 C-3
-- 대상만: is_current_user_admin() 의 anon EXECUTE. 정책(to authenticated) 안에서만 쓰이고 anon 호출자는 없다(anon 이 불러도 false 만 돌려줬다).
-- authenticated·service_role 권한은 건드리지 않는다. 이미 없는 권한의 REVOKE 는 아무 일도 하지 않는다(멱등).
-- 되돌리기(운영 롤백 시에만, 김약사 확인 뒤): grant execute on function public.is_current_user_admin() to anon;

revoke execute on function public.is_current_user_admin() from anon;

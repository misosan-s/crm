<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 데이터·DB (Supabase 마이그레이션)

- **Data API 권한(2026-10-30~)**: public 에 표·뷰·시퀀스·함수를 만드는 마이그레이션은 같은 파일에 `create` → `enable row level security` → 정책(`to authenticated` 처럼 역할 명시) → `grant`(필요한 역할·권한만, 기본 `authenticated, service_role`) 순으로 쓴다. grant 가 없으면 Data API 가 42501 로 거절한다(github.com/orgs/supabase/discussions/45329).
- `anon` grant 는 개인정보 열이 없고 anon 정책이 좁은 공개 표에만 주석 근거와 함께 준다(환자·고객 표 금지). 뷰는 `security_invoker = on` + `grant select`, 매트뷰는 anon·authenticated 금지, 시퀀스는 부를 역할에 `usage`(identity 는 불필요), 함수는 `revoke execute … from public, anon` 뒤 부를 역할에만 `grant execute`(서버 경로면 `service_role`).
- `on all … in schema`·public 대상 `alter default privileges`·대시보드 수동 grant 는 쓰지 않는다. 기존 객체 권한은 `supabase/migrations/20261021000001_data_api_explicit_grants.sql` 이 재현한다(옛 기본값 재현용 — 이후 권한 축소는 별도 마이그레이션).

# Vibe Mailer (바이브 메일러)

유저의 행동·상태 변화를 감지하여 맞춤형 이메일 시퀀스를 자동 발송하는 강의 수강생 CRM.

- **Frontend**: Next.js (App Router) + Tailwind CSS
- **Auth & DB**: Supabase (Postgres + RLS)
- **Email**: Resend (즉시 + 5분 예약 발송)
- **Serverless**: Supabase Edge Function `trigger-action`

자세한 제품 명세는 [`prd.md`](./prd.md), 작업 분담은 [`implementation_plan.md`](./implementation_plan.md) 참고.

---

## 빠른 시작 (프론트엔드)

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 Supabase URL/anon key 입력
npm run dev
```

`.env.local`이 비어있으면 `src/lib/supabase.ts`가 Mock 모드로 동작하므로 백엔드 셋업 없이도 UI 점검 가능.

---

## 백엔드 셋업 (Supabase + Resend)

### 1. 사전 준비물

- Supabase 계정 + 신규 프로젝트 1개 ([dashboard](https://supabase.com/dashboard))
- Resend 계정 + API 키 ([resend.com/api-keys](https://resend.com/api-keys))
- Supabase CLI (전역 설치 불필요, `npx supabase` 사용 가능)

### 2. Supabase 프로젝트 연결

```bash
# 1) Supabase 로그인 (브라우저에서 Personal Access Token 발급 후 입력)
npx supabase login

# 2) 이 저장소를 Supabase 프로젝트와 연결 (대시보드의 project ref 사용)
npx supabase link --project-ref <your-project-ref>
```

### 3. 데이터베이스 마이그레이션 적용

```bash
npx supabase db push
```

세 파일이 순서대로 적용됩니다.

| 파일 | 내용 |
|---|---|
| `20260521000001_init_schema.sql` | `profiles`, `action_logs`, `email_logs` 테이블 + 인덱스 + Realtime publication |
| `20260521000002_rls_policies.sql` | RLS 정책 (수강생: 본인만, 관리자: 전체) |
| `20260521000003_profile_trigger_and_rpc.sql` | `auth.users → profiles` 자동 생성 트리거, `log_action_with_rate_limit` / `record_email_log` RPC |

### 4. Edge Function 시크릿 설정

```bash
# 시크릿 파일 만들기 (.gitignore 됨)
cp supabase/functions/.env.example supabase/functions/.env.local
# RESEND_API_KEY / RESEND_FROM_EMAIL 채우기

# Supabase 프로젝트에 업로드
npx supabase secrets set --env-file ./supabase/functions/.env.local
```

### 5. Edge Function 배포

```bash
npx supabase functions deploy trigger-action
```

엔드포인트: `https://<project-ref>.supabase.co/functions/v1/trigger-action`

### 6. 로컬 통합 테스트 (선택)

```bash
# 로컬 Supabase 스택 + Edge Function 동시 기동
npx supabase start
npx supabase functions serve trigger-action \
  --env-file ./supabase/functions/.env.local

# 테스트 요청
curl -X POST http://127.0.0.1:54321/functions/v1/trigger-action \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"action_type":"click_guide"}'
```

기대 응답:
```json
{
  "success": true,
  "message": "Action logged and email processing started.",
  "data": { "email_status": "sent" }
}
```

3분 안에 동일 액션 재호출 시:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait 3 minutes before retrying.",
  "retry_after_seconds": 167
}
```

---

## API 규격 (Edge Function)

### `POST /functions/v1/trigger-action`

| 항목 | 값 |
|---|---|
| Headers | `Authorization: Bearer <user_jwt>`, `Content-Type: application/json` |
| Body | `{ "action_type": "click_guide" \| "click_error" \| "click_mission" }` |

**Response (200)**
```json
{
  "success": true,
  "message": "Action logged and email processing started.",
  "data": {
    "email_status": "sent",
    "follow_up_status": "scheduled"
  }
}
```
`follow_up_status` 는 `action_type=click_mission` 에서만 포함.

**Response (429)**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait 3 minutes before retrying.",
  "retry_after_seconds": 167
}
```
응답 헤더에 `Retry-After: <초>` 도 포함.

### 액션 → 이메일 매핑

| action_type | 즉시 발송 (email_type) | 5분 예약 (email_type) |
|---|---|---|
| `click_guide`   | `guide`              | — |
| `click_error`   | `error`              | — |
| `click_mission` | `mission_completed`  | `follow_up` |

---

## 데이터베이스 스키마

| 테이블 | 역할 |
|---|---|
| `profiles` | `auth.users` 1:1 확장. `current_status` 와 `is_admin` 보관 |
| `action_logs` | 버튼 클릭 이벤트. 3분 rate-limit 판정 소스 |
| `email_logs` | Resend 발송 결과. `status` = `sent` / `scheduled` / `failed` |

RLS: 인증된 유저는 본인 행만, `is_admin=true` 프로필은 모든 행 SELECT 가능. INSERT/UPDATE 는 Edge Function의 service_role 키만 가능.

Realtime publication 에 세 테이블 등록됨. 프론트에서 `supabase.channel(...).on('postgres_changes', ...)` 구독 가능.

---

## 운영 주의사항 (PRD §8)

- **Resend 무료티어 한도**: 일 100건 / 월 3,000건. 어뷰징 방지 위해 3분 rate-limit 필수 작동.
- **샌드박스**: 도메인 미인증 시 발신 주소는 `onboarding@resend.dev`, 수신자는 본인 이메일만 가능. 운영 전 SPF/DKIM 인증 완료 필수.
- **예약 발송 정밀도**: Resend `scheduled_at` 은 분 단위 정밀도. 초 단위 보장 없음.
- **이모지 금지**: 모든 이메일 템플릿과 웹 UI 에서 이모지 사용 금지 (`src/components/Toast.tsx`, `supabase/functions/trigger-action/_shared/templates.ts` 참고).

---

## 향후 개선

- React Email 기반 템플릿 빌드 파이프라인 (현재는 인라인 HTML)
- 어드민 페이지 SSR 화 + service_role 기반 KPI 집계 RPC
- Vercel Cron 또는 pg_cron 으로 Resend 한도 일일 모니터링
- Sentry 등 에러 트래킹 연결

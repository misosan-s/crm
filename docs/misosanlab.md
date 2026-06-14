# 미소산랩 (MisosanLab)

Claude Code로 개발하며 마주치는 핵심 개념(에이전트·스킬·하네스 등)을 **평일 매일 오전 8시(KST)** 메일함에 배달하는 1인 학습 자동화 봇.

기존 Vibe Mailer 인프라(Supabase + Resend)를 재사용합니다. Python/Gmail/cron(서버) 대신 **Supabase Edge Function + Resend + pg_cron** 으로 구현했습니다.

## 구성 요소

| 부분 | 위치 |
|---|---|
| 커리큘럼 원본 | `curriculum.md` |
| 콘텐츠 생성 + 발송 함수 | `supabase/functions/daily-lesson/` |
| 스키마·RPC·RLS | `supabase/migrations/20260614000001_misosanlab_schema.sql` |
| 스케줄링(pg_cron) | `supabase/migrations/20260614000002_misosanlab_cron.sql` |
| 커리큘럼 동기화 CLI | `npm run ml:sync` |
| 소스 수집 CLI | `npm run ml:add-source -- <repo-url>` |

데이터 흐름: `ml_curriculum`(대기 중 seq 최소 1개) → 연결된 `ml_sources` 원문 → Claude Opus 4.8 4단락 생성 → Resend 발송 → 성공 시 `ml_progress` 기록.

## 흐름 한 통 (PRD §2)

평일 08:00(KST) → `[미소산랩] Day 12 — 하네스(Harness)란?` 도착 → 📌정의 / 🔍비유 / 💻Claude Code에서 / 🔁복습+예고 4단락(5분) → 푸터 `20개 중 12번째 · 미소산랩`.

## 셋업

전제: Vibe Mailer 백엔드 셋업(README의 Supabase 연결 + Resend)이 끝나 있어야 합니다.

### 1. 마이그레이션 적용

```bash
npx supabase db push
```

`ml_sources` / `ml_curriculum` / `ml_progress` / `ml_email_logs` / `ml_config` 와 RPC·RLS·cron 잡이 생성됩니다.
(pg_cron·pg_net 이 비활성이면 cron 등록은 NOTICE 만 남기고 넘어가니, 대시보드 > Database > Extensions 에서 켠 뒤 마이그레이션을 다시 적용하세요.)

### 2. Edge Function 시크릿 설정

```bash
# .env.local 채우기 (예시는 supabase/functions/.env.example)
#   ANTHROPIC_API_KEY / RESEND_API_KEY
#   MISOSAN_FROM_EMAIL / MISOSAN_RECIPIENT_EMAIL / MISOSAN_CRON_SECRET
npx supabase secrets set --env-file ./supabase/functions/.env.local
```

> 무료 티어 + 도메인 미인증이면 발신은 `onboarding@resend.dev`, 수신은 Resend 가입 이메일만 가능합니다.

### 3. 함수 배포

```bash
npx supabase functions deploy daily-lesson
```

엔드포인트: `https://<project-ref>.supabase.co/functions/v1/daily-lesson`

### 4. 커리큘럼 동기화

```bash
npm run ml:sync
```

`curriculum.md` 의 표가 `ml_curriculum` 에 들어갑니다. (개념명이 자연키라 재동기화해도 발송 상태는 보존됩니다.)

### 5. (선택) GitHub 자료 선수집

```bash
npm run ml:add-source -- https://github.com/anthropics/anthropic-sdk-typescript
```

수집한 `.md` 문서가 `ml_sources` 에 저장되고, 커리큘럼의 `연결 소스` 키워드와 매칭되어 콘텐츠 생성 시 참조됩니다.

### 6. cron 설정 등록

`ml_config` 에 함수 URL과 cron 시크릿(2번에서 정한 `MISOSAN_CRON_SECRET` 과 동일)을 넣습니다. Supabase SQL Editor 에서:

```sql
insert into public.ml_config (id, function_url, cron_secret)
values (1, 'https://<project-ref>.supabase.co/functions/v1/daily-lesson', '<MISOSAN_CRON_SECRET>')
on conflict (id) do update
  set function_url = excluded.function_url,
      cron_secret = excluded.cron_secret,
      updated_at = now();
```

이제 매일 23:00 UTC(= 08:00 KST)에 `misosanlab-daily` 잡이 함수를 호출하고, 함수가 평일만 발송합니다(주말 skip).

## 수동 발송 / 테스트

주말·시간대와 무관하게 한 통 바로 보내려면 `force` 로 호출하세요:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/daily-lesson \
  -H "x-cron-secret: <MISOSAN_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

응답 예:
```json
{ "success": true, "action": "lesson_sent", "day_number": 1, "total": 20, "concept": "에이전트(Agent)란?" }
```

대기 중 개념이 0개면 앰버 색 "커리큘럼 추가 필요" 알림 1통이 오고 `action`은 `curriculum_empty` 입니다.

## 예외 처리 (PRD §6)

- **커리큘럼 소진**: 발송 멈추고 앰버 알림 메일 1통 → 빈 콘텐츠 발송 방지.
- **발송 실패**: 즉시 1회 재시도 → 실패 시 로그만 남기고 진도는 진행하지 않음. 다음 실행에서 같은 개념을 다시 시도하므로 누락이 없습니다.
- **주말**: cron 은 매일 돌지만 함수의 KST 평일 가드가 토·일을 skip.

## 운영 메모

- 콘텐츠는 자동 생성 후 즉시 발송됩니다(검수 없음). 초기 몇 주는 받은 메일을 보며 `supabase/functions/daily-lesson/_shared/anthropic.ts` 의 문체 프롬프트를 다듬으세요.
- 커리큘럼은 한 달에 약 20개씩 소비됩니다. 소진 전 `curriculum.md` 에 줄을 추가하고 `npm run ml:sync` 하세요.
- 발송 이력·실패는 `ml_email_logs`, 진도는 `ml_progress` 에서 확인합니다(관리자 계정 SELECT 가능).

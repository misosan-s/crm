-- 미소산랩 — 스케줄링 (PRD §6 ⑤): 평일 오전 8시(KST) 자동 실행
--
-- 동작:
--   pg_cron 이 매일 23:00 UTC (= 08:00 KST) 에 ml_run_daily_lesson() 호출
--   → pg_net 으로 daily-lesson Edge Function 을 POST.
--   주말 제외는 Edge Function 내부의 KST 평일 가드가 담당하므로
--   cron 은 매일 돌려도 토·일엔 함수가 skip 한다.
--
-- 시크릿(함수 URL·cron secret)은 마이그레이션에 하드코딩하지 않고
-- ml_config 1행에 운영자가 직접 넣는다 (아래 안내 참고).

-- =========================================================
-- ml_config : 단일 행 운영 설정 (함수 URL + cron secret)
-- =========================================================
create table if not exists public.ml_config (
  id int primary key default 1 check (id = 1),
  function_url text not null,
  cron_secret text,
  updated_at timestamptz not null default now()
);

alter table public.ml_config enable row level security;
revoke all on public.ml_config from anon, authenticated;

comment on table public.ml_config is
  '미소산랩 cron 설정. 1행만 존재. 예: insert into ml_config(id,function_url,cron_secret) values (1, ''https://<ref>.supabase.co/functions/v1/daily-lesson'', ''<secret>'');';

-- =========================================================
-- ml_run_daily_lesson : cron 이 호출하는 트리거 함수
-- =========================================================
create or replace function public.ml_run_daily_lesson()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  select function_url, cron_secret into v_url, v_secret
    from public.ml_config where id = 1;

  if v_url is null then
    raise notice 'ml_config 미설정 — daily-lesson 호출 건너뜀';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.ml_run_daily_lesson() from public, anon, authenticated;

-- =========================================================
-- 확장 + 스케줄 등록 (pg_cron / pg_net 미가용 환경에서도 db push 가 깨지지 않도록 방어)
-- =========================================================
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net 확장 활성화 실패: % — Supabase 대시보드 > Database > Extensions 에서 켜주세요', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_cron;

  -- 기존 동일 잡 제거 후 재등록 (idempotent)
  perform cron.unschedule('misosanlab-daily')
    where exists (select 1 from cron.job where jobname = 'misosanlab-daily');

  perform cron.schedule(
    'misosanlab-daily',
    '0 23 * * *',                       -- 매일 23:00 UTC = 08:00 KST
    $cron$ select public.ml_run_daily_lesson(); $cron$
  );
exception when others then
  raise notice 'pg_cron 스케줄 등록 실패: % — Supabase 대시보드에서 pg_cron 활성화 후 본 마이그레이션을 다시 적용하세요', sqlerrm;
end $$;

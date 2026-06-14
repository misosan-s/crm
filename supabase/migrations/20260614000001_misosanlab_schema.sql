-- 미소산랩 (MisosanLab) — 스키마
-- 평일 매일 Claude Code 개념 1개를 메일로 배달하는 학습 자동화 봇.
-- 기존 Vibe Mailer 인프라(Supabase + Resend) 위에 ml_* 네임스페이스로 추가.
--
-- 테이블
--   ml_sources    : GitHub 선수집 자료 원문 (개념 생성 시 참조)
--   ml_curriculum : 다룰 개념 목록·순서·상태 (대기 / 발송완료)
--   ml_progress   : 발송 진도 기록 (Day번호·날짜) — 중복/누락 방지
--   ml_email_logs : 발송 결과 로그 (Resend 호출 결과)

-- =========================================================
-- ml_sources : GitHub 선수집 + 수동 재수집 자료
-- =========================================================
create table if not exists public.ml_sources (
  id uuid primary key default gen_random_uuid(),
  repo_url text not null,
  path text not null,                 -- 레포 내 파일 경로
  content text not null,              -- 원문 그대로
  fetched_at timestamptz not null default now(),
  unique (repo_url, path)
);

create index if not exists ml_sources_repo_idx on public.ml_sources (repo_url);

comment on table public.ml_sources is 'GitHub 선수집 자료 원문. 콘텐츠 생성 시 개념별로 참조';

-- =========================================================
-- ml_curriculum : 커리큘럼 (콘텐츠 고갈 방지의 핵심)
-- =========================================================
create table if not exists public.ml_curriculum (
  id uuid primary key default gen_random_uuid(),
  seq int not null,                   -- 순서 (작을수록 먼저)
  concept text not null unique,       -- 개념명 (자연키 — 재동기화 시 상태 보존)
  source_refs text,                   -- 연결 소스 (콤마구분 repo_url 또는 경로 키워드)
  status text not null default '대기'
    check (status in ('대기', '발송완료')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ml_curriculum_status_seq_idx
  on public.ml_curriculum (status, seq);

comment on table public.ml_curriculum is '커리큘럼 개념 목록. 오늘의 개념 = status=대기 중 seq 최소 1개';

drop trigger if exists ml_curriculum_set_updated_at on public.ml_curriculum;
create trigger ml_curriculum_set_updated_at
  before update on public.ml_curriculum
  for each row execute function public.set_updated_at();

-- =========================================================
-- ml_progress : 진도 기록
-- =========================================================
create table if not exists public.ml_progress (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.ml_curriculum(id) on delete cascade,
  day_number int not null,            -- 몇 번째로 발송됐는지 (1부터)
  concept text not null,
  sent_date date not null,
  email_log_id uuid,
  created_at timestamptz not null default now(),
  unique (curriculum_id)
);

create index if not exists ml_progress_day_idx on public.ml_progress (day_number);

comment on table public.ml_progress is '발송 성공 시에만 기록. 푸터 "N개 중 M번째"의 근거';

-- =========================================================
-- ml_email_logs : 발송 결과 로그
-- =========================================================
create table if not exists public.ml_email_logs (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  email_type text not null
    check (email_type in ('lesson', 'curriculum_empty')),
  subject text,
  status text not null
    check (status in ('sent', 'failed')),
  resend_id text,
  day_number int,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ml_email_logs_created_idx
  on public.ml_email_logs (created_at desc);

comment on table public.ml_email_logs is 'Resend 발송 결과. lesson(일일 개념) / curriculum_empty(소진 알림)';

-- =========================================================
-- RPC: ml_next_concept — 오늘의 개념 + 진도 집계 (읽기 전용)
--   반환: 대기 중 seq 최소 1개 + total_count / sent_count
-- =========================================================
create or replace function public.ml_next_concept()
returns table (
  id uuid,
  seq int,
  concept text,
  source_refs text,
  total_count int,
  sent_count int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.seq,
    c.concept,
    c.source_refs,
    (select count(*)::int from public.ml_curriculum),
    (select count(*)::int from public.ml_curriculum where status = '발송완료')
  from public.ml_curriculum c
  where c.status = '대기'
  order by c.seq asc
  limit 1;
$$;

revoke all on function public.ml_next_concept() from public, anon, authenticated;
grant execute on function public.ml_next_concept() to service_role;

-- =========================================================
-- RPC: ml_mark_sent — 발송 성공 시 진도 확정 (원자적)
--   상태 발송완료 + ml_progress 기록을 한 트랜잭션으로
-- =========================================================
create or replace function public.ml_mark_sent(
  p_curriculum_id uuid,
  p_day_number int,
  p_concept text,
  p_sent_date date,
  p_email_log_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.ml_curriculum
     set status = '발송완료',
         updated_at = now()
   where id = p_curriculum_id;

  insert into public.ml_progress (curriculum_id, day_number, concept, sent_date, email_log_id)
  values (p_curriculum_id, p_day_number, p_concept, p_sent_date, p_email_log_id)
  on conflict (curriculum_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ml_mark_sent(uuid, int, text, date, uuid) from public, anon, authenticated;
grant execute on function public.ml_mark_sent(uuid, int, text, date, uuid) to service_role;

-- =========================================================
-- RPC: ml_record_email_log — 발송 결과 로그 헬퍼
-- =========================================================
create or replace function public.ml_record_email_log(
  p_recipient text,
  p_email_type text,
  p_subject text,
  p_status text,
  p_resend_id text default null,
  p_day_number int default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.ml_email_logs (
    recipient, email_type, subject, status, resend_id, day_number, error_message
  ) values (
    p_recipient, p_email_type, p_subject, p_status, p_resend_id, p_day_number, p_error_message
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ml_record_email_log(text, text, text, text, text, int, text) from public, anon, authenticated;
grant execute on function public.ml_record_email_log(text, text, text, text, text, int, text) to service_role;

-- =========================================================
-- RLS : 운영자(관리자)만 SELECT, 쓰기는 service_role 전용
-- =========================================================
alter table public.ml_sources enable row level security;
alter table public.ml_curriculum enable row level security;
alter table public.ml_progress enable row level security;
alter table public.ml_email_logs enable row level security;

drop policy if exists "ml_sources_admin_select" on public.ml_sources;
create policy "ml_sources_admin_select" on public.ml_sources
  for select to authenticated using (public.is_current_user_admin());

drop policy if exists "ml_curriculum_admin_select" on public.ml_curriculum;
create policy "ml_curriculum_admin_select" on public.ml_curriculum
  for select to authenticated using (public.is_current_user_admin());

drop policy if exists "ml_progress_admin_select" on public.ml_progress;
create policy "ml_progress_admin_select" on public.ml_progress
  for select to authenticated using (public.is_current_user_admin());

drop policy if exists "ml_email_logs_admin_select" on public.ml_email_logs;
create policy "ml_email_logs_admin_select" on public.ml_email_logs
  for select to authenticated using (public.is_current_user_admin());

revoke all on public.ml_sources from anon;
revoke all on public.ml_curriculum from anon;
revoke all on public.ml_progress from anon;
revoke all on public.ml_email_logs from anon;

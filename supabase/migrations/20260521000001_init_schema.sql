-- Vibe Mailer — 초기 스키마
-- PRD §6, 구현계획서 §3.1 참고
-- profiles, action_logs, email_logs 3개 테이블 + 인덱스 + Realtime publication

-- =========================================================
-- profiles: 수강생 프로필 (auth.users 1:1 확장)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  current_status text not null default 'none'
    check (current_status in ('none', 'guide_requested', 'error_fighting', 'mission_completed')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_is_admin_idx on public.profiles (is_admin) where is_admin = true;

comment on table public.profiles is '수강생 프로필. auth.users와 1:1';
comment on column public.profiles.current_status is 'none | guide_requested | error_fighting | mission_completed';
comment on column public.profiles.is_admin is '관리자 리포트 대시보드 접근 권한';

-- =========================================================
-- action_logs: 버튼 클릭 행동 로그 (rate-limit 판정 소스)
-- =========================================================
create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null
    check (action_type in ('click_guide', 'click_error', 'click_mission')),
  created_at timestamptz not null default now()
);

create index if not exists action_logs_user_id_created_at_idx
  on public.action_logs (user_id, created_at desc);
create index if not exists action_logs_user_action_created_idx
  on public.action_logs (user_id, action_type, created_at desc);

comment on table public.action_logs is '수강생 버튼 클릭 이벤트. 3분 rate-limit 판정 기준';

-- =========================================================
-- email_logs: 이메일 발송 결과 로그 (Resend 호출 결과)
-- =========================================================
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email_type text not null
    check (email_type in ('guide', 'error', 'mission_completed', 'follow_up')),
  status text not null
    check (status in ('sent', 'scheduled', 'failed')),
  resend_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_user_id_created_at_idx
  on public.email_logs (user_id, created_at desc);
create index if not exists email_logs_status_idx on public.email_logs (status);

comment on table public.email_logs is 'Resend 발송 결과. status=scheduled은 5분 뒤 예약발송';

-- =========================================================
-- Realtime publication 등록
-- 어드민 대시보드 우측 패널과 알림 피드가 supabase.channel 로 구독
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'action_logs'
  ) then
    alter publication supabase_realtime add table public.action_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'email_logs'
  ) then
    alter publication supabase_realtime add table public.email_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

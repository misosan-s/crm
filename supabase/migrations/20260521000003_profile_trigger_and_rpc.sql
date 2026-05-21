-- Vibe Mailer — auth.users → profiles 자동 생성 트리거 + Rate Limit RPC

-- =========================================================
-- 1) auth.users 생성 시 public.profiles 자동 생성
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, current_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'none'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 2) Rate Limit + Action 기록 + 프로필 상태 갱신 RPC
--    Edge Function 이 service_role 로 단일 호출. 원자적 처리.
--
--    반환:
--      ok         : boolean    (false 면 rate-limited)
--      action_id  : uuid       (성공 시 새 action_logs.id)
--      retry_after_seconds : int (rate-limited 시 남은 대기초)
-- =========================================================
create or replace function public.log_action_with_rate_limit(
  p_user_id uuid,
  p_action_type text,
  p_window_seconds int default 180  -- 3분
)
returns table (
  ok boolean,
  action_id uuid,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_at timestamptz;
  v_new_id uuid;
  v_next_status text;
begin
  if p_action_type not in ('click_guide', 'click_error', 'click_mission') then
    raise exception 'invalid action_type: %', p_action_type;
  end if;

  -- 동일 유저 + 동일 action 의 최근 클릭 시각 조회
  select max(created_at)
    into v_last_at
    from public.action_logs
   where user_id = p_user_id
     and action_type = p_action_type
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_last_at is not null then
    return query select
      false as ok,
      null::uuid as action_id,
      greatest(
        0,
        p_window_seconds - extract(epoch from (now() - v_last_at))::int
      ) as retry_after_seconds;
    return;
  end if;

  -- 기록 + 프로필 상태 갱신을 원자적으로
  insert into public.action_logs (user_id, action_type)
  values (p_user_id, p_action_type)
  returning id into v_new_id;

  v_next_status := case p_action_type
    when 'click_guide'   then 'guide_requested'
    when 'click_error'   then 'error_fighting'
    when 'click_mission' then 'mission_completed'
  end;

  update public.profiles
     set current_status = v_next_status,
         updated_at = now()
   where id = p_user_id;

  return query select true as ok, v_new_id as action_id, 0 as retry_after_seconds;
end;
$$;

revoke all on function public.log_action_with_rate_limit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.log_action_with_rate_limit(uuid, text, int) to service_role;

comment on function public.log_action_with_rate_limit is
  'Edge Function 전용: 3분 rate-limit 체크 + action_logs 기록 + profiles.current_status 갱신을 원자적으로 수행';

-- =========================================================
-- 3) email_logs 기록 RPC (service_role 전용 헬퍼)
-- =========================================================
create or replace function public.record_email_log(
  p_user_id uuid,
  p_email_type text,
  p_status text,
  p_resend_id text default null,
  p_scheduled_at timestamptz default null,
  p_sent_at timestamptz default null,
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
  insert into public.email_logs (
    user_id, email_type, status, resend_id, scheduled_at, sent_at, error_message
  ) values (
    p_user_id, p_email_type, p_status, p_resend_id, p_scheduled_at, p_sent_at, p_error_message
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_email_log(uuid, text, text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_email_log(uuid, text, text, text, timestamptz, timestamptz, text) to service_role;

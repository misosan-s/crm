// =============================================================
// trigger-action — Vibe Mailer 백엔드 메인 Edge Function
// =============================================================
// POST /functions/v1/trigger-action
//   Headers: Authorization: Bearer <user_jwt>
//   Body:    { "action_type": "click_guide" | "click_error" | "click_mission" }
//
// 흐름:
//   1. JWT → user_id 추출
//   2. RPC log_action_with_rate_limit (3분 rate-limit 원자처리)
//      - rate-limited 면 429
//   3. 즉시 이메일 발송 (Resend)
//   4. email_logs 기록 (record_email_log RPC)
//   5. action_type=click_mission 인 경우 5분 뒤 follow_up 예약 발송
//
// 환경변수 (supabase secrets set):
//   SUPABASE_URL              — 자동 주입
//   SUPABASE_SERVICE_ROLE_KEY — 자동 주입
//   RESEND_API_KEY            — 수동 설정 필수
//   RESEND_FROM_EMAIL         — 수동 설정 필수 (예: 'Vibe Mailer <onboarding@resend.dev>')
//   ALLOWED_ORIGINS           — 선택, 콤마구분 (예: 'https://app.example.com')
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { corsHeaders, preflight } from './_shared/cors.ts';
import { sendEmail } from './_shared/resend.ts';
import { renderEmail, type EmailType, type TemplateContext } from './_shared/templates.ts';

type ActionType = 'click_guide' | 'click_error' | 'click_mission';

interface RequestBody {
  action_type: ActionType;
}

interface RateLimitRow {
  ok: boolean;
  action_id: string | null;
  retry_after_seconds: number;
}

const ACTION_TO_EMAIL: Record<ActionType, EmailType> = {
  click_guide: 'guide',
  click_error: 'error',
  click_mission: 'mission_completed',
};

const FOLLOW_UP_DELAY_MS = 5 * 60 * 1000;

function jsonResponse(
  body: unknown,
  init: ResponseInit,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== 'POST') {
    return jsonResponse(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
      origin,
    );
  }

  // -----------------------------------------------------------
  // 환경변수 검증
  // -----------------------------------------------------------
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { success: false, error: 'Server misconfiguration: Supabase env missing' },
      { status: 500 },
      origin,
    );
  }
  if (!resendApiKey || !resendFrom) {
    return jsonResponse(
      { success: false, error: 'Server misconfiguration: Resend env missing' },
      { status: 500 },
      origin,
    );
  }

  // -----------------------------------------------------------
  // 인증: JWT 검증 + user_id 추출
  // verify_jwt=true(config.toml) 이지만, 사용자 식별을 위해 직접 검증
  // -----------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return jsonResponse(
      { success: false, error: 'Missing Authorization header' },
      { status: 401 },
      origin,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse(
      { success: false, error: 'Invalid or expired session' },
      { status: 401 },
      origin,
    );
  }
  const userId = userData.user.id;
  const userEmail = userData.user.email ?? '';

  // -----------------------------------------------------------
  // 입력 파싱
  // -----------------------------------------------------------
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
      origin,
    );
  }

  const actionType = body?.action_type;
  if (
    actionType !== 'click_guide' &&
    actionType !== 'click_error' &&
    actionType !== 'click_mission'
  ) {
    return jsonResponse(
      {
        success: false,
        error:
          'action_type must be one of: click_guide, click_error, click_mission',
      },
      { status: 400 },
      origin,
    );
  }

  // -----------------------------------------------------------
  // Rate Limit + action_logs 기록 + profile.current_status 갱신 (원자)
  // -----------------------------------------------------------
  const { data: rlData, error: rlErr } = await supabaseAdmin.rpc(
    'log_action_with_rate_limit',
    {
      p_user_id: userId,
      p_action_type: actionType,
      p_window_seconds: 180,
    },
  );

  if (rlErr) {
    return jsonResponse(
      { success: false, error: `RPC failed: ${rlErr.message}` },
      { status: 500 },
      origin,
    );
  }

  const rl = (Array.isArray(rlData) ? rlData[0] : rlData) as
    | RateLimitRow
    | undefined;

  if (!rl) {
    return jsonResponse(
      { success: false, error: 'Rate limit RPC returned empty result' },
      { status: 500 },
      origin,
    );
  }

  if (!rl.ok) {
    return jsonResponse(
      {
        success: false,
        error: 'Rate limit exceeded. Please wait 3 minutes before retrying.',
        retry_after_seconds: rl.retry_after_seconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retry_after_seconds) },
      },
      origin,
    );
  }

  // -----------------------------------------------------------
  // 수신자 프로필 정보 (이름)
  // -----------------------------------------------------------
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, email')
    .eq('id', userId)
    .single();

  const recipientEmail = profile?.email ?? userEmail;
  const recipientName = profile?.name ?? recipientEmail.split('@')[0] ?? '수강생';

  if (!recipientEmail) {
    return jsonResponse(
      { success: false, error: 'No email on record for this user' },
      { status: 500 },
      origin,
    );
  }

  const ctx: TemplateContext = { name: recipientName, email: recipientEmail };

  // -----------------------------------------------------------
  // 1차 이메일: 즉시 발송
  // -----------------------------------------------------------
  const primaryType = ACTION_TO_EMAIL[actionType];
  const primaryRendered = renderEmail(primaryType, ctx);

  const primaryResult = await sendEmail(resendApiKey, {
    from: resendFrom,
    to: recipientEmail,
    subject: primaryRendered.subject,
    html: primaryRendered.html,
    text: primaryRendered.text,
  });

  await supabaseAdmin.rpc('record_email_log', {
    p_user_id: userId,
    p_email_type: primaryType,
    p_status: primaryResult.ok ? 'sent' : 'failed',
    p_resend_id: primaryResult.id ?? null,
    p_scheduled_at: null,
    p_sent_at: primaryResult.ok ? new Date().toISOString() : null,
    p_error_message: primaryResult.error ?? null,
  });

  // 발송 실패는 사용자에게도 알리되, action 기록은 유지
  if (!primaryResult.ok) {
    return jsonResponse(
      {
        success: false,
        error: 'Email send failed',
        detail: primaryResult.error ?? 'unknown',
      },
      { status: 502 },
      origin,
    );
  }

  // -----------------------------------------------------------
  // 2차 이메일: click_mission 인 경우 5분 뒤 follow_up 예약
  // -----------------------------------------------------------
  let followUpStatus: 'scheduled' | 'failed' | null = null;
  if (actionType === 'click_mission') {
    const scheduledAt = new Date(Date.now() + FOLLOW_UP_DELAY_MS).toISOString();
    const followUpRendered = renderEmail('follow_up', ctx);

    const followUpResult = await sendEmail(resendApiKey, {
      from: resendFrom,
      to: recipientEmail,
      subject: followUpRendered.subject,
      html: followUpRendered.html,
      text: followUpRendered.text,
      scheduled_at: scheduledAt,
    });

    await supabaseAdmin.rpc('record_email_log', {
      p_user_id: userId,
      p_email_type: 'follow_up',
      p_status: followUpResult.ok ? 'scheduled' : 'failed',
      p_resend_id: followUpResult.id ?? null,
      p_scheduled_at: followUpResult.ok ? scheduledAt : null,
      p_sent_at: null,
      p_error_message: followUpResult.error ?? null,
    });

    followUpStatus = followUpResult.ok ? 'scheduled' : 'failed';
  }

  // -----------------------------------------------------------
  // 응답
  // -----------------------------------------------------------
  return jsonResponse(
    {
      success: true,
      message: 'Action logged and email processing started.',
      data: {
        email_status: 'sent',
        ...(followUpStatus ? { follow_up_status: followUpStatus } : {}),
      },
    },
    { status: 200 },
    origin,
  );
});

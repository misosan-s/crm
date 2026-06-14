// =============================================================
// daily-lesson — 미소산랩 일일 개념 메일 발송 Edge Function
// =============================================================
// POST /functions/v1/daily-lesson
//   Headers: x-cron-secret: <MISOSAN_CRON_SECRET>   (설정 시 검증)
//   Body:    {} 또는 { "force": true }  (force=주말/시크릿 우회 — 수동 테스트용)
//
// 흐름 (PRD §6):
//   1. 평일(KST) 가드 — 주말이면 skip (force=true 면 무시)
//   2. ml_next_concept RPC — 오늘의 개념(대기 중 seq 최소) 조회
//      - 없으면(대기 0개) 커리큘럼 소진 알림 메일(앰버) 1통 후 종료
//   3. 연결 소스 원문 수집 (ml_sources)
//   4. Anthropic(Claude Opus 4.8)으로 4단락 생성
//   5. Resend 발송 (실패 시 1회 재시도)
//   6. 성공 시에만 ml_mark_sent — 진도 확정 (중복/누락 방지)
//
// 환경변수 (supabase secrets set):
//   SUPABASE_URL              — 자동 주입
//   SUPABASE_SERVICE_ROLE_KEY — 자동 주입
//   ANTHROPIC_API_KEY         — 필수
//   RESEND_API_KEY            — 필수
//   MISOSAN_FROM_EMAIL        — 필수 (예: '미소산랩 <onboarding@resend.dev>')
//   MISOSAN_RECIPIENT_EMAIL   — 필수 (본인 메일)
//   MISOSAN_CRON_SECRET       — 선택 (설정 시 x-cron-secret 헤더 검증)
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { generateLesson } from './_shared/anthropic.ts';
import { sendEmail } from './_shared/resend.ts';
import { renderCurriculumEmpty, renderLesson } from './_shared/template.ts';

interface NextConceptRow {
  id: string;
  seq: number;
  concept: string;
  source_refs: string | null;
  total_count: number;
  sent_count: number;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 한국 시간(KST) 기준 날짜·요일
function kstNow(): { date: string; isWeekend: boolean } {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(now); // Mon..Sun
  return { date, isWeekend: weekday === 'Sat' || weekday === 'Sun' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // 입력 파싱 (본문 없을 수 있음)
  let body: { force?: boolean } = {};
  try {
    const txt = await req.text();
    if (txt) body = JSON.parse(txt);
  } catch {
    /* 빈/잘못된 본문은 무시 */
  }
  const force = body?.force === true;

  // 환경변수
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('MISOSAN_FROM_EMAIL');
  const recipient = Deno.env.get('MISOSAN_RECIPIENT_EMAIL');
  const cronSecret = Deno.env.get('MISOSAN_CRON_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'Supabase env missing' }, 500);
  }
  if (!anthropicKey || !resendKey || !fromEmail || !recipient) {
    return json(
      { success: false, error: 'Server misconfiguration: ANTHROPIC_API_KEY / RESEND_API_KEY / MISOSAN_FROM_EMAIL / MISOSAN_RECIPIENT_EMAIL required' },
      500,
    );
  }

  // cron 시크릿 검증 (설정된 경우, force 와 무관하게)
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // 평일 가드 (KST)
  const { date: kstDate, isWeekend } = kstNow();
  if (isWeekend && !force) {
    return json({ success: true, skipped: 'weekend', kst_date: kstDate }, 200);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) 오늘의 개념
  const { data: rows, error: nextErr } = await supabase.rpc('ml_next_concept');
  if (nextErr) {
    return json({ success: false, error: `ml_next_concept failed: ${nextErr.message}` }, 500);
  }

  const next = (Array.isArray(rows) ? rows[0] : rows) as NextConceptRow | undefined;

  // 2) 커리큘럼 소진 → 앰버 알림 1통 (PRD §6 예외처리)
  if (!next) {
    const empty = renderCurriculumEmpty();
    const r = await sendEmail(resendKey, {
      from: fromEmail,
      to: recipient,
      subject: empty.subject,
      html: empty.html,
      text: empty.text,
    });
    await supabase.rpc('ml_record_email_log', {
      p_recipient: recipient,
      p_email_type: 'curriculum_empty',
      p_subject: empty.subject,
      p_status: r.ok ? 'sent' : 'failed',
      p_resend_id: r.id ?? null,
      p_day_number: null,
      p_error_message: r.error ?? null,
    });
    return json({ success: true, action: 'curriculum_empty', email_sent: r.ok }, 200);
  }

  const dayNumber = next.sent_count + 1;

  // 3) 연결 소스 원문 수집
  let sources = '';
  if (next.source_refs?.trim()) {
    const refs = next.source_refs.split(',').map((s) => s.trim()).filter(Boolean);
    const { data: srcRows } = await supabase
      .from('ml_sources')
      .select('repo_url, path, content')
      .or(refs.map((r) => `repo_url.ilike.%${r}%,path.ilike.%${r}%`).join(','))
      .limit(8);
    sources = (srcRows ?? [])
      .map((s: { path: string; content: string }) => `# ${s.path}\n${s.content}`)
      .join('\n\n')
      .slice(0, 12000);
  }

  // 4) 콘텐츠 생성
  const gen = await generateLesson(anthropicKey, {
    concept: next.concept,
    dayNumber,
    total: next.total_count,
    sources,
  });
  if (!gen.ok || !gen.content) {
    return json({ success: false, error: `content generation failed: ${gen.error}` }, 502);
  }

  // 5) 발송 (실패 시 1회 재시도)
  const mail = renderLesson({
    dayNumber,
    total: next.total_count,
    concept: next.concept,
    content: gen.content,
  });

  let send = await sendEmail(resendKey, {
    from: fromEmail,
    to: recipient,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!send.ok) {
    send = await sendEmail(resendKey, {
      from: fromEmail,
      to: recipient,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  }

  // 발송 로그
  const { data: logId } = await supabase.rpc('ml_record_email_log', {
    p_recipient: recipient,
    p_email_type: 'lesson',
    p_subject: mail.subject,
    p_status: send.ok ? 'sent' : 'failed',
    p_resend_id: send.id ?? null,
    p_day_number: dayNumber,
    p_error_message: send.error ?? null,
  });

  // 6) 성공 시에만 진도 확정 (실패면 다음 실행에 재시도 → 누락 없음)
  if (!send.ok) {
    return json({ success: false, error: `email send failed: ${send.error}`, concept: next.concept }, 502);
  }

  await supabase.rpc('ml_mark_sent', {
    p_curriculum_id: next.id,
    p_day_number: dayNumber,
    p_concept: next.concept,
    p_sent_date: kstDate,
    p_email_log_id: (logId as string | null) ?? null,
  });

  return json(
    {
      success: true,
      action: 'lesson_sent',
      day_number: dayNumber,
      total: next.total_count,
      concept: next.concept,
      resend_id: send.id ?? null,
    },
    200,
  );
});

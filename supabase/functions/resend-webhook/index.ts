// =============================================================
// resend-webhook — Resend 이벤트 수신 → email_logs.status 자동 갱신
// =============================================================
// POST /functions/v1/resend-webhook
//   Headers: svix-id, svix-timestamp, svix-signature
//   Body:    Resend webhook event (https://resend.com/docs/dashboard/webhooks/event-types)
//
// 처리 이벤트:
//   - email.sent / email.delivered → status='sent', sent_at=event.created_at
//   - email.bounced               → status='failed', error_message=bounce 정보
//   - email.complained            → status='failed', error_message='spam complaint'
//   - 그 외(opened/clicked/delivery_delayed) → 200 OK, DB 무시
//
// 보안: Svix HMAC-SHA256 서명 검증 + timestamp 5분 이내 검증(replay 방지).
//
// 환경변수 (supabase secrets set):
//   SUPABASE_URL              — 자동 주입
//   SUPABASE_SERVICE_ROLE_KEY — 자동 주입
//   RESEND_WEBHOOK_SECRET     — Resend 대시보드 발급 secret (whsec_... 형식)
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    [key: string]: unknown;
  };
}

const REPLAY_TOLERANCE_SECONDS = 300;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing Svix headers', { status: 400 });
  }

  const tsNum = Number(svixTimestamp);
  if (!Number.isFinite(tsNum)) {
    return new Response('Invalid svix-timestamp', { status: 400 });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > REPLAY_TOLERANCE_SECONDS) {
    return new Response('Stale timestamp', { status: 401 });
  }

  const rawBody = await req.text();

  const sigValid = await verifySvixSignature(
    secret,
    svixId,
    svixTimestamp,
    rawBody,
    svixSignature,
  );
  if (!sigValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const emailId = event?.data?.email_id;
  if (!emailId) {
    return new Response('Missing email_id', { status: 400 });
  }

  let update: Record<string, unknown> | null = null;
  switch (event.type) {
    case 'email.sent':
    case 'email.delivered': {
      update = {
        status: 'sent',
        sent_at: event.created_at ?? new Date().toISOString(),
      };
      break;
    }
    case 'email.bounced': {
      const bounce = (event.data as Record<string, unknown>)?.bounce;
      const detail = bounce ? JSON.stringify(bounce).slice(0, 500) : 'bounced';
      update = { status: 'failed', error_message: `Bounced: ${detail}` };
      break;
    }
    case 'email.complained': {
      update = { status: 'failed', error_message: 'Recipient complained (spam)' };
      break;
    }
    default:
      return new Response('OK (ignored)', { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from('email_logs')
    .update(update)
    .eq('resend_id', emailId);

  if (error) {
    return new Response(`DB update failed: ${error.message}`, { status: 500 });
  }

  return new Response('OK', { status: 200 });
});

async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  const secretBytes = secret.startsWith('whsec_')
    ? base64Decode(secret.slice(6))
    : new TextEncoder().encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(toSign),
  );
  const expected = base64Encode(new Uint8Array(sigBuffer));

  const candidates = signatureHeader
    .split(' ')
    .map((s) => s.split(',')[1])
    .filter((s): s is string => Boolean(s));

  return candidates.some((c) => timingSafeEqual(c, expected));
}

function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Resend API 얇은 래퍼
// SDK 대신 fetch 직호출 — Deno 환경에서 의존성 최소화.
// 문서: https://resend.com/docs/api-reference/emails/send-email

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  scheduled_at?: string; // ISO 8601 (분 단위 정밀도 — PRD §8)
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  status: 'sent' | 'scheduled' | 'failed';
  error?: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendEmail(
  apiKey: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!apiKey) {
    return { ok: false, status: 'failed', error: 'RESEND_API_KEY missing' };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        status: 'failed',
        error: `Resend ${res.status}: ${errText.slice(0, 500)}`,
      };
    }

    const json = (await res.json()) as { id?: string };
    return {
      ok: true,
      id: json.id,
      status: input.scheduled_at ? 'scheduled' : 'sent',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 'failed', error: msg };
  }
}

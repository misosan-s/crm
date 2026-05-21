// CORS 헬퍼 — 브라우저에서 직접 invoke 시 필요
// 운영 단계에서는 Allowed Origins 를 Vercel 배포 도메인으로 좁히는 것을 권장.

const ALLOWED_ORIGINS_ENV = Deno.env.get('ALLOWED_ORIGINS') ?? '';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV
  ? ALLOWED_ORIGINS_ENV.split(',').map((o) => o.trim()).filter(Boolean)
  : ['*'];

export function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin =
    ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin ?? '*'
      : ALLOWED_ORIGINS[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders(req.headers.get('Origin')),
    });
  }
  return null;
}

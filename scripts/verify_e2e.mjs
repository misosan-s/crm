// =============================================================
// Vibe Mailer — Edge Function end-to-end 검증 스크립트
// =============================================================
// 검증 항목:
//   1) click_guide   → 200 sent
//   2) click_guide #2 즉시 재시도 → 429 (3분 rate-limit)
//   3) click_mission → 200 sent + follow_up scheduled (5분 뒤)
//   4) email_logs 3건(guide / mission_completed / follow_up) 기록 확인
//
// 실행: node scripts/verify_e2e.mjs
// =============================================================

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// .env.local 간이 파서
const envPath = path.join(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL || 'kevin017@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'vibe1234';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('환경변수 누락: .env.local 확인 필요');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureTestUser() {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;
  const existing = list.data?.users?.find((u) => u.email === TEST_EMAIL);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return { id: existing.id, fresh: false };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, fresh: true };
}

async function cleanup(userId) {
  await admin.from('action_logs').delete().eq('user_id', userId);
  await admin.from('email_logs').delete().eq('user_id', userId);
}

async function callTriggerAction(jwt, action_type) {
  const url = `${SUPABASE_URL}/functions/v1/trigger-action`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ action_type }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function passFail(cond) {
  return cond ? 'PASS' : 'FAIL';
}

async function main() {
  console.log('[1] 테스트 유저 ensure ...');
  const user = await ensureTestUser();
  console.log(`    user_id=${user.id} (fresh=${user.fresh})`);

  console.log('[2] action_logs / email_logs cleanup ...');
  await cleanup(user.id);

  console.log('[3] signInWithPassword ...');
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: si, error: siErr } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (siErr) throw siErr;
  const jwt = si.session.access_token;
  console.log(`    JWT 발급 (len=${jwt.length})`);

  console.log('[4] POST trigger-action {action_type: click_guide} (즉시 발송) ...');
  const r1 = await callTriggerAction(jwt, 'click_guide');
  console.log(`    status=${r1.status}`, JSON.stringify(r1.body));

  console.log('[5] POST trigger-action {action_type: click_guide} #2 (429 기대) ...');
  const r2 = await callTriggerAction(jwt, 'click_guide');
  console.log(`    status=${r2.status}`, JSON.stringify(r2.body));

  console.log('[6] POST trigger-action {action_type: click_mission} (follow_up 5분 예약) ...');
  const r3 = await callTriggerAction(jwt, 'click_mission');
  console.log(`    status=${r3.status}`, JSON.stringify(r3.body));

  console.log('[7] email_logs 조회 ...');
  const { data: logs, error: logsErr } = await admin
    .from('email_logs')
    .select(
      'email_type, status, resend_id, scheduled_at, sent_at, error_message, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (logsErr) throw logsErr;
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n=== 검증 요약 ===');
  const hasGuideSent = (logs ?? []).some(
    (l) => l.email_type === 'guide' && l.status === 'sent',
  );
  const hasMissionSent = (logs ?? []).some(
    (l) => l.email_type === 'mission_completed' && l.status === 'sent',
  );
  const hasFollowUpScheduled = (logs ?? []).some(
    (l) => l.email_type === 'follow_up' && l.status === 'scheduled',
  );
  console.log(`  click_guide #1   : ${passFail(r1.status === 200)} (HTTP ${r1.status})`);
  console.log(`  click_guide #2   : ${passFail(r2.status === 429)} (HTTP ${r2.status})`);
  console.log(`  click_mission    : ${passFail(r3.status === 200)} (HTTP ${r3.status})`);
  console.log(`  guide sent log   : ${passFail(hasGuideSent)}`);
  console.log(`  mission sent log : ${passFail(hasMissionSent)}`);
  console.log(`  follow_up sched  : ${passFail(hasFollowUpScheduled)}`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

// =============================================================
// Vibe Mailer — 테스트 계정 비밀번호 reset
// 실행: node scripts/reset_password.mjs [email] [password]
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const email = process.argv[2] || 'kevin017@gmail.com';
const password = process.argv[3] || 'vibe1234';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = list.data?.users?.find((u) => u.email === email);
if (!user) {
  console.error('FAIL: user not found:', email);
  process.exit(1);
}
const { error } = await admin.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}
console.log(`OK: ${email} -> password = '${password}'`);

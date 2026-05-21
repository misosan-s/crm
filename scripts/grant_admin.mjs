// =============================================================
// Vibe Mailer — profiles.is_admin = true 부여
// 실행: node scripts/grant_admin.mjs [email]
// 기본 email: kevin017@gmail.com
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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await admin
  .from('profiles')
  .update({ is_admin: true })
  .eq('email', email)
  .select('id, email, name, is_admin');

if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error('FAIL: no profile row matched for', email);
  process.exit(1);
}
console.log('OK:', JSON.stringify(data[0], null, 2));

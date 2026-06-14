// =============================================================
// 미소산랩 — curriculum.md → ml_curriculum 동기화
// 실행: npm run ml:sync   (또는 node scripts/ml_sync_curriculum.mjs)
//
// curriculum.md 의 표(순서 | 개념명 | 연결 소스)를 읽어 upsert.
// 개념명을 자연키로 upsert 하므로 발송 상태(대기/발송완료)는 보존된다.
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)');
  process.exit(1);
}

// curriculum.md 표 파싱
const mdPath = path.join(process.cwd(), 'curriculum.md');
const md = fs.readFileSync(mdPath, 'utf8');

const items = [];
for (const line of md.split(/\r?\n/)) {
  const t = line.trim();
  if (!t.startsWith('|')) continue;
  const cells = t.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 2) continue;
  const [seqRaw, concept, sourceRefs = ''] = cells;
  // 헤더/구분선 스킵
  if (!/^\d+$/.test(seqRaw)) continue;
  if (!concept) continue;
  items.push({
    seq: Number(seqRaw),
    concept,
    source_refs: sourceRefs || null,
  });
}

if (items.length === 0) {
  console.error('FAIL: curriculum.md 에서 개념을 찾지 못했어요. 표 형식을 확인하세요.');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// concept 자연키 upsert (status 미포함 → 기존 발송 상태 보존)
const { data, error } = await admin
  .from('ml_curriculum')
  .upsert(items, { onConflict: 'concept' })
  .select('seq, concept, status');

if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}

const waiting = (data ?? []).filter((r) => r.status === '대기').length;
console.log(`OK: ${data?.length ?? 0}개 동기화 완료 (대기 ${waiting}개)`);
for (const r of (data ?? []).sort((a, b) => a.seq - b.seq)) {
  console.log(`  ${String(r.seq).padStart(2, ' ')}. [${r.status}] ${r.concept}`);
}

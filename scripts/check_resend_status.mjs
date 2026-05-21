// Resend API로 특정 email ID들의 상태 조회
// 실행: node scripts/check_resend_status.mjs <id1> <id2> ...
import fs from 'node:fs';

const apiKey = fs.readFileSync('D:/OneDrive/AI/Claude/API/resend api.txt', 'utf8').trim();
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('USAGE: node scripts/check_resend_status.mjs <id1> [id2] ...');
  process.exit(1);
}

for (const id of ids) {
  const res = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.text();
  console.log(`\n=== ${id} (${res.status}) ===`);
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }
}

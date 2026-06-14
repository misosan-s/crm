// =============================================================
// 미소산랩 — GitHub 자료 수집 (선수집 + 수동 재수집)
// 실행: npm run ml:add-source -- <repo-url>
//   예: npm run ml:add-source -- https://github.com/anthropics/anthropic-sdk-typescript
//
// 지정 레포의 마크다운(.md) 문서를 GitHub API 로 수집해 ml_sources 에 저장.
// 비인증 시 시간당 60회 제한 → 대용량 레포면 GITHUB_TOKEN 환경변수 권장.
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
const ghToken = process.env.GITHUB_TOKEN;
const repoUrl = process.argv[2];

if (!url || !key) {
  console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)');
  process.exit(1);
}
if (!repoUrl) {
  console.error('사용법: npm run ml:add-source -- <repo-url>');
  process.exit(1);
}

const m = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
if (!m) {
  console.error('FAIL: GitHub 레포 URL 형식이 아니에요:', repoUrl);
  process.exit(1);
}
const owner = m[1];
const repo = m[2].replace(/\.git$/, '');

const ghHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'misosanlab',
  ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
};

async function gh(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, { headers: ghHeaders });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${pathname}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

console.log(`수집 시작: ${owner}/${repo}`);

// 기본 브랜치 → 트리 → .md 파일만
const repoInfo = await gh(`/repos/${owner}/${repo}`);
const branch = repoInfo.default_branch;
const tree = await gh(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

const mdFiles = (tree.tree ?? []).filter(
  (n) => n.type === 'blob' && /\.md$/i.test(n.path) && n.size && n.size < 200_000,
);

if (mdFiles.length === 0) {
  console.error('수집할 .md 파일이 없어요.');
  process.exit(0);
}

console.log(`.md 파일 ${mdFiles.length}개 발견 — 내용 가져오는 중...`);

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let saved = 0;
for (const f of mdFiles) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`;
  const res = await fetch(rawUrl, { headers: { 'User-Agent': 'misosanlab' } });
  if (!res.ok) {
    console.warn(`  skip ${f.path} (${res.status})`);
    continue;
  }
  const content = await res.text();
  const { error } = await admin
    .from('ml_sources')
    .upsert(
      { repo_url: repoUrl, path: f.path, content, fetched_at: new Date().toISOString() },
      { onConflict: 'repo_url,path' },
    );
  if (error) {
    console.warn(`  fail ${f.path}: ${error.message}`);
    continue;
  }
  saved += 1;
}

console.log(`OK: ${saved}/${mdFiles.length}개 저장 완료 (${owner}/${repo})`);

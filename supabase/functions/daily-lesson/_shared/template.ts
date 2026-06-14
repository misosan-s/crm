// 미소산랩 이메일 템플릿 (PRD §7 디자인 가이드)
// 브랜드 컬러: 메인 #3F9D55 / 서브 #8BC590 / 경고 앰버 #F59E0B
// 메일 클라이언트 호환: 단일 컬럼, 인라인 스타일, table 기반.
// 본문은 4단락 고정 + 단락마다 이모지 헤더 (📌 🔍 💻 🔁), 상단 진도바.

import type { LessonContent } from './anthropic.ts';

const BRAND = '미소산랩';
const MAIN = '#3F9D55';
const SUB = '#8BC590';
const AMBER = '#F59E0B';
const TEXT = '#1F2937';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const CODE_BG = '#F3F4F6';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 모델 본문 텍스트 → 단락/줄바꿈 보존 HTML
function textToHtml(s: string): string {
  return escapeHtml(s.trim())
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.75;color:${TEXT};">${p.replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

function progressBar(dayNumber: number, total: number): string {
  const pct = total > 0 ? Math.round((dayNumber / total) * 100) : 0;
  return `
    <div style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:${MAIN};">Day ${dayNumber} / 전체 ${total}개</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BORDER};border-radius:999px;">
      <tr><td style="height:6px;"><div style="width:${pct}%;min-width:6px;height:6px;background:${MAIN};border-radius:999px;"></div></td></tr>
    </table>`;
}

function shell(args: {
  preheader: string;
  title: string;
  accent: string;
  bodyHtml: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:${TEXT};">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(args.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;padding:0 16px;">
          <tr>
            <td style="padding:0 0 16px 0;border-bottom:2px solid ${args.accent};">
              <div style="font-size:18px;font-weight:700;color:${args.accent};letter-spacing:-0.01em;">${BRAND}</div>
            </td>
          </tr>
          <tr><td style="padding:16px 0 8px 0;">
            ${args.bodyHtml}
          </td></tr>
          <tr>
            <td style="padding:20px 0 0 0;border-top:1px solid ${BORDER};color:${MUTED};font-size:12px;line-height:1.6;">
              ${escapeHtml(args.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sectionHeader(emoji: string, label: string): string {
  return `<h2 style="margin:24px 0 8px 0;font-size:15px;font-weight:700;color:${MAIN};">${emoji} ${escapeHtml(label)}</h2>`;
}

// =========================================================
// 일일 개념 메일
// =========================================================
export function renderLesson(args: {
  dayNumber: number;
  total: number;
  concept: string;
  content: LessonContent;
}): RenderedEmail {
  const { dayNumber, total, concept, content } = args;

  const body = `
    ${progressBar(dayNumber, total)}
    <h1 style="margin:20px 0 4px 0;font-size:22px;line-height:1.4;font-weight:700;color:${TEXT};">${escapeHtml(concept)}</h1>
    <div style="height:4px;width:40px;background:${SUB};border-radius:2px;margin:0 0 8px 0;"></div>

    ${sectionHeader('📌', '오늘의 개념')}
    ${textToHtml(content.definition)}

    ${sectionHeader('🔍', '비유로 이해하기')}
    <div style="border-left:3px solid ${SUB};padding-left:14px;">${textToHtml(content.analogy)}</div>

    ${sectionHeader('💻', 'Claude Code에서 마주치는 지점')}
    ${textToHtml(content.in_claude_code)}

    ${sectionHeader('🔁', '복습 + 내일 예고')}
    ${textToHtml(content.review_preview)}
  `;

  return {
    subject: `[미소산랩] Day ${dayNumber} — ${concept}`,
    html: shell({
      preheader: `오늘의 개념: ${concept}`,
      title: `Day ${dayNumber} — ${concept}`,
      accent: MAIN,
      bodyHtml: body,
      footer: `${total}개 중 ${dayNumber}번째 · ${BRAND}`,
    }),
    text:
      `[미소산랩] Day ${dayNumber} — ${concept}\n` +
      `(${total}개 중 ${dayNumber}번째)\n\n` +
      `[오늘의 개념]\n${content.definition.trim()}\n\n` +
      `[비유로 이해하기]\n${content.analogy.trim()}\n\n` +
      `[Claude Code에서 마주치는 지점]\n${content.in_claude_code.trim()}\n\n` +
      `[복습 + 내일 예고]\n${content.review_preview.trim()}\n\n` +
      `— ${BRAND}`,
  };
}

// =========================================================
// 커리큘럼 소진 알림 메일 (앰버) — 빈 콘텐츠 생성 방지 (PRD §6 예외처리)
// =========================================================
export function renderCurriculumEmpty(): RenderedEmail {
  const body = `
    <div style="display:inline-block;padding:6px 12px;background:${AMBER};color:#fff;font-size:12px;font-weight:700;border-radius:999px;">커리큘럼 추가 필요</div>
    <h1 style="margin:16px 0 8px 0;font-size:20px;line-height:1.4;font-weight:700;color:${TEXT};">보낼 개념이 다 떨어졌어요</h1>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.75;color:${TEXT};">
      대기 중인 커리큘럼 개념이 0개라 오늘은 메일을 보내지 않았어요.
      <code style="background:${CODE_BG};padding:2px 6px;border-radius:4px;font-size:13px;">curriculum.md</code> 에 개념을 추가한 뒤
      <code style="background:${CODE_BG};padding:2px 6px;border-radius:4px;font-size:13px;">npm run ml:sync</code> 로 동기화해 주세요.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
      개념이 채워지면 다음 평일 오전 8시부터 다시 배달돼요.
    </p>
  `;
  return {
    subject: `[미소산랩] 커리큘럼 추가가 필요해요`,
    html: shell({
      preheader: '대기 중인 개념이 0개예요. 커리큘럼을 보충해 주세요.',
      title: '커리큘럼 추가 필요',
      accent: AMBER,
      bodyHtml: body,
      footer: BRAND,
    }),
    text:
      `[미소산랩] 커리큘럼 추가가 필요해요\n\n` +
      `대기 중인 커리큘럼 개념이 0개라 오늘은 메일을 보내지 않았어요.\n` +
      `curriculum.md 에 개념을 추가한 뒤 npm run ml:sync 로 동기화해 주세요.\n\n` +
      `— ${BRAND}`,
  };
}

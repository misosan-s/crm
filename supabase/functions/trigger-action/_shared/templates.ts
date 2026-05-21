// Vibe Mailer 이메일 템플릿
// 규칙: 이모지 금지, 인라인 스타일, Vivid Violet(#7C3AED) / Neon Green(#22C55E) 테마
// 이메일 클라이언트 호환을 위해 table-based layout + 인라인 style 위주

export type EmailType = 'guide' | 'error' | 'mission_completed' | 'follow_up';

export interface TemplateContext {
  name: string;
  email: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'Vibe Mailer';
const PRIMARY = '#7C3AED';
const ACCENT = '#22C55E';
const BG = '#F8FAFC';
const CARD = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';

function shell(args: { preheader: string; title: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Pretendard','Inter','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:${TEXT};">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(args.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 16px 16px 16px;">
              <div style="font-size:14px;font-weight:600;letter-spacing:0.04em;color:${PRIMARY};text-transform:uppercase;">${BRAND}</div>
            </td>
          </tr>
          <tr>
            <td style="background:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:32px;">
              ${args.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px;color:${MUTED};font-size:12px;line-height:1.6;">
              본 메일은 ${BRAND} 학습 대시보드 활동에 따라 자동 발송되었습니다.<br />
              수신을 원치 않으시면 대시보드 설정에서 알림을 끄실 수 있습니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.4;font-weight:700;color:${TEXT};">${escapeHtml(text)}</h1>`;
}

function lead(text: string): string {
  return `<p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:${MUTED};">${escapeHtml(text)}</p>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 10px 0;font-size:15px;font-weight:700;color:${TEXT};letter-spacing:-0.01em;">${escapeHtml(text)}</h2>`;
}

function bulletList(items: string[]): string {
  const lis = items
    .map(
      (i) =>
        `<li style="margin:0 0 8px 0;padding-left:16px;position:relative;color:${TEXT};">
          <span style="position:absolute;left:0;top:11px;width:6px;height:6px;background:${PRIMARY};border-radius:50%;display:inline-block;"></span>
          ${escapeHtml(i)}
        </li>`,
    )
    .join('');
  return `<ul style="margin:0 0 20px 0;padding:0;list-style:none;font-size:14px;line-height:1.8;">${lis}</ul>`;
}

function accentBadge(text: string): string {
  return `<div style="display:inline-block;padding:6px 12px;background:${ACCENT};color:#fff;font-size:12px;font-weight:700;border-radius:999px;letter-spacing:0.04em;">${escapeHtml(text)}</div>`;
}

function divider(): string {
  return `<hr style="margin:24px 0;border:none;border-top:1px solid ${BORDER};" />`;
}

// =========================================================
// 1) 실습 가이드 (click_guide → email_type=guide)
// =========================================================
export function renderGuide(ctx: TemplateContext): RenderedEmail {
  const body = `
    ${heading('실습 가이드 핵심 요약')}
    ${lead(`${ctx.name}님, 요청하신 실습 가이드 핵심 요약본을 정리해 드렸습니다.`)}
    ${sectionTitle('이번 차시 핵심 체크포인트')}
    ${bulletList([
      '환경 셋업: 필수 의존성 설치 및 환경 변수 확인',
      '코드 실행: 단계별 명령어와 기대 출력 확인',
      '검증: 결과물의 핵심 지표 또는 동작 확인 포인트',
      '다음 학습: 이 차시가 다음 차시와 어떻게 연결되는지',
    ])}
    ${divider()}
    ${sectionTitle('막힐 때')}
    ${lead('학습 대시보드에서 "에러와 싸우는 중" 버튼을 누르시면 자주 발생하는 에러 체크리스트가 즉시 발송됩니다.')}
  `;
  return {
    subject: '[Vibe Mailer] 요청하신 실습 가이드 요약본입니다',
    html: shell({
      preheader: `${ctx.name}님, 실습 가이드 핵심 요약본을 보내드립니다.`,
      title: '실습 가이드',
      bodyHtml: body,
    }),
    text:
      `${ctx.name}님, 실습 가이드 핵심 요약본입니다.\n\n` +
      `[이번 차시 핵심 체크포인트]\n` +
      `- 환경 셋업: 필수 의존성과 환경 변수\n` +
      `- 코드 실행: 단계별 명령어와 기대 출력\n` +
      `- 검증: 결과물 동작 확인 포인트\n` +
      `- 다음 학습: 다음 차시 연결 흐름\n\n` +
      `막힐 때는 대시보드에서 "에러와 싸우는 중" 버튼을 눌러주세요.\n` +
      `— Vibe Mailer`,
  };
}

// =========================================================
// 2) 에러와 싸우는 중 (click_error → email_type=error)
// =========================================================
export function renderError(ctx: TemplateContext): RenderedEmail {
  const body = `
    ${heading('지금 막혀 있는 게 정상입니다')}
    ${lead(`${ctx.name}님, 코드가 뜻대로 동작하지 않을 때 거의 모든 경우는 아래 4가지에서 막혀 있습니다.`)}
    ${sectionTitle('자주 발생하는 에러 체크리스트')}
    ${bulletList([
      '경로/타이포: 파일 경로 대소문자, 변수명 오타, 따옴표 누락',
      '의존성: package.json 의존성 미설치, 버전 불일치, 캐시',
      '환경변수: .env 파일 누락 또는 키 이름 오타, 재시작 누락',
      '실행 컨텍스트: 잘못된 디렉토리에서 실행, 권한 부족',
    ])}
    ${divider()}
    ${sectionTitle('막혀 있을 때 권장 순서')}
    ${bulletList([
      '에러 메시지의 첫 줄만 정확히 복사해서 검색',
      '바로 직전에 변경한 코드 한 줄을 되돌려보기',
      '같은 환경에서 새 터미널로 한 번 더 실행',
      '그래도 안 되면 30분 휴식 후 다시 시도',
    ])}
  `;
  return {
    subject: '[Vibe Mailer] 막혀 있을 때 확인하면 좋은 4가지',
    html: shell({
      preheader: '지금 막혀 있는 건 정상입니다. 자주 발생하는 에러 체크리스트를 보내드립니다.',
      title: '에러 체크리스트',
      bodyHtml: body,
    }),
    text:
      `${ctx.name}님, 막혀 있을 때 확인하면 좋은 4가지입니다.\n\n` +
      `1. 경로/타이포\n2. 의존성\n3. 환경변수\n4. 실행 컨텍스트\n\n` +
      `— Vibe Mailer`,
  };
}

// =========================================================
// 3) 미션 완료 (click_mission → email_type=mission_completed)
// =========================================================
export function renderMissionCompleted(ctx: TemplateContext): RenderedEmail {
  const body = `
    ${accentBadge('MISSION COMPLETED')}
    <div style="height:14px;"></div>
    ${heading(`${ctx.name}님, 한 단계 완수하셨습니다`)}
    ${lead('수료까지 한 단계 가까워졌습니다. 잠시 호흡을 정리하고 다음 단계로 넘어가 보세요.')}
    ${sectionTitle('다음 단계 로드맵')}
    ${bulletList([
      '오늘 배운 내용을 30분 안에 본인 언어로 메모',
      '학습 대시보드에서 다음 챕터 미리보기 열기',
      '연관 실습 1개를 직접 응용해 작성해 보기',
    ])}
    ${divider()}
    <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
      잠시 후 심화 강의를 함께 추천드리는 후속 메일이 도착합니다.
    </p>
  `;
  return {
    subject: '[Vibe Mailer] 미션 완료 — 다음 단계 로드맵',
    html: shell({
      preheader: `${ctx.name}님, 한 단계 완수하셨습니다. 다음 로드맵을 안내드립니다.`,
      title: '미션 완료',
      bodyHtml: body,
    }),
    text:
      `${ctx.name}님, 미션 완료 축하드립니다.\n\n` +
      `[다음 단계 로드맵]\n` +
      `1. 오늘 배운 내용을 본인 언어로 메모 (30분 안)\n` +
      `2. 다음 챕터 미리보기 열어보기\n` +
      `3. 연관 실습 1개 응용 작성\n\n` +
      `잠시 후 심화 강의 추천 메일이 도착합니다.\n— Vibe Mailer`,
  };
}

// =========================================================
// 4) 후속 — 미션 완료 5분 뒤 (email_type=follow_up)
// =========================================================
export function renderFollowUp(ctx: TemplateContext): RenderedEmail {
  const body = `
    ${heading('다음으로 도전할 만한 심화 코스')}
    ${lead(`${ctx.name}님, 방금 완료하신 학습의 자연스러운 다음 단계를 추천드립니다.`)}
    ${sectionTitle('추천 심화 코스')}
    ${bulletList([
      '실전 프로젝트 코스 — 이번 학습을 기반으로 한 미니 프로젝트',
      '고급 패턴 코스 — 흔히 마주치는 상황별 베스트 프랙티스',
      '코드 리뷰 워크숍 — 직접 작성한 코드를 받아 피드백받는 세션',
    ])}
    ${divider()}
    ${sectionTitle('이 메일이 오기까지')}
    <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
      "미션 완료" 클릭 후 5분이 경과하여 자동 발송된 후속 메일입니다.
    </p>
  `;
  return {
    subject: '[Vibe Mailer] 다음 단계로 도전할 만한 심화 코스 추천',
    html: shell({
      preheader: '방금 완료하신 학습의 다음 단계를 추천드립니다.',
      title: '심화 코스 추천',
      bodyHtml: body,
    }),
    text:
      `${ctx.name}님, 다음 단계 심화 코스를 추천드립니다.\n\n` +
      `- 실전 프로젝트 코스\n- 고급 패턴 코스\n- 코드 리뷰 워크숍\n\n` +
      `— Vibe Mailer`,
  };
}

// =========================================================
// Dispatcher
// =========================================================
export function renderEmail(type: EmailType, ctx: TemplateContext): RenderedEmail {
  switch (type) {
    case 'guide':
      return renderGuide(ctx);
    case 'error':
      return renderError(ctx);
    case 'mission_completed':
      return renderMissionCompleted(ctx);
    case 'follow_up':
      return renderFollowUp(ctx);
  }
}

// Anthropic Messages API 얇은 래퍼 (Deno)
// SDK 대신 fetch 직호출 — _shared/resend.ts 와 동일한 컨벤션, 의존성 최소화.
// 문서: https://platform.claude.com/docs/en/api/messages
//
// 하루 1회 lightweight 호출. 모델은 Claude Opus 4.8 (claude-opus-4-8).
// 구조화된 출력(output_config.format)으로 4단락을 JSON 으로 받아 파싱.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

// 문체 가이드 (PRD §7) — 비전공자 눈높이, 정중한 해요체, 일상 비유
const STYLE_SYSTEM = `당신은 비전공 개발자를 위한 학습 메일 "미소산랩"의 작성자예요.
독자는 Claude Code로 실제 개발 중이지만 개념 지도가 비어 있는 김약사 한 명이에요.

작성 규칙:
- 정중한 해요체로 써요 (예: "에이전트는 ~예요").
- 전문용어는 반드시 한 번은 쉬운 말로 풀어 설명해요.
- 어려운 개념은 일상적인 비유로 풀어요.
- 한 통을 5분 안에 읽도록, 각 단락은 3~4문장 이내로 짧게 써요.
- 이모지는 본문 안에 넣지 말아요 (제목/헤더는 시스템이 따로 붙여요).
- 마크다운 헤더(#)나 굵게(**) 표기는 쓰지 말고, 평범한 문장으로 써요.
- 코드나 명령어를 예로 들 땐 본문에 그대로 한 줄로 적어요.`;

export interface LessonInput {
  concept: string;
  dayNumber: number;
  total: number;
  sources: string; // 참조용 원문 (비어있을 수 있음)
}

export interface LessonContent {
  definition: string; // 📌 오늘의 개념
  analogy: string; // 🔍 비유로 이해하기
  in_claude_code: string; // 💻 Claude Code에서 마주치는 지점
  review_preview: string; // 🔁 한 줄 복습 + 내일 예고
}

const LESSON_SCHEMA = {
  type: 'object',
  properties: {
    definition: {
      type: 'string',
      description: '오늘의 개념을 한 줄 정의로 시작해 3~4문장으로 설명',
    },
    analogy: {
      type: 'string',
      description: '개념을 일상적인 비유로 풀어 설명 (3~4문장)',
    },
    in_claude_code: {
      type: 'string',
      description: 'Claude Code로 개발할 때 이 개념을 어디서 마주치는지 (3~4문장)',
    },
    review_preview: {
      type: 'string',
      description: '한 줄 복습 + 다음 개념에 대한 짧은 예고 (2~3문장)',
    },
  },
  required: ['definition', 'analogy', 'in_claude_code', 'review_preview'],
  additionalProperties: false,
};

export interface GenerateResult {
  ok: boolean;
  content?: LessonContent;
  error?: string;
}

export async function generateLesson(
  apiKey: string,
  input: LessonInput,
): Promise<GenerateResult> {
  if (!apiKey) {
    return { ok: false, error: 'ANTHROPIC_API_KEY missing' };
  }

  const sourceBlock = input.sources.trim()
    ? `참고 자료 (GitHub 원문 일부 — 정확성에 활용하세요):\n"""\n${input.sources.slice(0, 12000)}\n"""\n\n`
    : '';

  const prompt =
    `오늘의 개념은 "${input.concept}" 예요. ` +
    `전체 ${input.total}개 중 ${input.dayNumber}번째 메일이에요.\n\n` +
    sourceBlock +
    `이 개념을 위 문체 규칙에 맞춰 4단락으로 작성해 주세요:\n` +
    `1) definition: 오늘의 개념 (한 줄 정의로 시작)\n` +
    `2) analogy: 비유로 이해하기\n` +
    `3) in_claude_code: Claude Code에서 마주치는 지점\n` +
    `4) review_preview: 한 줄 복습 + 내일 예고`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: STYLE_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: LESSON_SCHEMA,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Anthropic ${res.status}: ${errText.slice(0, 500)}`,
      };
    }

    const json = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };

    if (json.stop_reason === 'refusal') {
      return { ok: false, error: 'Anthropic refused the request' };
    }

    const textBlock = json.content?.find((b) => b.type === 'text' && b.text);
    if (!textBlock?.text) {
      return { ok: false, error: 'No text block in Anthropic response' };
    }

    const parsed = JSON.parse(textBlock.text) as LessonContent;
    if (
      !parsed.definition ||
      !parsed.analogy ||
      !parsed.in_claude_code ||
      !parsed.review_preview
    ) {
      return { ok: false, error: 'Incomplete lesson content' };
    }

    return { ok: true, content: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

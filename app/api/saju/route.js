import {
  calculateFourPillars,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
} from "manseryeok";
import OpenAI from "openai";
import { MASTER_SYSTEM_PROMPT } from "./master-system-prompt.js";
import {
  calculateKoreanHourPillar,
  formatHourPillarStrings,
} from "./korean-hour-pillar.js";

export const maxDuration = 120;

const MODEL = "gpt-4o-mini";

/** 마스터 프롬프트 뒤에 붙는 JSON 출력 규약(마스터 지침과 충돌 시 이 규약이 최종 출력 형식을 결정한다) */
const SECTION_TYPES_ORDER = [
  "core_personality",
  "five_elements",
  "day_master",
  "weakness",
  "strength",
  "deep_personality",
  "career",
  "wealth",
  "love",
  "family",
  "relationship",
  "movement_luck",
  "final_advice",
];

const RESPONSE_FORMAT_APPENDIX = `
---
[JSON 출력 규약 — 반드시 준수]
- assistant 메시지 본문에는 **유효한 JSON 객체 하나만** 출력한다. 앞뒤 설명·인사·마크다운 코드펜스(\`\`\`)를 붙이지 않는다.
- 키는 반드시 "title"(문자열), "sections"(배열) 두 가지만 최상위에 둔다.
- "title": 사주 서비스 느낌의 감성적 한 줄 제목. 사용자 이름을 넣어 "{이름}님의 사주해설" 형태도 가능하다.
- "sections": 아래 type 값을 **이 순서 그대로** 13개 요소를 가진 배열. 각 요소는 "type"(문자열), "title"(문자열), "body"(문자열) 필수.
- "body" 안에는 마크다운 문법(#, **, \`\`\` 등)을 쓰지 않는다. 순수 평문(줄바꿈은 허용).

[sections[].body 작성 지침 — 글자 수 제한 없음, 분량·깊이만 강조]
- 각 section의 body는 **너무 짧지 않게** 작성한다.
- **최소 3~5문단 느낌**으로 충분히 설명한다(문단은 빈 줄로 나눈다).
- **명리학적 근거** + **현실적 해석** + **조언**을 섞어 포함한다.
- **단순 요약**이나 한 줄 결론만으로 끝내지 않는다.
- **한두 문장으로 끝내지 말 것.**

sections[].type 순서 (순서·철자 엄수):
1. core_personality — 핵심 성향 요약
2. five_elements — 오행 분석
3. day_master — 일주·십신 중심 분석
4. weakness — 단점·주의점
5. strength — 강점·위로
6. deep_personality — 성격 심층
7. career — 직업운
8. wealth — 재물운
9. love — 연애운
10. family — 가족운
11. relationship — 인간관계운
12. movement_luck — 거주·이동·개운
13. final_advice — 최종 조언

[작성 톤·내용 지침]
- sections[].title: 한 줄로 **감성적이고 후킹**되게. 뻔한 제목·상투적 문구는 피한다.
- sections[].body: 단순 운세 문장 나열이 아니라 **심리 분석·행동 패턴**에 가깝게 서술한다. 위 [sections[].body 작성 지침]을 반드시 따른다.
- 일간·월령·오행·십신·합충형파해 등 **명리학 용어를 적절히** 끼워 넣되, 과장된 미신·공포 조장은 금지.
- **디테일**: 사주 원국에서 읽히는 관계·오행·시간대 등 **구체적 단서**를 짚어, 독자가 **"소름 돋을 만큼" 와닿는** 관찰을 넣는다(허위 사실·사생활 추측·미래 단정은 금지).
- **위로**와 **직설적인 분석**을 섹션마다 균형 있게 섞는다(한쪽으로만 치우치지 않는다).
- user 메시지에 주어진 사주 원국·입력값만 근거로 하고, 없는 사실을 단정하지 않는다.
`.trim();

function buildSystemMessage() {
  const master = MASTER_SYSTEM_PROMPT.trim();
  if (!master) {
    return RESPONSE_FORMAT_APPENDIX;
  }
  return `${master}\n\n${RESPONSE_FORMAT_APPENDIX}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  ...corsHeaders,
};

/**
 * @param {unknown} birth
 * @returns {{ year: number; month: number; day: number } | null}
 */
function parseBirth(birth) {
  if (birth && typeof birth === "object" && !Array.isArray(birth)) {
    const y = Number(birth.year);
    const m = Number(birth.month);
    const d = Number(birth.day);
    if ([y, m, d].every((n) => Number.isFinite(n))) {
      return { year: y, month: m, day: d };
    }
    return null;
  }
  if (typeof birth !== "string") return null;
  const s = birth.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  m = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  return null;
}

/**
 * @param {unknown} time
 * @returns {{ hour: number; minute: number } | null}
 */
function parseTime(time) {
  if (time && typeof time === "object" && !Array.isArray(time)) {
    const hour = Number(time.hour);
    const minute = Number(time.minute ?? 0);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return { hour, minute };
    }
    return null;
  }
  if (typeof time !== "string") return null;
  const s = time.trim();
  let m = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return { hour: +m[1], minute: +(m[2] || 0) };
  m = s.match(/^(\d{2})(\d{2})$/);
  if (m) return { hour: +m[1], minute: +m[2] };
  return null;
}

function isValidBirthRange({ year, month, day }) {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function isValidTimeRange({ hour, minute }) {
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  return true;
}

/**
 * @param {import('manseryeok').FourPillarsDetail} pillars
 * @param {{ heavenlyStem: string; earthlyBranch: string; korean: string; hanja: string }} adjustedHour
 */
function pillarsContextForPrompt(pillars, adjustedHour) {
  const o = pillars.toObject();
  const h = pillars.toHanjaObject();
  const hourStemEl = getHeavenlyStemElement(
    /** @type {import("manseryeok").HeavenlyStem} */ (adjustedHour.heavenlyStem),
  );
  const hourBranchEl = getEarthlyBranchElement(
    /** @type {import("manseryeok").EarthlyBranch} */ (adjustedHour.earthlyBranch),
  );
  return [
    `사주 원국(한글): ${o.year}년주, ${o.month}월주, ${o.day}일주, ${adjustedHour.korean}시주 (시주는 한국형 30분 보정 시진 기준)`,
    `사주 원국(한자): ${h.year.hanja}年柱, ${h.month.hanja}月柱, ${h.day.hanja}日柱, ${adjustedHour.hanja}時柱`,
    `연주: ${o.year} (${h.year.hanja}) — 천간 오행:${pillars.yearElement.stem}, 지지 오행:${pillars.yearElement.branch}`,
    `월주: ${o.month} (${h.month.hanja}) — 천간 오행:${pillars.monthElement.stem}, 지지 오행:${pillars.monthElement.branch}`,
    `일주: ${o.day} (${h.day.hanja}) — 일간(일주 천간) 오행:${pillars.dayElement.stem}, 지지 오행:${pillars.dayElement.branch}`,
    `시주: ${adjustedHour.korean} (${adjustedHour.hanja}) — 천간 오행:${hourStemEl}, 지지 오행:${hourBranchEl}`,
  ].join("\n");
}

function stripJsonFences(raw) {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/m, "");
  }
  return t.trim();
}

function parseAssistantJson(text) {
  const cleaned = stripJsonFences(text);
  return JSON.parse(cleaned);
}

/**
 * @param {unknown} data
 * @returns {{ ok: true; value: { title: string; sections: Array<{ type: string; title: string; body: string }> } } | { ok: false; error: string }}
 */
function validateInterpretationPayload(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "최상위가 객체가 아닙니다." };
  }
  const rec = /** @type {Record<string, unknown>} */ (data);
  if (typeof rec.title !== "string" || !rec.title.trim()) {
    return { ok: false, error: "title이 비어 있거나 문자열이 아닙니다." };
  }
  if (!Array.isArray(rec.sections)) {
    return { ok: false, error: "sections가 배열이 아닙니다." };
  }
  if (rec.sections.length !== SECTION_TYPES_ORDER.length) {
    return {
      ok: false,
      error: `sections 길이는 ${SECTION_TYPES_ORDER.length}이어야 합니다. (실제: ${rec.sections.length})`,
    };
  }
  for (let i = 0; i < SECTION_TYPES_ORDER.length; i++) {
    const expectedType = SECTION_TYPES_ORDER[i];
    const item = rec.sections[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `sections[${i}]가 객체가 아닙니다.` };
    }
    const sec = /** @type {Record<string, unknown>} */ (item);
    if (sec.type !== expectedType) {
      return {
        ok: false,
        error: `sections[${i}].type은 "${expectedType}"이어야 합니다. (실제: ${String(sec.type)})`,
      };
    }
    if (typeof sec.title !== "string" || !sec.title.trim()) {
      return { ok: false, error: `sections[${i}].title이 비어 있거나 문자열이 아닙니다.` };
    }
    if (typeof sec.body !== "string" || !sec.body.trim()) {
      return { ok: false, error: `sections[${i}].body가 비어 있거나 문자열이 아닙니다.` };
    }
  }
  const extraKeys = Object.keys(rec).filter((k) => k !== "title" && k !== "sections");
  if (extraKeys.length > 0) {
    return {
      ok: false,
      error: `허용되지 않은 최상위 키: ${extraKeys.join(", ")}`,
    };
  }
  return {
    ok: true,
    value: {
      title: rec.title.trim(),
      sections: rec.sections.map((s) => {
        const o = /** @type {Record<string, unknown>} */ (s);
        return {
          type: String(o.type),
          title: String(o.title).trim(),
          body: String(o.body).trim(),
        };
      }),
    },
  };
}

/**
 * @param {{
 *   name: string;
 *   gender: string;
 *   birth: string;
 *   time: string;
 *   pillars: import('manseryeok').FourPillarsDetail;
 *   hour: number;
 *   minute: number;
 * }} input
 */
async function generateAiInterpretationJson(input) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const hourAdj = calculateKoreanHourPillar(
    input.pillars.day.heavenlyStem,
    input.hour,
    input.minute,
  );
  const hourFmt = formatHourPillarStrings(hourAdj);
  const adjustedHour = { ...hourAdj, ...hourFmt };
  const pillarBlock = pillarsContextForPrompt(input.pillars, adjustedHour);

  const user = `아래 입력 정보와 사주 원국을 바탕으로 해설을 작성하세요.

## 입력 정보
- **이름**: ${input.name}
- **성별**: ${input.gender}
- **생년월일**: ${input.birth}
- **태어난 시각**: ${input.time}

## 사주 원국 (만세력 계산 결과)
${pillarBlock}

## 출력 지시
응답은 반드시 [JSON 출력 규약]에 맞는 JSON 한 개만 출력하세요. sections는 **13개**이며 type·순서는 규약과 **완전히 동일**해야 합니다. 다른 문장은 쓰지 마세요.

각 section의 body는:
- 너무 짧지 않게 작성
- 최소 3~5문단 느낌으로 충분히 설명(문단은 빈 줄로 구분)
- 명리학적 근거 + 현실적 해석 + 조언을 포함
- 단순 요약 금지
- 한두 문장으로 끝내지 말 것`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: buildSystemMessage() },
      { role: "user", content: user },
    ],
    temperature: 0.65,
    max_tokens: 16384,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("EMPTY_COMPLETION");
  }

  let parsed;
  try {
    parsed = parseAssistantJson(text);
  } catch {
    throw new Error("AI 응답이 유효한 JSON이 아닙니다.");
  }

  const validated = validateInterpretationPayload(parsed);
  if (!validated.ok) {
    throw new Error(`AI JSON 스키마 검증 실패: ${validated.error}`);
  }

  return validated.value;
}

/**
 * @param {import('manseryeok').FourPillarsDetail} result
 * @param {{ korean: string; hanja: string; heavenlyStem: string; earthlyBranch: string }} adjustedHour
 */
function pillarPayload(result, adjustedHour) {
  return {
    yearPillar: {
      korean: result.yearString,
      hanja: result.yearHanja,
      heavenlyStem: result.year.heavenlyStem,
      earthlyBranch: result.year.earthlyBranch,
    },
    monthPillar: {
      korean: result.monthString,
      hanja: result.monthHanja,
      heavenlyStem: result.month.heavenlyStem,
      earthlyBranch: result.month.earthlyBranch,
    },
    dayPillar: {
      korean: result.dayString,
      hanja: result.dayHanja,
      heavenlyStem: result.day.heavenlyStem,
      earthlyBranch: result.day.earthlyBranch,
    },
    hourPillar: {
      korean: adjustedHour.korean,
      hanja: adjustedHour.hanja,
      heavenlyStem: adjustedHour.heavenlyStem,
      earthlyBranch: adjustedHour.earthlyBranch,
    },
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  return new Response(JSON.stringify({ message: "API working" }), {
    headers: jsonHeaders,
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "요청 본문이 올바른 JSON이 아닙니다." }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const { name, birth, gender, time, isLunar, isLeapMonth } = body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof gender !== "string" ||
    !gender.trim()
  ) {
    return new Response(
      JSON.stringify({
        error: "name과 gender는 비어 있지 않은 문자열이어야 합니다.",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const datePart = parseBirth(birth);
  if (!datePart || !isValidBirthRange(datePart)) {
    return new Response(
      JSON.stringify({
        error:
          "birth는 유효한 생년월일이어야 합니다. 예: \"1990-05-15\", \"1990/5/15\", { \"year\":1990,\"month\":5,\"day\":15 }",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const timePart = parseTime(time);
  if (!timePart || !isValidTimeRange(timePart)) {
    return new Response(
      JSON.stringify({
        error:
          "time은 유효한 시각이어야 합니다. 예: \"14:30\", \"14:30:00\", \"1430\", { \"hour\":14,\"minute\":30 }",
      }),
      { status: 400, headers: jsonHeaders },
    );
  }

  let pillars;
  try {
    pillars = calculateFourPillars({
      year: datePart.year,
      month: datePart.month,
      day: datePart.day,
      hour: timePart.hour,
      minute: timePart.minute,
      isLunar: Boolean(isLunar),
      isLeapMonth: Boolean(isLeapMonth),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "사주 계산 중 오류가 발생했습니다.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const hourAdj = calculateKoreanHourPillar(
    pillars.day.heavenlyStem,
    timePart.hour,
    timePart.minute,
  );
  const adjustedHour = { ...hourAdj, ...formatHourPillarStrings(hourAdj) };
  const pillarsJson = pillarPayload(pillars, adjustedHour);

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "서버에 OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다. Vercel·로컬 환경에 키를 등록한 뒤 다시 시도하세요.",
      }),
      { status: 503, headers: jsonHeaders },
    );
  }

  let interpretation;
  try {
    interpretation = await generateAiInterpretationJson({
      name: name.trim(),
      gender: gender.trim(),
      birth: String(birth),
      time: String(time),
      pillars,
      hour: timePart.hour,
      minute: timePart.minute,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AI 해설 생성 중 오류가 발생했습니다.";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      ...interpretation,
      ...pillarsJson,
    }),
    { headers: jsonHeaders },
  );
}

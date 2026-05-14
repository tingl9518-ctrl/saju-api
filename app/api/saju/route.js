import { calculateFourPillars } from "manseryeok";
import OpenAI from "openai";
import { MASTER_SYSTEM_PROMPT } from "./master-system-prompt.js";

export const maxDuration = 60;

const MODEL = "gpt-4o-mini";

/** 마스터 프롬프트 뒤에 붙는 출력·형식 보강(마스터에 동일 내용이 있어도 중복되어도 무방) */
const RESPONSE_FORMAT_APPENDIX = `
---
[출력 공통 규약]
- 응답 전체는 한국어 **마크다운**으로 작성한다.
- 반드시 아래 네 개의 2단계 제목을 **위에서부터 이 순서 그대로** 포함한다(제목 문자열·순서 엄수):
  ## 성격
  ## 연애
  ## 재물
  ## 직업
- 각 섹션은 여러 문단으로 나누고, 필요하면 \`- \` 목록·강조(**굵게**)를 사용해 **충분히 길고 깊이 있게** 서술한다.
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
 */
function pillarsContextForPrompt(pillars) {
  const o = pillars.toObject();
  const h = pillars.toHanjaObject();
  return [
    `사주 원국(한글): ${pillars.toString()}`,
    `사주 원국(한자): ${pillars.toHanjaString()}`,
    `연주: ${o.year} (${h.year.hanja}) — 천간 오행:${pillars.yearElement.stem}, 지지 오행:${pillars.yearElement.branch}`,
    `월주: ${o.month} (${h.month.hanja}) — 천간 오행:${pillars.monthElement.stem}, 지지 오행:${pillars.monthElement.branch}`,
    `일주: ${o.day} (${h.day.hanja}) — 일간(일주 천간) 오행:${pillars.dayElement.stem}, 지지 오행:${pillars.dayElement.branch}`,
    `시주: ${o.hour} (${h.hour.hanja}) — 천간 오행:${pillars.hourElement.stem}, 지지 오행:${pillars.hourElement.branch}`,
  ].join("\n");
}

/**
 * @param {{
 *   name: string;
 *   gender: string;
 *   birth: string;
 *   time: string;
 *   pillars: import('manseryeok').FourPillarsDetail;
 * }} input
 */
async function generateAiSummary(input) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const pillarBlock = pillarsContextForPrompt(input.pillars);

  const user = `아래 입력 정보와 사주 원국을 바탕으로 해설을 작성하세요.

## 입력 정보
- **이름**: ${input.name}
- **성별**: ${input.gender}
- **생년월일**: ${input.birth}
- **태어난 시각**: ${input.time}

## 사주 원국 (만세력 계산 결과)
${pillarBlock}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: buildSystemMessage() },
      { role: "user", content: user },
    ],
    temperature: 0.72,
    max_tokens: 8192,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("EMPTY_COMPLETION");
  }
  return text;
}

function pillarPayload(result) {
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
      korean: result.hourString,
      hanja: result.hourHanja,
      heavenlyStem: result.hour.heavenlyStem,
      earthlyBranch: result.hour.earthlyBranch,
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

  const pillarsJson = pillarPayload(pillars);

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "서버에 OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다. Vercel·로컬 환경에 키를 등록한 뒤 다시 시도하세요.",
      }),
      { status: 503, headers: jsonHeaders },
    );
  }

  let summary;
  try {
    summary = await generateAiSummary({
      name: name.trim(),
      gender: gender.trim(),
      birth: String(birth),
      time: String(time),
      pillars,
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
      title: `${name.trim()}님의 사주해설`,
      summary,
      ...pillarsJson,
    }),
    { headers: jsonHeaders },
  );
}

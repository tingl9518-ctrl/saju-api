import { calculateFourPillars } from "manseryeok";

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
 * @param {import('manseryeok').FourPillarsDetail} result
 */
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

  return new Response(
    JSON.stringify({
      title: `${name.trim()}님의 사주해설`,
      summary: `${name.trim()}님은 ${String(birth)} ${String(time)} 출생(${gender.trim()})이며, 사주 원국은 ${pillars.toString()} 입니다.`,
      ...pillarsJson,
    }),
    { headers: jsonHeaders },
  );
}

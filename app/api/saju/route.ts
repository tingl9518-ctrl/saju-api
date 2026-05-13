import { NextResponse } from "next/server";

export type SajuRequestBody = {
  name: string;
  birth: string;
  gender: string;
  time: string;
};

export type SajuResponseBody = {
  title: string;
  summary: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildPayload(input: SajuRequestBody): SajuResponseBody {
  const name = input.name.trim();
  const birth = input.birth.trim();
  const gender = input.gender.trim();
  const time = input.time.trim();
  return {
    title: "깊은 물속의 불꽃",
    summary: `당신은 ${name}님, ${birth} ${time} 출생(${gender})을 바탕으로 한 사주의 한 줄 요약입니다. 실제 명식 계산은 이후 단계에서 연결할 수 있습니다.`,
  };
}

/** 브라우저에서 파라미터 없이 열었을 때 보여 줄 고정 예시 응답 */
const EXAMPLE_GET_RESPONSE: SajuResponseBody = {
  title: "깊은 물속의 불꽃",
  summary: "당신은...",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const birth = searchParams.get("birth");
  const gender = searchParams.get("gender");
  const time = searchParams.get("time");

  if (
    isNonEmptyString(name) &&
    isNonEmptyString(birth) &&
    isNonEmptyString(gender) &&
    isNonEmptyString(time)
  ) {
    return NextResponse.json(
      buildPayload({ name, birth, gender, time }) satisfies SajuResponseBody,
    );
  }

  return NextResponse.json(EXAMPLE_GET_RESPONSE);
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 },
    );
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json(
      { error: "요청 본문은 객체여야 합니다." },
      { status: 400 },
    );
  }

  const body = raw as Partial<SajuRequestBody>;
  const name = body.name;
  const birth = body.birth;
  const gender = body.gender;
  const time = body.time;

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(birth) ||
    !isNonEmptyString(gender) ||
    !isNonEmptyString(time)
  ) {
    return NextResponse.json(
      {
        error:
          "필수 필드가 누락되었습니다. name, birth, gender, time을 모두 문자열로 보내 주세요.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    buildPayload({ name, birth, gender, time }) satisfies SajuResponseBody,
  );
}

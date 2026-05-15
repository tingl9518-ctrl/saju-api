/**
 * 골든 회귀: reference/golden/golden-cases.json
 * 계산 경로: app/api/saju/compute-pillars-korean.js (POST /api/saju 와 동일)
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import {
  computePillarsKorean,
  koreanPillarsFromComputed,
} from "../app/api/saju/compute-pillars-korean.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFixturePath = join(__dirname, "../reference/golden/golden-cases.json");
const fixturePath = process.env.GOLDEN_CASES_PATH ?? defaultFixturePath;

if (!existsSync(fixturePath)) {
  throw new Error(
    `골든 fixture 없음: ${fixturePath}\n` +
      `reference/golden/golden-cases.json 을 두거나 GOLDEN_CASES_PATH 를 설정하세요.`,
  );
}

const goldenDoc = JSON.parse(readFileSync(fixturePath, "utf8"));
const cases = goldenDoc.cases;

const skipReason =
  "enabled:false — 운세위키(또는 기준 서비스)에서 expected 채운 뒤 enabled 제거";

/** 활성 회귀: `enabled:false`(미검증 템플릿) 또는 `known_mismatch:true`(정책·데이터 미확정) 제외. */
function isCaseActive(c) {
  return c.enabled !== false && c.known_mismatch !== true;
}

function inactiveSkipMessage(c) {
  if (typeof c.reason === "string" && c.reason.trim()) {
    return c.reason.trim();
  }
  return skipReason;
}

for (const c of cases) {
  assert.ok(c && typeof c.id === "string", "각 케이스에 id 가 필요합니다.");
  assert.ok(c.input && typeof c.input === "object", `${c.id}: input 필요`);
  assert.ok(c.expected && typeof c.expected === "object", `${c.id}: expected 필요`);
  assert.ok(
    Array.isArray(c.category) && c.category.length > 0,
    `${c.id}: category 는 비어 있지 않은 배열이어야 합니다.`,
  );
  if (c.known_mismatch === true) {
    assert.ok(
      typeof c.reason === "string" && c.reason.trim(),
      `${c.id}: known_mismatch 일 때는 reason(비어 있지 않은 문자열) 필수`,
    );
  }
  if (isCaseActive(c)) {
    for (const k of ["year", "month", "day", "hour"]) {
      const v = c.expected[k];
      assert.ok(
        typeof v === "string" && v.length > 0 && v !== "__TODO__",
        `${c.id}: expected.${k} 는 비어 있지 않은 한글 간지(활성 케이스). 템플릿은 enabled:false 사용.`,
      );
    }
  } else {
    for (const k of ["year", "month", "day", "hour"]) {
      assert.ok(
        k in c.expected,
        `${c.id}: expected.${k} 키는 템플릿에도 필요(값은 __TODO__ 가능).`,
      );
    }
  }
}

/**
 * @param {{ calendar: string; year: number; month: number; day: number; hour: number; minute?: number; isLeapMonth?: boolean }} input
 */
function inputToComputeParams(input) {
  const isLunar = input.calendar === "lunar";
  const params = {
    birth: {
      year: input.year,
      month: input.month,
      day: input.day,
    },
    time: {
      hour: input.hour,
      minute: input.minute ?? 0,
    },
    isLunar,
    isLeapMonth: Boolean(input.isLeapMonth),
  };
  if (input.yajaMode !== undefined && input.yajaMode !== null) {
    params.yajaMode = input.yajaMode;
  }
  return params;
}

/**
 * @param {{ id: string; expected: Record<string, string> }} c
 * @param {Record<string, string>} actual
 */
function formatPillarMismatch(c, actual) {
  const keys = ["year", "month", "day", "hour"];
  const lines = [`case id: ${c.id}`];
  for (const k of keys) {
    const exp = c.expected[k];
    const act = actual[k];
    if (exp !== act) {
      lines.push(`${k}: expected "${exp}", actual "${act}"`);
    }
  }
  return lines.join("\n");
}

function assertGoldenCase(c) {
  const actual = koreanPillarsFromComputed(
    computePillarsKorean(inputToComputeParams(c.input)),
  );
  const ok =
    actual.year === c.expected.year &&
    actual.month === c.expected.month &&
    actual.day === c.expected.day &&
    actual.hour === c.expected.hour;
  if (!ok) {
    assert.fail(formatPillarMismatch(c, actual));
  }
}

/** 동일 id 가 여러 category 태그를 가질 때 테스트를 한 번만 실행한다. */
describe("golden (active)", () => {
  const active = cases.filter(isCaseActive);
  const byId = new Map(active.map((c) => [c.id, c]));
  for (const c of byId.values()) {
    const tags = [...(c.category ?? [])].sort().join(", ");
    test(`${c.id} [${tags}]`, () => {
      assertGoldenCase(c);
    });
  }
});

describe("golden (inactive / skipped)", () => {
  for (const c of cases.filter((x) => !isCaseActive(x))) {
    test(c.id, { skip: inactiveSkipMessage(c) }, () => {
      assertGoldenCase(c);
    });
  }
});

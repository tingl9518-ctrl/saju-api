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

for (const c of cases) {
  assert.ok(c && typeof c.id === "string", "각 케이스에 id 가 필요합니다.");
  assert.ok(c.input && typeof c.input === "object", `${c.id}: input 필요`);
  assert.ok(c.expected && typeof c.expected === "object", `${c.id}: expected 필요`);
  assert.ok(
    Array.isArray(c.category) && c.category.length > 0,
    `${c.id}: category 는 비어 있지 않은 배열이어야 합니다.`,
  );
}

/**
 * @param {{ calendar: string; year: number; month: number; day: number; hour: number; minute?: number; isLeapMonth?: boolean }} input
 */
function inputToComputeParams(input) {
  const isLunar = input.calendar === "lunar";
  return {
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

const categories = [...new Set(cases.flatMap((c) => c.category ?? []))].sort();

for (const cat of categories) {
  describe(`golden [${cat}]`, () => {
    for (const c of cases.filter((x) => (x.category ?? []).includes(cat))) {
      test(c.id, () => {
        assertGoldenCase(c);
      });
    }
  });
}

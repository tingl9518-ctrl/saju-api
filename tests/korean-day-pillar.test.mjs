import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calculateKoreanDayPillar,
  formatDayPillarStrings,
  solarCalendarDateToKstMidnightMs,
} from "../app/api/saju/korean-day-pillar.js";
import {
  computePillarsKorean,
  koreanPillarsFromComputed,
} from "../app/api/saju/compute-pillars-korean.js";

describe("korean-day-pillar", () => {
  test("base date 1992-10-24 KST = 계유", () => {
    const p = calculateKoreanDayPillar(1992, 10, 24);
    assert.equal(formatDayPillarStrings(p).korean, "계유");
  });

  test("1955-09-08 KST = 임신 (wiki)", () => {
    const p = calculateKoreanDayPillar(1955, 9, 8);
    assert.equal(formatDayPillarStrings(p).korean, "임신");
  });

  test("KST midnight parse is stable", () => {
    assert.equal(
      solarCalendarDateToKstMidnightMs(1955, 9, 8),
      Date.parse("1955-09-08T00:00:00+09:00"),
    );
  });
});

describe("computePillarsKorean day TZ fix", () => {
  test("1955-09-08 12:00 day pillar 임신", () => {
    const k = koreanPillarsFromComputed(
      computePillarsKorean({
        birth: { year: 1955, month: 9, day: 8 },
        time: { hour: 12, minute: 0 },
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "apply",
      }),
    );
    assert.equal(k.day, "임신");
  });

  test("1955-09-08 11:44 full pillars", () => {
    const k = koreanPillarsFromComputed(
      computePillarsKorean({
        birth: { year: 1955, month: 9, day: 8 },
        time: { hour: 11, minute: 44 },
        isLunar: false,
        isLeapMonth: false,
        yajaMode: "apply",
      }),
    );
    assert.deepEqual(k, {
      year: "을미",
      month: "갑신",
      day: "임신",
      hour: "병오",
    });
  });
});

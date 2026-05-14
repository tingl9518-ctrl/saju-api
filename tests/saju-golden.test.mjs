import assert from "node:assert/strict";
import test from "node:test";
import { calculateFourPillars } from "manseryeok";
import {
  calculateKoreanMonthPillar,
  formatMonthPillarStrings,
} from "../app/api/saju/korean-month-pillar.js";
import {
  calculateKoreanHourPillar,
  formatHourPillarStrings,
} from "../app/api/saju/korean-hour-pillar.js";

test("golden: 1995-12-18 09:00 KST → 을해·무자·계미·병진", () => {
  const pillars = calculateFourPillars({
    year: 1995,
    month: 12,
    day: 18,
    hour: 9,
    minute: 0,
    isLunar: false,
    isLeapMonth: false,
  });
  const monthAdj = calculateKoreanMonthPillar(1995, 12, 18, 9, 0);
  const monthFmt = formatMonthPillarStrings(monthAdj);
  const hourAdj = calculateKoreanHourPillar(pillars.day.heavenlyStem, 9, 0);
  const hourFmt = formatHourPillarStrings(hourAdj);

  assert.equal(pillars.yearString, "을해");
  assert.equal(monthFmt.korean, "무자");
  assert.equal(pillars.dayString, "계미");
  assert.equal(hourFmt.korean, "병진");
});

test("절입 경계: 대설 직전·직후 (1995-12)", () => {
  const before = formatMonthPillarStrings(
    calculateKoreanMonthPillar(1995, 12, 8, 7, 0),
  ).korean;
  const after = formatMonthPillarStrings(
    calculateKoreanMonthPillar(1995, 12, 8, 7, 24),
  ).korean;
  assert.equal(before, "정해");
  assert.equal(after, "무자");
});

test("절입 경계: 소한 직전·직후 (1996-01, 사주연 1995)", () => {
  const before = formatMonthPillarStrings(
    calculateKoreanMonthPillar(1996, 1, 6, 18, 31),
  ).korean;
  const after = formatMonthPillarStrings(
    calculateKoreanMonthPillar(1996, 1, 6, 18, 32),
  ).korean;
  assert.equal(before, "무자");
  assert.equal(after, "기축");
});

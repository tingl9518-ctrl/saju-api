import assert from "node:assert/strict";
import test from "node:test";
import { calculateFourPillars } from "manseryeok";
import {
  calculateKoreanMonthPillar,
  calculateYearPillarFromBaziYear,
  formatMonthPillarStrings,
} from "../app/api/saju/korean-month-pillar.js";
import {
  calculateKoreanHourPillar,
  formatHourPillarStrings,
} from "../app/api/saju/korean-hour-pillar.js";

function assertFourPillars(solarY, m, d, h, mi, { year, month, day, hour }) {
  const pillars = calculateFourPillars({
    year: solarY,
    month: m,
    day: d,
    hour: h,
    minute: mi,
    isLunar: false,
    isLeapMonth: false,
  });
  const monthAdj = calculateKoreanMonthPillar(solarY, m, d, h, mi);
  const monthFmt = formatMonthPillarStrings(monthAdj);
  const yearStemBranch = calculateYearPillarFromBaziYear(monthAdj.baziYear);
  const yearFmt = formatMonthPillarStrings(yearStemBranch);
  const hourAdj = calculateKoreanHourPillar(pillars.day.heavenlyStem, h, mi);
  const hourFmt = formatHourPillarStrings(hourAdj);

  assert.equal(yearFmt.korean, year, `연주 ${solarY}-${m}-${d} ${h}:${mi}`);
  assert.equal(monthFmt.korean, month, `월주 ${solarY}-${m}-${d} ${h}:${mi}`);
  assert.equal(pillars.dayString, day, `일주 ${solarY}-${m}-${d} ${h}:${mi}`);
  assert.equal(hourFmt.korean, hour, `시주 ${solarY}-${m}-${d} ${h}:${mi}`);
}

test("golden: 1995-12-18 09:00 KST → 을해·무자·계미·병진", () => {
  assertFourPillars(1995, 12, 18, 9, 0, {
    year: "을해",
    month: "무자",
    day: "계미",
    hour: "병진",
  });
});

test("1997-02-04 입춘 전후: 연·월 동일 baziYear (bundle 입춘)", () => {
  assertFourPillars(1997, 2, 4, 3, 0, {
    year: "병자",
    month: "신축",
    day: "정축",
    hour: "신축",
  });
  assertFourPillars(1997, 2, 4, 5, 0, {
    year: "정축",
    month: "임인",
    day: "정축",
    hour: "임인",
  });
  assertFourPillars(1997, 2, 4, 6, 0, {
    year: "정축",
    month: "임인",
    day: "정축",
    hour: "계묘",
  });
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

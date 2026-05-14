import { calculateFourPillars, lunarToSolar } from "manseryeok";
import {
  calculateKoreanHourPillar,
  formatHourPillarStrings,
} from "./korean-hour-pillar.js";
import {
  calculateKoreanMonthPillar,
  calculateYearPillarFromBaziYear,
  formatMonthPillarStrings,
} from "./korean-month-pillar.js";

/**
 * 만세력과 동일한 양력 생일(음력 입력 시 변환).
 * @param {{ year: number; month: number; day: number }} datePart
 * @param {boolean} isLunar
 * @param {boolean} isLeapMonth
 */
export function resolveSolarBirthDateParts(datePart, isLunar, isLeapMonth) {
  if (!isLunar) return datePart;
  const solar = lunarToSolar(
    datePart.year,
    datePart.month,
    datePart.day,
    isLeapMonth,
  );
  return { year: solar.year, month: solar.month, day: solar.day };
}

/**
 * POST /api/saju 와 동일한 경로로 연·월·일·시 기둥을 계산한다.
 *
 * @param {{
 *   birth: { year: number; month: number; day: number };
 *   time: { hour: number; minute: number };
 *   isLunar: boolean;
 *   isLeapMonth: boolean;
 * }} params
 * @returns {{
 *   pillars: import("manseryeok").FourPillarsDetail;
 *   adjustedYear: { heavenlyStem: string; earthlyBranch: string; korean: string; hanja: string };
 *   adjustedMonth: { heavenlyStem: string; earthlyBranch: string; korean: string; hanja: string };
 *   adjustedHour: { heavenlyStem: string; earthlyBranch: string; korean: string; hanja: string };
 * }}
 */
export function computePillarsKorean({ birth, time, isLunar, isLeapMonth }) {
  const pillars = calculateFourPillars({
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: time.hour,
    minute: time.minute,
    isLunar,
    isLeapMonth,
  });

  const solarBirth = resolveSolarBirthDateParts(birth, isLunar, isLeapMonth);

  const monthAdj = calculateKoreanMonthPillar(
    solarBirth.year,
    solarBirth.month,
    solarBirth.day,
    time.hour,
    time.minute,
  );
  const monthStr = formatMonthPillarStrings(monthAdj);
  const adjustedMonth = {
    heavenlyStem: monthAdj.heavenlyStem,
    earthlyBranch: monthAdj.earthlyBranch,
    korean: monthStr.korean,
    hanja: monthStr.hanja,
  };

  const yearStemBranch = calculateYearPillarFromBaziYear(monthAdj.baziYear);
  const yearStr = formatMonthPillarStrings(yearStemBranch);
  const adjustedYear = {
    heavenlyStem: yearStemBranch.heavenlyStem,
    earthlyBranch: yearStemBranch.earthlyBranch,
    korean: yearStr.korean,
    hanja: yearStr.hanja,
  };

  const hourAdj = calculateKoreanHourPillar(
    pillars.day.heavenlyStem,
    time.hour,
    time.minute,
  );
  const adjustedHour = { ...hourAdj, ...formatHourPillarStrings(hourAdj) };

  return { pillars, adjustedYear, adjustedMonth, adjustedHour };
}

/**
 * 골든 fixture `expected` 필드와 동일한 형태의 한글 네 기둥.
 * @param {ReturnType<typeof computePillarsKorean>} computed
 */
export function koreanPillarsFromComputed(computed) {
  return {
    year: computed.adjustedYear.korean,
    month: computed.adjustedMonth.korean,
    day: computed.pillars.dayString,
    hour: computed.adjustedHour.korean,
  };
}

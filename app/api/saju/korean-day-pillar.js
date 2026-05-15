import {
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  getHeavenlyStemYinYang,
  getEarthlyBranchYinYang,
} from "manseryeok";

/** manseryeok getDayPillar 기준일 — KST 달력 1992-10-24 = 계유 (sexagenary index 9) */
const BASE_KST_ISO = "1992-10-24T00:00:00+09:00";
const BASE_GANJI_NUM = 9;
const MS_PER_DAY = 86400000;

/**
 * 양력 연·월·일을 KST(+09:00) 달력일 00:00 epoch ms 로 변환한다.
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day 1–31
 */
export function solarCalendarDateToKstMidnightMs(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`유효하지 않은 양력 일자: ${iso}`);
  }
  return ms;
}

/**
 * KST 달력일 기준 60갑자 일주 (manseryeok 공식, TZ 무관).
 *
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {{ heavenlyStem: string; earthlyBranch: string }}
 */
export function calculateKoreanDayPillar(year, month, day) {
  const baseMs = Date.parse(BASE_KST_ISO);
  const targetMs = solarCalendarDateToKstMidnightMs(year, month, day);
  const daysDiff = Math.floor((targetMs - baseMs) / MS_PER_DAY);
  const ganjiNum = (((BASE_GANJI_NUM + daysDiff) % 60) + 60) % 60;
  return {
    heavenlyStem: HEAVENLY_STEMS[ganjiNum % 10],
    earthlyBranch: EARTHLY_BRANCHES[ganjiNum % 12],
  };
}

/**
 * @param {{ heavenlyStem: string; earthlyBranch: string }} pillar
 */
export function formatDayPillarStrings(pillar) {
  const si = HEAVENLY_STEMS.indexOf(
    /** @type {(typeof HEAVENLY_STEMS)[number]} */ (pillar.heavenlyStem),
  );
  const bi = EARTHLY_BRANCHES.indexOf(
    /** @type {(typeof EARTHLY_BRANCHES)[number]} */ (pillar.earthlyBranch),
  );
  const korean = `${pillar.heavenlyStem}${pillar.earthlyBranch}`;
  const hanja = `${HEAVENLY_STEMS_HANJA[si]}${EARTHLY_BRANCHES_HANJA[bi]}`;
  return { korean, hanja };
}

/**
 * @param {import("manseryeok").FourPillarsDetail} pillars
 * @param {{ heavenlyStem: string; earthlyBranch: string }} dayAdj
 */
export function applyKoreanDayPillarToManseryeokDetail(pillars, dayAdj) {
  const stem = /** @type {import("manseryeok").HeavenlyStem} */ (dayAdj.heavenlyStem);
  const branch = /** @type {import("manseryeok").EarthlyBranch} */ (dayAdj.earthlyBranch);
  const formatted = formatDayPillarStrings(dayAdj);

  pillars.day = { heavenlyStem: dayAdj.heavenlyStem, earthlyBranch: dayAdj.earthlyBranch };
  pillars.dayString = formatted.korean;
  pillars.dayHanja = formatted.hanja;
  pillars.dayElement = {
    stem: getHeavenlyStemElement(stem),
    branch: getEarthlyBranchElement(branch),
  };
  pillars.dayYinYang = {
    stem: getHeavenlyStemYinYang(stem),
    branch: getEarthlyBranchYinYang(branch),
  };
}

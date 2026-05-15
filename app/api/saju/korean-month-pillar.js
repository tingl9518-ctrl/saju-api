import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
} from "manseryeok";
import {
  BIRTH_YEAR_MIN,
  BIRTH_YEAR_MAX,
  BAZI_YEAR_MIN,
  BAZI_YEAR_MAX,
} from "./solar-terms-range.js";

/** MVP 출생 연도(양력 연도 기준, 음력 변환 후에도 동일 검사 권장) */
export const MVP_BIRTH_YEAR_MIN = BIRTH_YEAR_MIN;
export const MVP_BIRTH_YEAR_MAX = BIRTH_YEAR_MAX;

/** bundle.json 내 사주연도(입춘 기준) 키 범위와 맞춤 */
const BUNDLE_BAZI_YEAR_MIN = BAZI_YEAR_MIN;
const BUNDLE_BAZI_YEAR_MAX = BAZI_YEAR_MAX;

let _bundle = null;

function loadBundle() {
  if (_bundle) return _bundle;
  const path = join(
    process.cwd(),
    "app",
    "api",
    "saju",
    "data",
    "solar-terms",
    "bundle.json",
  );
  _bundle = JSON.parse(readFileSync(path, "utf8"));
  return _bundle;
}

/** KST 벽시계 → UTC epoch ms */
export function kstWallTimeToUtcMs(year, month, day, hour, minute) {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`유효하지 않은 일시: ${iso}`);
  }
  return ms;
}

/**
 * 양력 연·월·일·시·분(KST) 기준 사주 연도(입춘 시각 기준)
 */
export function resolveBaziYear(
  calendarYear,
  month,
  day,
  hour,
  minute,
  bundle = loadBundle(),
) {
  const birthMs = kstWallTimeToUtcMs(calendarYear, month, day, hour, minute);
  const lichunThis = Date.parse(
    bundle.lichunUtcByCalendarYear[String(calendarYear)],
  );
  if (Number.isNaN(lichunThis)) {
    throw new Error(`입춘 데이터 없음: calendarYear=${calendarYear}`);
  }
  if (birthMs < lichunThis) {
    return calendarYear - 1;
  }
  return calendarYear;
}

/** 12절 id → manseryeok 월지 순번(1=寅 … 11=子 12=丑) */
const JIE_ID_TO_SOLAR_MONTH_RANK = {
  lichun: 1,
  jingzhe: 2,
  qingming: 3,
  lixia: 4,
  mangzhong: 5,
  xiaoshu: 6,
  liqiu: 7,
  bailu: 8,
  hanlu: 9,
  lidong: 10,
  daxue: 11,
  xiaohan: 12,
};

const MONTH_RANK_TO_BRANCH = {
  1: "인",
  2: "묘",
  3: "진",
  4: "사",
  5: "오",
  6: "미",
  7: "신",
  8: "유",
  9: "술",
  10: "해",
  11: "자",
  12: "축",
};

/**
 * manseryeok getMonthPillar와 동일한 월간 인덱스 공식
 * @param {number} baziYear
 * @param {number} solarMonthRank 1..12
 */
function monthStemIndexFromBaziYear(baziYear, solarMonthRank) {
  const yearStemIndex = (baziYear - 4) % 10;
  const yearStemMod5 = yearStemIndex % 5;
  return (yearStemMod5 * 2 + solarMonthRank + 1) % 10;
}

/**
 * 입춘 기준 사주연도(baziYear)의 연주(천간·지지). manseryeok getYearPillar(year)와 동일 공식.
 * @param {number} baziYear
 */
export function calculateYearPillarFromBaziYear(baziYear) {
  const si = ((baziYear - 4) % 10 + 10) % 10;
  const bi = ((baziYear - 4) % 12 + 12) % 12;
  return {
    heavenlyStem: HEAVENLY_STEMS[si],
    earthlyBranch: EARTHLY_BRANCHES[bi],
  };
}

/**
 * 절입 JSON + 입춘 기준 사주연도의 년간으로 월주(천간·지지).
 *
 * @param {number} calendarYear 양력 연
 * @param {number} month 양력 월 1-12
 * @param {number} day 양력 일
 * @param {number} hour 0-23 (KST)
 * @param {number} minute 0-59 (KST)
 */
export function calculateKoreanMonthPillar(
  calendarYear,
  month,
  day,
  hour,
  minute,
) {
  if (
    calendarYear < MVP_BIRTH_YEAR_MIN ||
    calendarYear > MVP_BIRTH_YEAR_MAX
  ) {
    throw new RangeError(
      `월주 데이터 MVP 범위는 ${MVP_BIRTH_YEAR_MIN}~${MVP_BIRTH_YEAR_MAX}년 양력 출생입니다.`,
    );
  }

  const bundle = loadBundle();
  const birthMs = kstWallTimeToUtcMs(calendarYear, month, day, hour, minute);
  const baziYear = resolveBaziYear(
    calendarYear,
    month,
    day,
    hour,
    minute,
    bundle,
  );

  if (baziYear < BUNDLE_BAZI_YEAR_MIN || baziYear > BUNDLE_BAZI_YEAR_MAX) {
    throw new RangeError(
      `절입 데이터가 없는 사주연도입니다: ${baziYear} (입력 연도 ${calendarYear})`,
    );
  }

  const terms = bundle.baziyearTerms[String(baziYear)];
  if (!terms?.length) {
    throw new Error(`baziyearTerms 누락: ${baziYear}`);
  }

  let lastId = null;
  for (const t of terms) {
    const jt = Date.parse(t.instantUtc);
    if (jt <= birthMs) {
      lastId = t.id;
    }
  }
  if (!lastId) {
    throw new Error(
      `절입 비교 실패: 사주연도 ${baziYear} 내 절입보다 이른 시각일 수 없습니다.`,
    );
  }

  const solarMonthRank = JIE_ID_TO_SOLAR_MONTH_RANK[lastId];
  if (!solarMonthRank) {
    throw new Error(`알 수 없는 절기 id: ${lastId}`);
  }

  const earthlyBranch = MONTH_RANK_TO_BRANCH[solarMonthRank];
  const stemIdx = monthStemIndexFromBaziYear(baziYear, solarMonthRank);
  const heavenlyStem = HEAVENLY_STEMS[stemIdx];

  return { heavenlyStem, earthlyBranch, baziYear, lastJieId: lastId };
}

/**
 * @param {{ heavenlyStem: string; earthlyBranch: string }} pillar
 */
export function formatMonthPillarStrings(pillar) {
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

/** 테스트·도구용 */
export function getSolarTermsBundleMeta() {
  return loadBundle().meta;
}

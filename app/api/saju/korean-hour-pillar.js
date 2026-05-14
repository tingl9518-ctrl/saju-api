import {
  HEAVENLY_STEMS,
  HEAVENLY_STEMS_HANJA,
  EARTHLY_BRANCHES,
  EARTHLY_BRANCHES_HANJA,
} from "manseryeok";

/**
 * 동경 127.5도(전통 자오선) 기준 30분 보정 시진표.
 * 각 시는 시작 시각 포함, 종료 시각 포함(양 끝 폐구간).
 *
 * 자시: 23:30~01:29  …  해시: 21:30~23:29
 *
 * @param {number} hour 0–23
 * @param {number} minute 0–59
 * @returns {number} 0=자 … 11=해 (EARTHLY_BRANCHES 순)
 */
export function getKoreanShichenBranchIndex(hour, minute) {
  const t = hour * 60 + minute;

  if (t >= 21 * 60 + 30 && t <= 23 * 60 + 29) return 11; // 해
  if (t >= 23 * 60 + 30 || t <= 1 * 60 + 29) return 0; // 자 (자정 전후)
  if (t >= 1 * 60 + 30 && t <= 3 * 60 + 29) return 1; // 축
  if (t >= 3 * 60 + 30 && t <= 5 * 60 + 29) return 2; // 인
  if (t >= 5 * 60 + 30 && t <= 7 * 60 + 29) return 3; // 묘
  if (t >= 7 * 60 + 30 && t <= 9 * 60 + 29) return 4; // 진
  if (t >= 9 * 60 + 30 && t <= 11 * 60 + 29) return 5; // 사
  if (t >= 11 * 60 + 30 && t <= 13 * 60 + 29) return 6; // 오
  if (t >= 13 * 60 + 30 && t <= 15 * 60 + 29) return 7; // 미
  if (t >= 15 * 60 + 30 && t <= 17 * 60 + 29) return 8; // 신
  if (t >= 17 * 60 + 30 && t <= 19 * 60 + 29) return 9; // 유
  if (t >= 19 * 60 + 30 && t <= 21 * 60 + 29) return 10; // 술

  return 0;
}

/** 일간(日干)에 따른 자시(子)의 시간 천간 인덱스 (0=갑 … 9=계) — 五鼠遁 */
const ZI_HOUR_STEM_INDEX_BY_DAY_STEM = {
  갑: 0,
  기: 0,
  을: 2,
  경: 2,
  병: 4,
  신: 4,
  정: 6,
  임: 6,
  무: 8,
  계: 8,
};

/**
 * manseryeok 일주 천간 + 시·분 → 국내형 보정 시주(천간·지지).
 *
 * @param {string} dayStem 일간 (예: "계")
 * @param {number} hour 0–23
 * @param {number} minute 0–59
 * @returns {{ heavenlyStem: string; earthlyBranch: string }}
 */
export function calculateKoreanHourPillar(dayStem, hour, minute) {
  const ziStem = ZI_HOUR_STEM_INDEX_BY_DAY_STEM[dayStem];
  if (ziStem === undefined) {
    throw new Error(`알 수 없는 일간: ${dayStem}`);
  }

  const branchIndex = getKoreanShichenBranchIndex(hour, minute);
  const heavenlyStem = HEAVENLY_STEMS[(ziStem + branchIndex) % 10];
  const earthlyBranch = EARTHLY_BRANCHES[branchIndex];

  return { heavenlyStem, earthlyBranch };
}

/**
 * @param {{ heavenlyStem: string; earthlyBranch: string }} pillar
 */
export function formatHourPillarStrings(pillar) {
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

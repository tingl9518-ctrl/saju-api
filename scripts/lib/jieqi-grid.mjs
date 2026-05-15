import { BIRTH_YEAR_MIN, BIRTH_YEAR_MAX } from "../../app/api/saju/solar-terms-range.js";

/** 1900~2100 출생 × 12절 QA 그리드 — build-solar-terms.mjs JIE_ID 와 동일 순서. */
export const YEAR_MIN = BIRTH_YEAR_MIN;
export const YEAR_MAX = BIRTH_YEAR_MAX;

/** archived Tier1 blind QA 큐 전용(확대 금지). */
export const TIER1_BLIND_QA_YEAR_MIN = 1970;
export const TIER1_BLIND_QA_YEAR_MAX = 2035;

export const JIE_IDS = [
  "lichun",
  "jingzhe",
  "qingming",
  "lixia",
  "mangzhong",
  "xiaoshu",
  "liqiu",
  "bailu",
  "hanlu",
  "lidong",
  "daxue",
  "xiaohan",
];

export const LICHUN_IDS = new Set(["ipchun", "lichun", "입춘"]);

/** CSV jieId → bundle baziyearTerms[].id */
export const JIE_ID_TO_BUNDLE_ID = {
  ipchun: "lichun",
  입춘: "lichun",
};

/**
 * @param {string} jieId
 */
export function resolveBundleJieId(jieId) {
  const key = String(jieId).toLowerCase();
  return JIE_ID_TO_BUNDLE_ID[key] ?? key;
}

/**
 * @param {number} calendarYear
 * @param {string} bundleJieId
 */
export function gridCellKey(calendarYear, bundleJieId) {
  return `${calendarYear}:${bundleJieId}`;
}

/**
 * @param {number} [yearMin]
 * @param {number} [yearMax]
 */
export function* iterateGridCells(yearMin = YEAR_MIN, yearMax = YEAR_MAX) {
  for (let y = yearMin; y <= yearMax; y++) {
    for (const jieId of JIE_IDS) {
      yield { calendarYear: y, bundleJieId: jieId };
    }
  }
}

/**
 * @param {string} utcIso
 * @returns {string}
 */
export function utcIsoToKstIso(utcIso) {
  const ms = Date.parse(utcIso);
  if (Number.isNaN(ms)) {
    throw new Error(`UTC ISO 파싱 실패: ${utcIso}`);
  }
  const kstMs = ms + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+09:00`
  );
}

/**
 * @param {number} absSec
 * @param {{ exactMaxAbsSec: number; toleranceSec: number }} thresholds
 */
export function classifyAbsDeltaSec(absSec, thresholds) {
  if (absSec <= thresholds.exactMaxAbsSec) return "exact";
  if (absSec <= thresholds.toleranceSec) return "within_tolerance";
  return "outlier";
}

/**
 * @param {Record<string, { id: string; instantUtc: string }[]>} baziMap
 * @param {number} calendarYear
 * @param {string} bundleJieId
 */
export function findTermInstantUtc(baziMap, calendarYear, bundleJieId) {
  const terms = baziMap[String(calendarYear)];
  if (!terms?.length) return null;
  const term = terms.find((t) => t.id === bundleJieId);
  return term?.instantUtc ?? null;
}

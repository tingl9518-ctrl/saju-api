/** 운세위키 야자시: 子 진입 23:30 (korean-hour-pillar 와 동일). */
export const YAJA_ZI_START_MINUTES = 23 * 60 + 30;

/** @typedef {"apply" | "not_apply"} YajaMode */

const VALID_MODES = new Set(["apply", "not_apply"]);

/**
 * @param {unknown} value
 * @returns {YajaMode}
 */
export function normalizeYajaMode(value) {
  if (value === undefined || value === null || value === "") {
    return "apply";
  }
  if (typeof value !== "string") {
    throw new Error('yajaMode는 "apply" 또는 "not_apply" 이어야 합니다.');
  }
  const mode = value.trim();
  if (!VALID_MODES.has(mode)) {
    throw new Error('yajaMode는 "apply" 또는 "not_apply" 이어야 합니다.');
  }
  return /** @type {YajaMode} */ (mode);
}

/**
 * 당일 23:30~23:59 (1차: 00:00~01:29 미롤).
 * @param {number} hour 0–23
 * @param {number} minute 0–59
 */
export function isYajaLateZiWindow(hour, minute) {
  const t = hour * 60 + minute;
  return t >= YAJA_ZI_START_MINUTES && t < 24 * 60;
}

/**
 * 위키 미적용: 23:30~23:59 에 effectiveSolar 일자 +1.
 *
 * @param {{ year: number; month: number; day: number }} solarBirth
 * @param {number} hour
 * @param {number} minute
 * @param {YajaMode} yajaMode
 */
export function applyYajaDayRoll(solarBirth, hour, minute, yajaMode) {
  if (yajaMode === "apply" || !isYajaLateZiWindow(hour, minute)) {
    return solarBirth;
  }
  const d = new Date(Date.UTC(solarBirth.year, solarBirth.month - 1, solarBirth.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

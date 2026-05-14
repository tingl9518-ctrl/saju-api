/**
 * @typedef {object} SolarTermEntry
 * @property {string} id - 영문 절기 id (lichun, jingzhe, … xiaohan)
 * @property {string} instantUtc - 절입 순간 UTC ISO8601 (예: 1995-12-07T22:22:14.999Z)
 */

/**
 * @typedef {object} SolarTermsBundle
 * @property {object} meta
 * @property {string} meta.schemaVersion
 * @property {[number, number]} meta.supportedBirthYearsMvp
 * @property {[number, number]} meta.baziYearTermsRange
 * @property {string} meta.instantField
 * @property {string} meta.sourceNote
 * @property {string} meta.generator
 * @property {string} [meta.sourceType] - lunar_javascript | domestic_reference | composite
 * @property {string|null} [meta.referenceVersion] - 레퍼런스 표 버전
 * @property {boolean} [meta.manualOverridesApplied] - 수동 패치 병합 여부
 * @property {string[]} [meta.manualOverrideIds] - 패치 추적 ID
 * @property {string} [meta.dataLineageNote] - 출처·이관 메모
 * @property {Record<string, string>} lichunUtcByCalendarYear - 양력 연도 키 → 해당 연 입춘 UTC ISO
 * @property {Record<string, SolarTermEntry[]>} baziyearTerms - 사주연도(입춘 기준) 키 → 12절 배열(시간순)
 */

export {};

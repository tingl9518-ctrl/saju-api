/** 양력 출생 연도 MVP (API·월주 검사) */
export const BIRTH_YEAR_MIN = 1900;
export const BIRTH_YEAR_MAX = 2100;

/** bundle.json baziyearTerms 키 범위 (입춘 기준 사주연) */
export const BAZI_YEAR_MIN = 1899;
export const BAZI_YEAR_MAX = 2100;

/** lichunUtcByCalendarYear 키 범위 (출생 연도 버퍼 +1) */
export const CALENDAR_LICHUN_MIN = BAZI_YEAR_MIN;
export const CALENDAR_LICHUN_MAX = BAZI_YEAR_MAX + 1;

/** baziyearTerms 없이 lichunUtc 맵만 갖는 양력 연도 (병합 특례) */
export const LICHUN_ONLY_CALENDAR_YEAR = CALENDAR_LICHUN_MAX;

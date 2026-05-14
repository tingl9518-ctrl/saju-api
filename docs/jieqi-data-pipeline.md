# 절입 데이터·QA 파이프라인 설계

국내 기준 절입 레퍼런스와 `bundle.json`을 **분리·재현·비교** 가능하게 관리하기 위한 구조입니다.

---

## 1. 1997 입춘 수동 수정과의 분리 가능성

**현재 상태:** `bundle.json` 안에서 `lichunUtcByCalendarYear["1997"]`와 `baziyearTerms["1997"][0]`(입춘)만 수동으로 맞춰져 있고, 나머지 절기는 `lunar-javascript` 생성값입니다.

**분리 전략:**

| 레이어 | 역할 |
|--------|------|
| **베이스 번들** | `scripts/build-solar-terms.mjs`만으로 생성한 산출물(또는 CI 아티팩트). 수동 손대지 않음. |
| **수동 패치 목록** | `reference/manual-overrides.json`(또는 `.yaml`)에 `{ "lichunUtcByCalendarYear": { "1997": "..." }, "baziyearTermsPatches": [...] }` 형태로만 기록. |
| **병합 스크립트** | `scripts/apply-jieqi-overrides.mjs`가 베이스 JSON + overrides를 합쳐 배포용 `bundle.json`을 씀. |

이렇게 하면 **“temporary manual reference patch”**가 Git 상에서 **파일 단위로 분리**되고, `bundle.json`의 `meta.manualOverridesApplied`로 추적할 수 있습니다.  
(지금은 병합 스크립트가 없어 패치가 번들에 직접 들어가 있으나, 메타로 출처를 밝혀 두었습니다.)

---

## 2. `reference/jieqi-reference.csv` → `bundle.json` 전체 재생성

**두 단계 모델을 권장합니다.**

### A. 입춘만 레퍼런스 (현실적인 1단계)

- CSV: `calendarYear`, `jieId`(ipchun|lichun), `instantKst`, `source`, `note` — **1970~2035 연도별 입춘 한 줄씩**.
- 빌드: `lunar-javascript`로 **12절 전체**를 생성한 뒤, CSV에 있는 연도에 한해 **입춘 instant만 덮어쓰기** + 해당 사주연 `baziyearTerms[Y][0].instantUtc` 동기화.
- 장점: 레퍼런스 입수가 **입춘 66행**으로 끝남.  
- 주의: 입춘이 밀리면 **인접 사주연의 마지막 절(소한)**과의 시간순 정합을 검증해야 함.

### B. 12절 전부 레퍼런스 (이상적)

- CSV 또는 **연도별 JSON 배열**로 `baziyearTerms` 전체를 표현.
- 빌드: CSV만으로 `lichunUtcByCalendarYear` + `baziyearTerms`를 **완전 생성** (lunar-js 미사용).

**공통 출력:** 기존과 동일한 `bundle.json` 스키마 + 확장 `meta`(아래 4절).

---

## 3. 연도 하드코딩 없이 레퍼런스 전체 주입

- **금지:** `if (y === 1997)` 같은 코드 분기.
- **허용:** `reference/jieqi-reference.csv`(또는 `reference/jieqi/` 아래 연도별 파일)를 **데이터로만** 읽어 루프로 적용.
- **검증:** 빌드 시 “필수 연도 키 집합(1969~2036 입춘 등)”이 비어 있으면 **실패**시키는 스키마 검증.

---

## 4. `bundle.meta` 확장 제안

런타임은 알 수 없는 필드는 무시해도 되므로, 아래를 **선택적**으로 추가합니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `sourceType` | `string` | 예: `lunar_javascript` \| `domestic_reference` \| `composite` |
| `referenceVersion` | `string \| null` | 레퍼런스 표 버전(예: `kasi-2024-ocr-v1`, `unse-wiki-qa-2026-01`) |
| `manualOverridesApplied` | `boolean` | 수동 패치 병합 여부 |
| `manualOverrideIds` | `string[]` | 패치 식별자(추적·감사용) |
| `baseGenerator` | `string` | 베이스가 lunar-js이면 `scripts/build-solar-terms.mjs` 등 |
| `mergedAt` | `string` | ISO8601, overrides 병합 시각 |

`sourceNote`는 사람이 읽는 긴 설명용으로 유지합니다.

---

## 5. 1970~2035 입춘 전체 diff 리포트

**입력:** (1) 현재 `bundle.json`, (2) `reference/jieqi-reference.csv`의 `instantKst` 채워진 행.

**출력:**

- `reports/jieqi-lichun-diff.json` — 연도별 `bundleUtc`, `referenceUtc`, `deltaMinutes`, `severity`.
- `reports/jieqi-lichun-diff-summary.txt` — max \|delta\|, p95, `|delta| > T` 건수.

**게이트:** CI에서 `npm run qa:jieqi:report` 후 `|delta| > 300` 초과 시 실패 등.

기존 `npm run qa:jieqi`는 **샘플/부분 CSV** 비교용으로 유지하고, 전 구간 리포트는 **별 스크립트**(`scripts/report-jieqi-lichun-diff.mjs`)로 두는 구성이 깔끔합니다.

---

## 6. A/B 비교: lunar-javascript vs domestic reference

| 산출물 | 경로 예시 | 용도 |
|--------|-----------|------|
| Bundle A | `app/.../solar-terms/bundle.lunarjs.json` | 역산 기본선 |
| Bundle B | `app/.../solar-terms/bundle.domestic.json` | 레퍼런스 기반 |
| 배포 번들 | `bundle.json` | 환경변수 `SOLAR_TERMS_BUNDLE`로 선택(향후) |

**워크플로:**

1. 동일 생시 샘플 N건에 대해 A/B로 `baziYear`·월주·연주 비교 리포트.
2. domestic이 기준으로 확정되면 `bundle.json` = B만 배포.

---

## 구현 우선순위 (요약)

1. `reference/manual-overrides.json` + `scripts/apply-jieqi-overrides.mjs`로 수동 패치 분리.  
2. `reference/jieqi-reference.csv` 채우기 → 입춘 덮어쓰기 빌드.  
3. `report-jieqi-lichun-diff.mjs` + CI 게이트.  
4. 선택적 `SOLAR_TERMS_BUNDLE` 경로로 A/B.

이 문서는 **설계 기준**이며, 스크립트는 단계적으로 추가하면 됩니다.

**QA 자동화 세부:** [jieqi-qa-automation.md](./jieqi-qa-automation.md) (`npm run qa:jieqi:report`).

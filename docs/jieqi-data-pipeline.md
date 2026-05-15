# 절입 데이터·QA 파이프라인 설계

국내 기준 절입 레퍼런스와 `bundle.json`을 **분리·재현·비교** 가능하게 관리하기 위한 구조입니다.

**전략 방향(소스 오브 트루스·운영 목표):** [`jieqi-strategy.md`](./jieqi-strategy.md) — lunar-js 비절대 기준, reference 기반 번들, 장기적으로 수동 패치 대신 CSV 생성.

**운영·전환 실행안(Hybrid 입춘 병합 등):** [`domestic-bundle-operations.md`](./domestic-bundle-operations.md)

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

**전제:** 입춘·절입의 **최종 진실은 reference**이며, `lunar-javascript`는 **초안/백필/비교용(seed)** 으로만 쓴다 ([`jieqi-strategy.md`](./jieqi-strategy.md)).

**두 단계 모델을 권장합니다.**

### A. 입춘만 레퍼런스 (현실적인 1단계)

- CSV: `calendarYear`, `jieId`(ipchun|lichun), `instantKst`, `source`, `note` — **1970~2035 연도별 입춘 한 줄씩**.
- 빌드(향후 `build-bundle-from-reference.mjs`): **선택**으로 `build-solar-terms.mjs` 출력을 시드로 두고, CSV에 있는 연도에 한해 **입춘 instant만 덮어쓰기** + 해당 사주연 `baziyearTerms[Y][0].instantUtc` 동기화. 시드 없이 reference만으로 입춘 열만 채우는 경로도 가능.
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

## 3.1 `build-bundle-from-reference.mjs` (구체 설계 — 구현은 후순위)

**병합 전용 설계(스크립트명·필드·rollback·구현 순서):** [`merge-jieqi-reference-lichun-design.md`](./merge-jieqi-reference-lichun-design.md)

**목표:** `bundle.json`을 **reference가 정한 입춘(이후 12절 전체로 확장 가능)**으로 재생성하고, `meta`에 domestic 출처를 박는다.

| 단계 | 내용 |
|------|------|
| **입력** | `reference/jieqi-reference.csv`(필수 최소: 입춘 1970–2035). 선택: `manual-overrides.json`, 시드 번들 경로. |
| **시드(선택)** | `npm run build:data:lunarjs` → `app/api/saju/data/solar-terms/bundle.lunarjs.json` (`build-solar-terms.mjs --out …`). **시드 없으면** 입춘만 CSV로 채우고 나머지 절기는 별 정책(추가 CSV 또는 시드 필수)을 문서에 명시. |
| **병합** | `npm run build:data:domestic` — `scripts/merge-jieqi-reference-lichun.mjs`: CSV `instantKst` → UTC로 `lichunUtcByCalendarYear[y]` 및 `baziyearTerms[y][0]`(lichun) 동기화. |
| **검증** | (1) 연도별 시간순 (2) 이전 사주연 소한 ≤ 다음 입춘 (3) `npm run qa:jieqi:report`로 잔여 outlier 정책. |
| **출력** | `bundle.json`; `meta.sourceType: domestic_reference` 또는 `composite_until_full`, `referenceVersion`, 수동 패치 없음을 목표로 `manualOverridesApplied: false`. |
| **lunar-js 위치** | **fallback / 초기 생성만.** 최종 운영 산출물의 truth는 CSV·국내 표 ([`jieqi-strategy.md`](./jieqi-strategy.md)). |

**운영 목표:** 성숙 시 **`bundle.json` = domestic reference bundle** 만 배포.

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

**당장:** [`jieqi-strategy.md`](./jieqi-strategy.md)에 맞춰 **CSV 입춘 행 축적 + `qa:jieqi:report`로 기준 고정**이 우선. 그다음 아래 순.

1. `reference/manual-overrides.json` + `scripts/apply-jieqi-overrides.mjs`로 수동 패치 분리(과도기).  
2. `reference/jieqi-reference.csv` 채우기 → §3.1 입춘 덮어쓰기 빌드.  
3. `report-jieqi-lichun-diff.mjs` + CI 게이트(정책: domestic 번들 전환 전까지는 report-only 가능).  
4. 선택적 `SOLAR_TERMS_BUNDLE` 경로로 A/B.

이 문서는 **설계 기준**이며, 스크립트는 단계적으로 추가하면 됩니다.

**전략·소스 오브 트루스:** [jieqi-strategy.md](./jieqi-strategy.md).  
**QA 자동화 세부:** [jieqi-qa-automation.md](./jieqi-qa-automation.md) (`npm run qa:jieqi:report`).

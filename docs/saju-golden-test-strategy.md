# 사주 계산 엔진 골든 테스트 전략

**목표:** 디자인·UI 전에 **연산 엔진 회귀를 고정**하고, 국내 기준(운세위키 등)과 **지속 비교·재현** 가능한 데이터 계약을 둔다.

| 목표 | 설명 |
|------|------|
| Regression 방지 | 기대 사주(연·월·일·시) 변경 시 PR에서 즉시 실패 |
| 국내 서비스와 비교 | 동일 입력·동일 규칙 가정 하에 expected를 바꿔가며 diff 추적 |
| 경계 검증 | 절입·입춘·자시·시주·음력·윤달·자정 넘김 |

절입 **데이터** QA는 [`jieqi-qa-automation.md`](./jieqi-qa-automation.md) / [`jieqi-strategy.md`](./jieqi-strategy.md)와 분리하고, 본 문서는 **“입력 → 네 기둥” 엔진** 단위다.

---

## 1. 골든 데이터셋 구조

### 1.1 권장: JSON (기계 진실)

- **파일:** 예) `reference/golden/golden-cases.json`(운영), `golden-cases.sample.json`(스키마 예시).
- **형태:** 배열 `cases[]` 또는 `{ "version": "...", "cases": [...] }`.
- **이유:** 중첩 필드(출처·태그), 주석 대체용 `note`, CI에서 `node --test`로 직접 `import` 또는 `readFile`+`JSON.parse` 용이.

### 1.2 보조: CSV (검토·스프레드시트)

- 한 행 = 한 케이스 평탄화 컬럼: `id`, `category`, `birth_year`, …, `exp_year_ko`, …
- **한계:** 음력·윤달·복수 `category`는 JSON이 안전. CSV는 **요약 리포트·임포트 중간 포맷** 정도로 두는 것을 권장.

### 1.3 케이스 스키마 (필드 제안)

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | 예 | 안정적 식별자. 예: `lichun-1997-0204-0300-b`, `lunar-1990-閏5-01-1200`. |
| `category` | 예 | 문자열 배열. 아래 [§2 최소 카테고리](#2-최소-카테고리) 코드와 매핑. |
| `input` | 예 | 생년월일·시각·달력 종류. |
| `expected` | 예 | 네 기둥(한글 표기). |
| `source` | 권장 | 출처 메타(아래 §4). |
| `confidence` | 권장 | `0`–`1` 또는 `high` / `medium` / `low`. |
| `note` | 선택 | 위키 창구, 시진 분기 근거 등. |

**`input` (API·엔진과 맞출 것)**

```json
{
  "calendar": "solar" | "lunar",
  "year": 1997,
  "month": 2,
  "day": 4,
  "hour": 3,
  "minute": 0,
  "isLeapMonth": false,
  "timezone": "Asia/Seoul"
}
```

- `timezone`: 현재 엔진은 **KST 고정**에 가깝게 동작한다고 가정하고, 문서·fixture에 명시해 두면 이후 확장 시 계약이 된다.
- 음력일 때는 `calendar: "lunar"` + `isLeapMonth`; 런타임은 양력으로 변환한 뒤 월주·연주에 사용한다(`route.js`의 `resolveSolarBirthDateParts`와 동일 계약).

**`expected`**

```json
{
  "year": "병자",
  "month": "신축",
  "day": "정축",
  "hour": "신축"
}
```

- 한글 간지 문자열을 **정규화 규칙**(띄어쓰기 없음 등)으로 고정하고, 테스트에서 `assert.equal`로 비교.
- 향후 한자 병행 검증이 필요하면 `expectedHanja` 등 확장 필드를 추가.

---

## 2. 최소 카테고리

카테고리는 `category` 배열에 **태그**로 중복 허용(예: `["lichun_boundary", "solar_normal"]`).

| 코드 | 포함할 것 |
|------|-----------|
| `solar_normal` | 평범한 양력·낮 시간·절입·자시와 무관한 한 점 |
| `lunar_plain` | 음력 입력 → 변환 양력 후 동일 파이프라인(일주·시주 일관) |
| `lunar_leap` | 윤달 `isLeapMonth: true` |
| `lichun_boundary` | 입춘 직전·직후(연·월이 바뀌는 창구) |
| `jie_boundary` | 입춘 외 절입 직전·직후(월지 전환) |
| `zishi` | 23:00–01:00 (야자·조자 등 **시지 규칙**이 드러나는 구간) |
| `hour_boundary` | 시주가 바뀌는 시·분(한국형 시진 규칙) |
| `midnight_calendar` | 00:00 전후 **양력 날짜 변경**과 일주·시주 정합 |
| `bundle_edge` | `korean-month-pillar` MVP 연도 상·하한 근처 |

**우선순위(초기 세트):** `lichun_boundary` · `jie_boundary` · `zishi` · `hour_boundary` — 이미 `saju-golden.test.mjs`에 일부 존재. 그다음 `lunar_plain` / `lunar_leap` / `midnight_calendar`.

---

## 3. `tests/saju-golden.test.mjs` 확장 방향

**구현됨:** `app/api/saju/compute-pillars-korean.js`의 `computePillarsKorean` / `koreanPillarsFromComputed` — `POST /api/saju`와 동일 계산 경로. `tests/saju-golden.test.mjs`는 `reference/golden/golden-cases.json`을 로드하고, `category`별 `describe`로 스위트를 나눈 뒤 실패 시 `case id`·필드별 `expected` vs `actual`을 출력한다. fixture 경로는 `GOLDEN_CASES_PATH`로 오버라이드 가능.

**추가로 할 수 있는 것:**

1. **`GOLDEN_CATEGORY=lichun_boundary`** 같은 env로 특정 카테고리만 돌리기(현재는 전체 실행).
2. **스키마 검증 강화:** `calendar` enum, `timezone` 고정 검사 등.
3. **음력·윤달·자시·자정** 케이스를 JSON에 축적(데이터 작업).

---

## 3.1 (이전 설계 메모 — 보관)

**이전:** `assertFourPillars`가 양력·`isLunar: false` 고정에 가깝고, 케이스가 파일 내 하드코딩.

**권장 진화(대부분 반영됨):**

1. **단일 파이프라인 헬퍼** — `computePillarsKorean`으로 완료.  
2. **Fixture 로더** — `golden-cases.json` + 카테고리별 `describe`로 완료.  
3. **스키마 검증(선택)** — 최소 `id` / `input` / `expected` / `category` 만 검증 중.  
4. **인라인 케이스** — JSON으로 이전 완료.

---

## 4. 운세위키 기준 expected를 regression truth처럼 관리

- **원칙:** `expected`는 **“우리가 제품으로 약속하는 기준”**이다. 운세위키는 그 **근거 출처**일 뿐, 위키 UI가 바뀌면 **우리가 expected를 갱신할지**를 PR에서 결정한다.

**`source` 객체 예시**

```json
{
  "type": "unse_wiki",
  "label": "운세위키 만세력 그리드",
  "capturedAt": "2026-05-14",
  "url": "https://…",
  "referenceSet": "golden-v1"
}
```

- **`referenceSet`:** 한 번에 여러 케이스를 묶는 버전 문자열. “golden-v2에서 입춘 1997만 수정” 같은 **감사·리뷰 단위**로 쓴다.
- **변경 절차(운영):**  
  1) 위키·타 서비스와 대조해 차이 발견 → 이슈에 스크린샷·시각 기록  
  2) **의도적 규칙 변경**인지 **데이터 버그**인지 구분  
  3) 의도 확정 시에만 `expected` + `source.capturedAt` / `referenceSet` 갱신  
  4) PR 본문에 “왜 바뀌었는지” 한 줄 의무화

**`confidence`:** 위키 그리드 창구 근처(±수분)처럼 애매하면 `medium` + `note`에 창구; CI는 기본 **이진 통과**만 하고, 나중에 `confidence < 0.8`이면 경고만 내는 레이어를 추가할 수 있다(절입 QA와 동일 철학).

---

## 5. QA 운영 방식 (구현보다 먼저)

| 활동 | 설명 |
|------|------|
| 케이스 추가 | 이슈 템플릿: 입력 JSON 스니펫 + 위키 캡처 + expected 제안 |
| 리뷰 | 최소 1인이 동일 규칙으로 재현(다른 브라우저/수동 계산) |
| 버전 | `golden-cases.json` 최상단 `version` 또는 Git만으로도 충분; 대규모일 때만 `referenceSet` 세분화 |
| CI | `npm test`에 골든 포함; 실패 시 diff는 연·월·일·시 중 어느 기둥인지 출력하도록 헬퍼 개선 |
| 절입 데이터와의 관계 | 입춘이 바뀌면 `lichun_boundary` 케이스만 깨질 수 있음 → **절입 번들 PR과 골든 PR을 분리**하거나, 골든에 `dependsOnBundleVersion`(선택 메타)을 적어 추적 |

---

## 6. 관련 파일

| 경로 | 역할 |
|------|------|
| [`tests/saju-golden.test.mjs`](../tests/saju-golden.test.mjs) | 현재 골든·절입 경계 테스트 |
| [`reference/golden/README.md`](../reference/golden/README.md) | fixture 위치·기여 방법 |
| [`reference/golden/golden-cases.sample.json`](../reference/golden/golden-cases.sample.json) | JSON 스키마 예시 |
| [`docs/jieqi-strategy.md`](./jieqi-strategy.md) | 절입 데이터 전략(엔진 QA와 분리) |

**구현 상태:** `app/api/saju/compute-pillars-korean.js`의 `computePillarsKorean` + `tests/saju-golden.test.mjs`가 `reference/golden/golden-cases.json`을 로드해 카테고리별로 회귀 실행한다. `GOLDEN_CASES_PATH`로 fixture 경로 오버라이드 가능.

**다음 데이터 태스크:** 음력·윤달·자시·자정 케이스를 동일 JSON에 축적.

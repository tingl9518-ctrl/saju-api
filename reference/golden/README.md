# 골든 케이스 (사주 엔진 회귀)

**목적:** 입력(양력/음력·시각)에 대한 **연·월·일·시** 기대값을 버전 관리하고, `npm test`로 회귀를 막는다.

## 파일

| 파일 | 설명 |
|------|------|
| `golden-cases.json` | **회귀 소스 오브 트루스.** `npm test`에서 로드·자동 비교. |
| `golden-cases.sample.json` | 동일 스키마 예시(복사용). |

## `enabled: false` · `known_mismatch: true` (활성 회귀 제외)

- **`"enabled": false`:** 미검증 템플릿(`expected`에 `__TODO__`). `npm test`에서 **skip**.
- **`"known_mismatch": true`:** 정책·데이터가 확정되기 전 위키 등과 어긋나는 케이스. **`reason`(필수)** 에 원인을 적고, **skip** — **active regression에 넣지 않는다** (엔진 수정·번들 확정 후 제거).

### 템플릿 목록 (`enabled: false`, …)

| id | category | 목적 |
|----|-----------|------|
| `lunar-plain-1990-0515-1200` | `lunar_plain` | 음력 평달·낮 |
| `lunar-plain-2000-0101-1000` | `lunar_plain` | 음력 연초 근처 |
| `lunar-leap-2020-0401-1000` | `lunar_leap` | 윤4월 초일 |
| `lunar-leap-2017-0615-0900` | `lunar_leap` | 윤6월 중순 |
| `zishi-2000-0101-2300` | `zishi` | 23:00 자시 전반 |
| `zishi-2000-0101-2330` | `zishi` | 23:30 |
| `zishi-2000-0102-0030` | `zishi` | 익일 00:30 (전날 23시와 페어) |
| `midnight-1999-1231-2359` | `midnight_calendar` | 연말 23:59 |
| `midnight-2000-0101-0000` | `midnight_calendar` | 신정 00:00 |

## 운세위키 QA 확정 케이스 (`unse_wiki_qa`)

| id | category | 비고 |
|----|-----------|------|
| `lunar-leap-1995-0815-1100` | `lunar_leap` | **`known_mismatch`** — 절입 bundle 미완성(`reason`). |
| `midnight-zishi-2001-0101-2340` | `midnight_calendar`, `zishi` | **`known_mismatch`** — 야자시 정책 미확정(`reason`). |
| `midnight-zishi-2001-0102-0010` | `midnight_calendar`, `zishi` | 1/2 00:10 — 엔진과 일치 |
| `hour-boundary-1990-0515-0900` | `hour_boundary` | 09:00 진시 |
| `hour-boundary-1990-0515-0930` | `hour_boundary` | 09:30 사시 |

### 엔진 vs 위키 (번들·정책 확정 후 `known_mismatch` 제거 시 재검증)

- **`lunar-leap-1995-0815-1100`:** `lunarToSolar` → 양력 **1995-10-09** 11:00. 번들 절입상 `lastJieId`가 **백로**로 잡혀 월주 **을유**; 위키 **병술**은 **한로 이후 술월**로 보는 쪽. **절입 번들(domestic reference)** 정비 후 활성 회귀에 넣을지 판단.
- **`midnight-zishi-2001-0101-2340`:** 엔진은 `manseryeok` **양력 1일** 일주 **갑자**·시주 **갑자**. 위키 **을축·병자**는 **晚子 일주 귀속** 등 **야자시 정책** 차이. 정책 확정 후 활성 회귀에 넣을지 판단.

## 설계·운영

전체 전략·카테고리·운세위키를 truth로 두는 방법: **`docs/saju-golden-test-strategy.md`**

절입 **데이터** CSV·리포트는 `reference/jieqi-reference.csv` 및 `docs/jieqi-qa-automation.md` — 본 폴더는 **네 기둥 end-to-end** 골든이다.

## 기여 시

1. `golden-cases.json`에 행을 추가하거나 `golden-cases.sample.json`과 동일 필드 형식을 따른다.  
2. `id`는 고유하고, `category`는 **비어 있지 않은 배열**(전략 문서 태그).  
3. 운세위키 등에서 딴 값이면 `source`·`note`를 채운다.  
4. 검증 전 템플릿은 `enabled: false` + `expected`에 `__TODO__` — 채운 뒤 `enabled` 제거.  
5. **정책·번들 미확정**으로 위키와 아직 맞지 않는 케이스는 **`known_mismatch: true` + `reason`** 으로 두고 활성 회귀에 넣지 않는다.  
6. 다른 경로의 fixture를 쓰려면 `GOLDEN_CASES_PATH`(절대 또는 cwd 기준 상대)를 설정한다.

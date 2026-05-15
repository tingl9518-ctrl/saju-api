# Domestic 입춘 reference — 운영·전환 실행안 (설계만)

**목표:** 운세위키와 **100% 동일**에 가깝게 가려면, **`bundle.json`의 12절 절입 시각**을 **국내 reference**로 맞추는 것이 핵심이다.  
**2026-05 QA:** 입춘-only 병합은 **성공**했으나, **1995 백로·한로**에서 **월주 전환**이 위키와 어긋나 **12절 reference 확장**이 **운영상 유력**해졌다.  
본 문서는 **코드 없이**, “지금 구조에서 **어떻게 운영·전환할지**”를 **실행 가능한 단위**로 고정한다.  
(배경: `docs/jieqi-strategy.md`, `docs/jieqi-data-pipeline.md` §2·§3.1, `docs/lichun-mismatch-nature.md`, `docs/wiki-divergence-rules.md` R2.)

---

## 1. 현실적인 운영 방식 — 선택지 비교

| 방식 | 운영 내용 | 장점 | 단점 |
|------|-----------|------|------|
| **A. reference CSV 직접 관리만** | CSV에 **12절 전부** 또는 최소 **입춘+필수 절기**를 연도별로 채우고, **lunar-js 없이** 번들 생성 | SoT 단일·해석 단순 | **입력 부담 큼**(66년×12절 등), 초기 비용 높음 |
| **B. 일부 연도만 override** | 지금처럼 번들에 손대거나 JSON patch로 **특정 연만** 교체 | 당장 막는 연도만 처리 가능 | **연도별 품질 편차**·Git diff 지옥·재현성 약함 — **장기 비추천** |
| **C. 전체 bundle 매번 재생성** | 매 릴리스마다 **단일 파이프**로 `bundle.json` 전량 새로 씀 | 산출물 하나로 단순 | 입력이 채워지기 전에는 **시드 전략**(D)과 결합해야 함 |
| **D. Hybrid (권장 후보)** | **시드** = `build-solar-terms.mjs`(lunar-js)로 **12절 전체** 생성 → **병합** = `jieqi-reference.csv`에 **행이 있는 연도의 입춘**만 KST→UTC 반영해 `lichunUtcByCalendarYear` + `baziyearTerms[y][0]` 덮어쓰기 → **검증** 후 `bundle.json` 출력 | **입춘 66행**만으로도 위키 정합 **대폭 개선**, 나머지 절기는 기존 유지로 **리스크 분산** | CSV·시드 **불일치 시** 인접 사주연 **시간순** 깨질 수 있음 → **검증 스크립트 필수** |

**정리:**  
- **B**는 과도기·핫픽스용.  
- **A**는 이상적 종착역.  
- **당장 실행**에 가까운 것은 **D → (시간이 지나며) A로 수렴**이다.

---

## 2. 전략 판단 (2026-05 갱신)

### **단기(현재 구현): Hybrid 입춘 병합 — 유지**

- **SoT:** `reference/jieqi-reference.csv` — **입춘** (`lichun` / `ipchun`).  
- **병합:** `merge-jieqi-reference-lichun.mjs` — `npm run build:data:domestic`.  
- **효과:** **입춘·연주·2월 월주** — **검증됨**.  
- **한계:** **월주 전 구간 위키 100%** — **불가에 가깝다** (1995 **백로 09-08 11:46**, **한로 10-09 03:25** QA).

### **중기(운영·QA 방향): 12절 domestic reference — 점점 유력**

| 확정 위키 錨点 (1995) | `instantKst` (권장 기록) |
|----------------------|---------------------------|
| 입춘 | `1995-02-04T16:19:00+09:00` (이미 CSV) |
| 백로 | **`1995-09-08T11:46:00+09:00`** |
| 한로 | **`1995-10-09T03:25:00+09:00`** (창구 03:20~03:25) |

1. CSV 스키마: **`calendarYear` + `jieId` + `instantKst`** — 입춘과 **동일 행 형식**으로 **12절 확장**.  
2. 병합: `merge-jieqi-reference-lichun.mjs` **확장** 또는 **`merge-jieqi-reference.mjs`** — `baziyearTerms[y]` 해당 `id`의 `instantUtc` 동기화.  
3. **우선순위:** **골든·mismatch 연도·절** (1995 bailu+hanlu) → **outlier 연도 스캔** → 전량.  
4. **QA:** `qa:jieqi:report` **12절판** 설계 — 연도×절기 `maxAbsDeltaSec`.

**판단:** “입춘만이 가장 비용 대비 좋다”는 **1단계**는 여전히 맞다. **위키 월주까지 맞추려면** **2단계(12절)** 가 **필수**에 가깝다.

---

## 3. 구현 난이도

| 구간 | 난이도 | 이유 |
|------|--------|------|
| **병합 스크립트 + npm 스크립트 한 줄** | **보통** | KST→UTC, `baziyearTerms` 첫 요소 동기화, 인접 연도 시간순 검증 로직이 필요 |
| **CSV 유지보수** | **보통 ~ 쉬움**(프로세스) | 행 추가는 단순; **출처·감사**는 규율 필요 |
| **런타임 `SOLAR_TERMS_BUNDLE_PATH`** | **쉬움** | `loadBundle()` 한 곳 + 문서 |
| **12절 전량 domestic** | **어려움** | 데이터 입수·검증 폭발 |

**종합:** 전체를 **어려움**으로 보지 않고, **추천안 범위는 “보통”**으로 계획하면 된다.

---

## 4. 지금 구조에서 수정·영향 범위

| 대상 | 변경 내용 |
|------|-----------|
| **신규 스크립트** | `merge-jieqi-reference-lichun.mjs`: 시드 JSON + CSV → `bundle.json` (`npm run build:data:domestic`) |
| **`package.json`** | 예: `build:bundle:domestic` = `build-solar-terms` → `merge-…` |
| **`bundle.json`** | Git에는 **생성물**을 두든 CI에서만 생성하든 **팀 규칙** 결정; 원칙은 **손편집 지양** |
| **`reference/jieqi-reference.csv`** | **운영자가 직접** 채움(또는 OCR/표 import 파이프) |
| **`korean-month-pillar.js`** | **필수 아님** — 스키마 동일면 경로 불변. (선택) `SOLAR_TERMS_BUNDLE_PATH`로 스테이징만 |
| **`docs/`·README** | 빌드 순서·`meta` 읽는 법·운영자 가이드 |
| **골든** | 입춘·월주가 바뀌면 **`known_mismatch` 해제** 또는 expected 갱신 — **회귀 재조정** 필요 |

**영향:** 연·월만 바뀌는 입력이 넓어짐; 일주·시주 로직은 **그대로** 두는 전제.

---

## 5. 예상 리스크

| 리스크 | 설명 | 완화 |
|--------|------|------|
| **QA 폭증** | 연도별 입춘 채우면 골든·수동 비교 증가 | **단계적**: outlier 연도 우선, `qa:jieqi:report`로 **표준화** |
| **기존 정합 깨짐** | 병합 버그 시 **1997 등 맞던 연도**도 틀어질 수 있음 | 병합 후 **골든+리포트** 필수; **1997 행을 CSV에 명시**해 회귀 앵커로 사용 |
| **인접 사주연 시간순** | 입춘만 밀면 **소한 vs 입춘** 역전 가능 | 빌드 시 **전역 정렬 검증** |
| **유지보수** | CSV가 **진실**이 되면 담당·리뷰 프로세스 필요 | `source`, `verifiedBy`, `referenceVersion` 필드 고정 |
| **위키=천문?** | 그리드 **창구**와 **우리 CSV 錨点** 정의 불일치 | `note`에 창구 명시; 필요 시 **tolerance** 문서화 |
| **번들 이원화 혼란** | `bundle.lunarjs.json` vs `bundle.json` 혼동 | **단일 배포 파일명**·스크립트 이름으로 역할 고정 |

---

## 6. 최종 추천안 (한 블록)

**지금:**  
**입춘 Hybrid 병합은 계속** — `bundle.lunarjs.json` + CSV 입춘 → `bundle.json`, `qa:jieqi:report`로 회귀.

**다음:**  
**`jieqi-reference.csv`에 12절 행을 늘린다** — 최소 **1995 백로·한로**부터. **월주 mismatch(윤달 골든)** 는 **절기 reference**로 설명·해소한다. **입춘-only만으로 위키 100%는 기대하지 않는다.**

**장기:**  
**12절 전량** 또는 **공인 표 일괄** → `meta.sourceType: domestic_reference`.

---

## 관련 문서

- `docs/jieqi-data-pipeline.md` — §3.1 병합 단계와 동일 계열  
- `docs/merge-jieqi-reference-lichun-design.md` — **병합 스크립트 구현 직전 설계**(필드·순서·rollback)  
- `docs/jieqi-12jie-first-data-design.md` — **12절 1차 데이터**(1995 백로·한로) CSV·merge·report 확장 설계  
- `docs/wiki-divergence-rules.md` — 위키와 달라지는 조건  
- `docs/RELEASE-READINESS.md` — 출시 시 번들 한계 안내  

병합 스크립트는 `scripts/merge-jieqi-reference-lichun.mjs`로 확정되었으며, `npm run build:data:lunarjs` → `build:data:domestic` 순으로 실행한다.

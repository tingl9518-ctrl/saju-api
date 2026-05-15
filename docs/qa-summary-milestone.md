# 사주 엔진 QA 요약 · 마일스톤 (현재 기준)

랜덤 샘플 10건을 **운세위키**와 대조한 QA 결과와, 그에 따른 **제품·데이터 전략**을 한곳에 정리한다.  
(계산은 저장소의 `computePillarsKorean` 경로 — 절입 `bundle.json`, 시주 한국형 30분 시진.)

---

## 1. 랜덤 QA 결과 요약 (10건)

| 구분 | 건수 | 설명 |
|------|------|------|
| **완전 일치** | **7** | 연·월·일·시 네 기둥이 위키와 동일 |
| **야자시 토글 불일치** | **1** | 위키 **子 23:30** 은 엔진과 같으나, **일주**는 **적용(당일) vs 미적용(다음날)** 토글로 갈림. 엔진은 **적용(당일)** 과 같은 일주 귀속 — 골든 `midnight-zishi-2001-0101-2340` 은 **미적용** 기둥으로 `known_mismatch` (예: 2001-01-01 23:40 전후) |
| **절입 mismatch (월주)** | **2** | **입춘** 경계 + **한로 등 12절** — 번들(lunar-js 잔여) vs 위키. 윤8/15 케이스는 **한로 1995-10-09 03:20~03:25 KST** 로 설명 (`docs/wiki-divergence-rules.md` R2) |

**참고:** 상세 절입·CSV·리포트는 `docs/jieqi-qa-automation.md`, `reference/jieqi-reference.csv`, 골든 스킵 정책은 `reference/golden/README.md`를 본다.

---

## 2. 결론

- **엔진 계산 구조**(음력→양력, 일주 `manseryeok`, 시주 `korean-hour-pillar` 30분 시진, 연·월 절입 테이블)는 **대부분 운세위키와 정합**하는 편이다.
- **핵심 격차**는 구현 “버그”라기보다 **데이터·정책 계약**에 가깝다.

| 영역 | 내용 |
|------|------|
| **Domestic 절입 reference bundle** | lunar-js 번들과 위키 **입춘·한로 등 12절** 시각이 어긋날 수 있다. **입춘-only 병합**만으로는 **한로 월주 mismatch**(윤달 골든)가 남는다. **12절 reference**가 월주 정합에 필요 (`docs/lichun-mismatch-nature.md` §6). |
| **야자시 정책** | 운세위키 QA로 **子 23:30**·**적용(당일) / 미적용(다음날)** 이 확정됨. 엔진은 **적용(당일)** 과 같은 일주 귀속. 골든 `midnight-zishi-2001-0101-2340` 은 **미적용** 기둥이라 `known_mismatch` 유지 — **제품에서 미적용 모드·옵션**을 넣을지·기대를 바꿀지 결정 후 승격. |

---

## 3. 명시 사항 (라이브러리 · 전략)

### 라이브러리 전면 교체

- **`manseryeok` / 절입 번들 생성기 전면 교체는 현재 단계에서 보류**한다.  
- 이유: 회귀 범위가 크고, 실제 체감 이슈는 **절입 데이터 출처**와 **야자시 규칙**에 집중되어 있다.

### 현재 전략 (고정)

1. **엔진 유지** — 연산 파이프라인(`compute-pillars-korean.js` + `POST /api/saju`)은 유지한다.  
2. **Domestic 절입 reference 강화** — `reference/jieqi-reference.csv` 축적, 번들을 reference 기반으로 재생성 가능한 구조로 진화 (`docs/jieqi-data-pipeline.md`).  
3. **`known_mismatch` 추적** — 정책·번들 미확정으로 위키와 어긋나는 골든 케이스는 `golden-cases.json`에 `known_mismatch: true` + `reason`으로 두고 **활성 회귀에서 제외**한다 (`reference/golden/README.md`, `docs/saju-golden-test-strategy.md`).

---

## 4. 프로젝트 마일스톤 형태 정리

### 완료

- 절입 QA 자동화 스크립트·리포트 (`qa:jieqi`, `qa:jieqi:report`)  
- 국내 체감 기준 **데이터 전략 문서** (`docs/jieqi-strategy.md`)  
- **골든 fixture** + `computePillarsKorean` 공통 경로 + 회귀 테스트 (`reference/golden/golden-cases.json`, `tests/saju-golden.test.mjs`)  
- **랜덤 10건** 대조로 “대부분 정합 / 입춘·야자 이슈 집중” 정성 결론  
- 실패 골든 **삭제 없이** `known_mismatch` + `reason` 분리로 **`npm test` 녹색 유지**

### 진행 중

- `jieqi-reference.csv` **입춘(및 필요 시 12절)** 행 축적  
- `build-bundle-from-reference` 등 **reference 기반 번들** 파이프라인 구체화(설계 단계 문서화됨, 구현은 단계적)  
- 운세위키·국내 만세력과의 **연도별 diff** 지속 기록

### 미확정 정책

- **야자시** — 위키 **적용/미적용** 규칙은 확정; **제품 기본값·API 토글**만 미정. 상세 [`yaja-policy-product-notes.md`](./yaja-policy-product-notes.md) |
- **Domestic 번들 = 운영 번들** 전환 시점 및 CI **FAIL vs report-only** 기준  
- **운세위키와 동일 UX:** 야자시 **옵션 제공 여부·기본값** — 상세는 [`yaja-policy-product-notes.md`](./yaja-policy-product-notes.md)

### 다음 단계

1. 입춘 reference 행을 늘려 `qa:jieqi:report`로 **번들 vs reference** 상시 비교  
2. reference 기반 번들 병합 스크립트 구현 시, **기존 골든·API**와 함께 스테이징 검증  
3. **미적용(다음날)** 모드 구현 또는 골든 `expected` 를 **적용(당일)** 기준으로 정리한 뒤 `known_mismatch` 케이스를 **활성 회귀로 승격**  
4. (선택) 런타임 `SOLAR_TERMS_BUNDLE_PATH` 등으로 **lunar vs domestic** A/B — 문서상 제안만 존재할 수 있음

---

## 관련 문서 링크

| 문서 | 용도 |
|------|------|
| `docs/wiki-divergence-rules.md` | **위키와 다른 조건** 규칙화(입춘·윤달·야자시) |
| `docs/RELEASE-READINESS.md` | **출시 준비도** — 가능 영역·미확정·blocker·면책 요약 |
| `docs/jieqi-strategy.md` | 절입 SoT·lunar-js 비절대 기준 |
| `docs/jieqi-qa-automation.md` | 절입 QA·분류·비교 표 |
| `docs/jieqi-data-pipeline.md` | 번들·CSV·병합 설계 |
| `docs/lichun-mismatch-nature.md` | 입춘 mismatch 성격(버그 vs 데이터·1995·1997·2001·2024) |
| `docs/saju-golden-test-strategy.md` | 네 기둥 골든·`known_mismatch` |
| `docs/yaja-policy-product-notes.md` | 야자시 옵션·현재 엔진 기준·영향 범위 |
| `reference/golden/README.md` | 골든 운영·스킵 규칙 |

본 문서는 **현재 시점 스냅샷**이다. 수치·건수는 이후 QA에서 갱신할 수 있다.

# 12절 domestic reference — 1차 데이터 단계 설계 (1995 백로·한로)

**목표:** `reference/jieqi-reference.csv`에 **1995 `bailu`·`hanlu`** 를 넣고, 시드 번들에 병합·검증할 수 있는 **최소 변경** 경로를 정한다.  
**범위:** 설계·분석만. **런타임 `bundle.json` 스키마·`korean-month-pillar.js` 변경 없음.**

관련: [`wiki-divergence-rules.md`](./wiki-divergence-rules.md) R2, [`merge-jieqi-reference-lichun-design.md`](./merge-jieqi-reference-lichun-design.md), [`domestic-bundle-operations.md`](./domestic-bundle-operations.md).

---

## 1. `jieqi-reference.csv` — bailu / hanlu 행 추가 설계

### 1.1 기존 스키마 (변경 불필요)

```text
calendarYear,jieId,instantKst,source,confidence,verifiedBy,note
```

- **`calendarYear`:** **사주연도(입춘 기준)** 키 — `baziyearTerms`의 키와 동일 (`1995` 입춘 사주연 → `"1995"`).
- **`jieId`:** `build-solar-terms.mjs` / `korean-month-pillar.js`와 동일 영문 id (`lichun`, `bailu`, `hanlu`, …).
- **`instantKst`:** 위키 **錨点** — 전환 **시작** 시각(새 월건이 붙는 쪽 상한). 창구는 `note`에 기록.

**한 연도·여러 절:** 입춘 행과 **동일 파일·동일 헤더**로 **행만 추가**하면 된다. 스키마 확장 **불필요**.

### 1.2 추가할 행 (QA 확정 錨点)

| `calendarYear` | `jieId` | `instantKst` (錨点) | 위키 전환 (요약) |
|----------------|---------|---------------------|------------------|
| **1995** | **`bailu`** | **`1995-09-08T11:46:00+09:00`** | 09-08 **11:45**까지 갑신 → **11:46**부터 을유 |
| **1995** | **`hanlu`** | **`1995-10-09T03:25:00+09:00`** | 10-09 **03:20**까지 을유 → **03:25**부터 병술 |

**`note` 권장 내용 (예):**

- **bailu:** 창구 11:45~11:46 KST; 번들 `1995-09-08T10:48:33.999Z` ≈ KST 19:48 — 병합 전 outlier 예상.
- **hanlu:** 창구 03:20~03:25 KST; 번들 `1995-10-09T02:27:12.000Z` ≈ KST 11:27; `lunar-leap-1995-0815-1100` 월주 검증용.

**메타 필드:** `source=unse_wiki_qa`, `confidence=0.85`, `verifiedBy=human:qa-1995-bailu` / `human:qa-1995-hanlu`.

### 1.3 `jieId` 별칭

| 허용 | 비고 |
|------|------|
| `bailu` | 번들·엔진 표준 (`白露`) |
| `hanlu` | 번들·엔진 표준 (`寒露`) |
| `ipchun` / `lichun` | 입춘만 기존 병합 스크립트가 인식 — **백로·한로는 `bailu`/`hanlu` 사용** |

입춘용 `ipchun`과 달리 **한자 별칭은 파서에 없음** — CSV에는 **영문 id만** 쓴다.

### 1.4 CSV에 넣지 않는 것 (1차)

- `lichunUtcByCalendarYear`용 **별도 행 불필요** — 입춘은 기존 `ipchun` 행 + 병합 시 맵 동기화로 충분.
- **양력 연도 키** — 월주 병합 키는 **사주연 1995**이지, 절기가 걸리는 양력 연도(2024 등)와 다를 수 있음. **백로·한로는 둘 다 사주연 1995**.

---

## 2. 현재 CSV 스키마로 12절 확장 가능 여부

| 항목 | 판단 |
|------|------|
| **파서** (`parse-jieqi-reference-csv.mjs`) | **가능** — `jieId`는 **임의 문자열**; 연도당 **다중 행** 지원. |
| **저장소·문서** | **가능** — `jieqi-qa-automation.md`는 입춘 예시 중심이나 필드 정의는 **절기 무관**. |
| **병합** (`merge-jieqi-reference-lichun.mjs`) | **현재는 불가** — `LICHUN_IDS`만 처리, `baziyearTerms[y][0]`만 갱신. |
| **리포트** (`qa:jieqi:report`) | **현재는 불가** — 입춘·`lichunUtcByCalendarYear`만 비교. |

**결론:** **데이터(CSV) 레이어는 이미 12절 확장 가능.** **도구(병합·리포트)만 입춘 전용**이라 **스크립트 일반화 또는 형제 스크립트**가 필요.

---

## 3. `merge-jieqi-reference-lichun.mjs` 일반화 — 영향 범위

### 3.1 최소 변경 방향 (권장)

**옵션 A — 기존 스크립트 확장 (한 파일, 동작 확장)**

| 구간 | 현재 | 일반화 시 |
|------|------|-----------|
| **행 필터** | `LICHUN_IDS` only | **알려진 12절 id 집합** (`build-solar-terms.mjs` `JIE_ID`와 동일) |
| **번들 쓰기** | `lichunUtc` + `terms[0]` | **`terms` 배열에서 `t.id === r.jieId` 인 요소**의 `instantUtc`만 갱신 |
| **입춘 맵** | 항상 동기화 | **`jieId` ∈ {lichun,ipchun} 일 때만** `lichunUtcByCalendarYear[y]` 갱신 |
| **검증** | 전 연도 `terms[0]===lichun` + lichun 맵 일치 | **병합한 (y,id) 쌍**에 대해 **배열 내 단조 증가** 재검증; lichun 맵 검사는 **입춘 병합 시에만** |

**옵션 B — 형제 스크립트 `merge-jieqi-reference.mjs` (권장 대안)**

- `merge-jieqi-reference-lichun.mjs` **유지** (입춘-only 회귀·문서 호환).
- 새 스크립트가 **전 절기** 병합; `npm run build:data:domestic`가 **새 스크립트 호출**로 전환.
- **영향:** `package.json` 1줄, 문서 링크 — **입춘 전용 CI가 있으면** 스크립트 이름 유지 목적.

**런타임 영향:** **없음** — 출력은 기존 `bundle.json` 스키마 동일.

### 3.2 `baziyearTerms`에서 절기 찾기 (핵심 로직)

```text
baziYear = String(r.calendarYear)
terms = bundle.baziyearTerms[baziYear]
idx = terms.findIndex(t => t.id === r.jieId)  // 0이 아닐 수 있음
terms[idx].instantUtc = utcFrom(r.instantKst)
```

- **1995 `bailu`:** `baziyearTerms["1995"]`에서 `id==="bailu"` (보통 **8번째**, 0-based index **7**).
- **1995 `hanlu`:** `id==="hanlu"` (보통 index **8**).

### 3.3 `meta.referenceVersion` (운영)

- 입춘-only: `lichunYears:1995,1997,...`
- 12절 부분: 예) `merged:1995:lichun,bailu,hanlu;...` 또는 `jieKeys:bailu,hanlu` + 연도 목록.

---

## 4. `baziyearTerms` 전체 절기 patch 시 위험 요소

| 위험 | 설명 | 1차(백로·한로 2점) |
|------|------|---------------------|
| **시간순 역전** | 어떤 절 instant를 **늦게** 밀면 **다음 절보다 뒤**가 될 수 있음 | 두 절 모두 **번들보다 이른 시각**으로 패치 → **1995 내 단조성 유지** 가능성 높음 (검증 필수) |
| **사주연 경계** | `[y] 마지막 절(소한)` ≥ `[y+1] 입춘` 깨짐 | **1995만** 패치 시 **인접 연도 소한·1996 입춘**은 시드 그대로 — **전역 경계 검증**은 병합 스크립트에 이미 있음 |
| **입춘·다른 절 이중 진실** | `lichunUtc` vs `terms[0]` 불일치 | **입춘 CSV 행 병합 시에만** 맵 갱신 — 백로·한로는 **맵 미터침** |
| **부분 composite** | 같은 연도 **입춘만 domestic·한로는 lunar-js** | **의도된 1단계**; 월주는 **절마다** 다른 출처 혼합 가능 — 문서·`meta`에 명시 |
| **잘못된 `calendarYear`** | 양력 연도를 키로 넣으면 **엉뚱한 `baziyearTerms` 행** 패치 | CSV는 **사주연 1995** 고정 |
| **중복 `jieId` 행** | 같은 (y, id) 두 줄 → **마지막 승** 정책 필요 | 운영 규칙: **(y,jieId) 유일** |
| **골든·월주 회귀** | `lunar-leap-1995-0815-1100` **을유→병술** 기대 | **한로 패치 후** 재측정; **백로만** 패치해도 10/9 11:00은 **한로**에 달림 |
| **12절 전량 일괄 패치** | 한 연도 **12점 동시** 잘못되면 **연간 월주 전부** 틀어짐 | 1차는 **2점만** — 리스크 **국소화** |

---

## 5. `qa:jieqi:report` — 12절 대응 확장 분석

### 5.1 현재 동작 (입춘 전용)

- 루프: `calendarYear` **1970–2035** (양력 연도 범위 이름이지만 **입춘 맵 키**로 사용).
- 매칭: CSV **`lichun`/`ipchun`만**, 번들 **`lichunUtcByCalendarYear[y]`**.
- 산출: `reports/jieqi-lichun-report.json`.

### 5.2 확장 가능성

| 방식 | 설명 | 코드량 | 권장 |
|------|------|--------|------|
| **A. 신규 `report-jieqi-12jie-diff.mjs`** | CSV **모든 (year, jieId)** 행 vs `baziyearTerms[year]`에서 **id 일치** 항목 | **작음** — 루프·Map 키만 `(y,jieId)` | **1차 권장** |
| **B. 기존 리포트 확장 + `--mode=all\|lichun`** | 입춘 하위 호환 | 중간 | 2차 |
| **C. 입춘 리포트 유지 + 1995만 수동 스크립트** | 최소 | 최소 | **데이터 2행만** 검증 시 과도기 |

### 5.3 12절 리포트 행 모델 (제안)

```text
calendarYear: 1995        // 사주연
jieId: bailu
bundleUtcIso: ...         // baziyearTerms["1995"][i].instantUtc
referenceKst: 1995-09-08T11:46:00+09:00
absDeltaSec, classification  // 기존과 동일 임계값
```

- **비교 집합:** CSV에 **행이 있는 (y, jieId)** 만 — 전 연도×12 **전수 스캔은 선택**(2단계).
- **FAIL 정책:** 입춘과 동일 `JIEQI_FAIL_MAX_ABS_SEC=300` — **병합 전** 1995 bailu·hanlu는 **outlier 예상**(의도된 신호).

### 5.4 입춘 리포트와의 관계

| 리포트 | 역할 |
|--------|------|
| `qa:jieqi:report` (기존) | **입춘·lichunUtc** 회귀 — **유지** |
| `qa:jieqi:report:12jie` (신규 가칭) | **다절기 CSV** diff — **1995 bailu/hanlu** 1차 |

**한 번들에 대해 두 리포트 모두** 돌리면 **입춘 exact 유지 + 백로·한로 outlier→병합 후 exact** 흐름을 재현 가능.

---

## 6. 권장 실행 순서 (구현 단계 — 참고)

**이 문서는 구현 지시가 아니라 순서 제안.**

1. **데이터만:** `jieqi-reference.csv`에 **2행** 추가 (§1.2).
2. **병합:** `merge-jieqi-reference.mjs` 또는 lichun 스크립트 일반화 — **1995 bailu·hanlu**만 반영.
3. **검증:** `npm run build:data` → **12절 리포트**(신규) → 병합 전·후 diff 기록.
4. **런타임 QA:** `computePillarsKorean` / 윤8/15 11:00 → 월주 **병술** (문서화된 수동 QA).
5. **골든:** `known_mismatch` 해제 여부 — **별 PR·정책 결정**.

---

## 7. 요약 표

| # | 질문 | 답 |
|---|------|-----|
| 1 | CSV 행 설계 | §1.2 — **1995 + bailu/hanlu + instantKst 錨点** 2행, note에 창구·번들 KST |
| 2 | 스키마 12절 확장 | **CSV·파서는 가능**; 병합·리포트만 확장 필요 |
| 3 | merge 일반화 영향 | **런타임 무**; `findIndex by jieId`, 입춘만 `lichunUtc` 갱신, 검증 보강 |
| 4 | 전 절 patch 위험 | 시간순·경계·부분 composite·골든; **2점만**이면 1995 국소 |
| 5 | report 12절 | **신규 스크립트 (y,jieId) 매칭**이 최소·명확; 입춘 리포트 **병행** |

---

## 관련 파일 (구현 시 터치 예상)

| 파일 | 1차 변경 |
|------|----------|
| `reference/jieqi-reference.csv` | **+2행** |
| `scripts/merge-jieqi-reference-lichun.mjs` 또는 **신규** `merge-jieqi-reference.mjs` | 일반화 |
| `scripts/report-jieqi-12jie-diff.mjs` | **신규** (가칭) |
| `package.json` | 스크립트 alias (선택) |
| `korean-month-pillar.js` / `bundle.json` 스키마 | **변경 없음** |

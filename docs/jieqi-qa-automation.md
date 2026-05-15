# 국내 기준 절입 QA 자동화

계산 엔진과 분리된 **데이터 신뢰·회귀** 레이어입니다.

**제품·데이터 전략(소스 오브 트루스, lunar-js 비절대 기준):** [`jieqi-strategy.md`](./jieqi-strategy.md).

**엔진 전체(연·월·일·시) 골든 회귀:** [`saju-golden-test-strategy.md`](./saju-golden-test-strategy.md) — 절입 CSV·리포트와 역할이 다름.

---

## 1. `reference/jieqi-reference.csv` 필드 제안

| 컬럼 | 필수 | 설명 |
|------|------|------|
| `calendarYear` | 예 | 양력 연도. `year` 별칭은 파서가 동일 취급(입춘 1행/연). |
| `jieId` | 예 | `ipchun` \| `lichun` \| (향후 다른 절기 id). |
| `instantKst` | 비교 시 | `Asia/Seoul` 오프셋 ISO, 예 `1997-02-04T04:30:00+09:00`. 비어 있으면 해당 행은 diff에서 제외. |
| `source` | 권장 | `kasi_almanac`, `manual_qa`, `unse_wiki`, `ocr_import` 등 출처 코드. |
| `confidence` | 권장 | `0`–`1` 실수, 또는 `high` / `medium` / `low` 문자열. 리포트에 그대로 실어 **가중치·경고**에 사용. |
| `verifiedBy` | 권장 | 검증 주체: `human:이름`, `pipeline:build-42`, `gpt-assisted` 등. 감사 추적용. |
| `note` | 선택 | 자유 메모. |

**검토 요약**

- `confidence` + `verifiedBy`는 **FAIL 게이트와 분리**하는 것이 좋음: 수치 diff는 기계적으로 판정하고, `confidence < 0.8`이면 **경고만** 올리는 2단계.
- `calendarYear` vs `year`: 입춘은 **항상 양력 연 키**이므로 `calendarYear`를 표준으로 두고 `year`는 호환 별칭.

---

## 2. `qa:jieqi:report` 구체화

**명령:** `npm run qa:jieqi:report`

**입력**

- `app/api/saju/data/solar-terms/bundle.json` (또는 `JIEQI_BUNDLE_PATH`)
- `reference/jieqi-reference.csv` (또는 `JIEQI_REF_CSV`)

**대상 연도:** `1970`–`2035` 양력 연도별 **입춘 한 점**과 레퍼런스 행 매칭.

**지표**

| 지표 | 정의 |
|------|------|
| `maxAbsDeltaSec` | 비교 가능한 행 중 \|ref − bundle\| 초 최댓값 |
| `p95AbsDeltaSec` | 동일 집합에서 절댓값 기준 95 백분위(행 수 1이면 해당 값) |
| `FAIL threshold` | 환경변수 `JIEQI_FAIL_MAX_ABS_SEC`(기본 `300`) 초 초과 시 **exit code 1** |
| `tolerance band` | `JIEQI_EXACT_MAX_ABS_SEC`(기본 `1`) 이하 → `exact`, 그 초과且 ≤ `JIEQI_TOLERANCE_SEC`(기본 `300`) → `within_tolerance`, 그 초과 → `outlier` |

**`npm run qa:jieqi:report` 스냅샷 (CSV 錨点 QA 확정 반영 후, 2026-05-15)**

| 항목 | 값 |
|------|-----|
| 비교 연도 | CSV에 행 있는 **4**개 / 범위 1970–2035 전체 **66** |
| `exact` | **1** (1997) |
| `within_tolerance` | **0** |
| `outlier` | **3** (1995, 2001, 2024) |
| `maxAbsDeltaSec` | **29749** (2001 행, 번들 대비) |
| `p95AbsDeltaSec` | **29749** (비교 행 4개뿐이라 동일) |
| CI FAIL | `JIEQI_FAIL_MAX_ABS_SEC=300` 초과로 **exit 1** (기대 신호) |
| 산출물 | `reports/jieqi-lichun-report.json`, `reports/jieqi-lichun-report.txt` |

**운세위키 QA 사례: 1995 입춘 (오후 창구 vs 현재 번들)**

- **확정(2026-05):** **2월 4일 16:19 KST**부터 을해·무인. (이전 문서는 정각 그리드 기준 **17:00** 전환을 錨点으로 서술.)
- **1997·2001·2024와의 대비:** 위키는 **연도별 실제 입춘에 맞춘 전환 시각**으로 보이며 **매년 고정 시각 규칙이 아님**.
- 현재 번들(lunar-javascript): `1995-02-04T15:12:51.000Z` → **KST 약 2월 5일 00:13** — 위키 **錨点 `1995-02-04T16:19:00+09:00`**(= UTC 1995-02-04T07:19:00.000Z)과 비교 시 **\|Δ\| ≈ 7.90시간(28431초)** → **`outlier`** (300초 밖).
- CSV: `instantKst=1995-02-04T16:19:00+09:00`, 상세는 `note`.

**운세위키 QA 사례: 1997 입춘 (창구 vs 번들)**

- **확정(2026-05):** **2월 4일 04:00 KST**부터 정축·임인.
- 현재 번들: `1997-02-03T19:00:00.000Z` = **KST 04:00** — 위키 錨点과 **동일 시각** → **`exact`** (`deltaSecRefMinusBundle=0`).
- CSV: `instantKst=1997-02-04T04:00:00+09:00`(변경 없음), `note`에 확정 문구 반영.

**운세위키 QA 사례: 2001 입춘 (창구 vs 현재 번들)**

- **확정(2026-05):** **2월 4일 03:13 KST**부터 신사·경인. (이전에는 정각 그리드 상한 **04:00**을 錨点으로 둠.)
- **패턴:** 1997과 같이 **새벽대**이나, **1995(오후)·2024(저녁)**과 마찬가지로 **연도마다 시각이 다름**.
- 현재 번들: `2001-02-04T02:28:49.000Z` → **KST 약 11:28** — 위키 **錨点 `2001-02-04T03:13:00+09:00`**과 비교 시 **\|Δ\| ≈ 8.26시간(29749초)** → **`outlier`** (300초 밖). **네 연도 중 \|Δ\| 최대.**
- CSV: `instantKst=2001-02-04T03:13:00+09:00`, `qa:jieqi:report`는 병합 전까지 **FAIL·outlier**가 기대 신호.

**운세위키 QA 사례: 2024 입춘 (저녁 창구 vs 현재 번들)**

- **확정(2026-05):** **2월 4일 17:27 KST**부터 갑진·병인. (이전에는 정각 **18:00**을 錨点으로 둠.)
- 현재 번들: `2024-02-04T16:27:07.000Z` → **KST 약 2월 5일 01:27** — 위키 **錨点 `2024-02-04T17:27:00+09:00`**과 비교 시 **\|Δ\| ≈ 8.00시간(28807초)** → **`outlier`** (300초 밖).

**입춘 QA 연도별 비교 요약 (운세위키 錨点 vs 현재 bundle)** — *錨点은 2026-05 QA 확정값.*

| 연도 | 위키 확정 전환 | 위키 錨点 `instantKst` | 번들 `lichunUtc`(UTC) | 번들 KST(요약) | \|Δ\|(초) | 분류 |
|------|----------------|-------------------------|------------------------|----------------|-----------|------|
| 1995 | 02-04 **16:19** KST~ 을해/무인 | `1995-02-04T16:19:00+09:00` | `1995-02-04T15:12:51.000Z` | 2/**5** **00:13** | **28431** | **outlier** |
| 1997 | 02-04 **04:00** KST~ 정축/임인 | `1997-02-04T04:00:00+09:00` | `1997-02-03T19:00:00.000Z` | 2/4 04:00 | **0** | **exact** |
| 2001 | 02-04 **03:13** KST~ 신사/경인 | `2001-02-04T03:13:00+09:00` | `2001-02-04T02:28:49.000Z` | 2/4 **11:28** | **29749** | **outlier** |
| 2024 | 02-04 **17:27** KST~ 갑진/병인 | `2024-02-04T17:27:00+09:00` | `2024-02-04T16:27:07.000Z` | 2/**5** **01:27** | **28807** | **outlier** |

**“연도별 정상 / outlier” 패턴 (가설)**

- **정상(위키와 맞춘 상태):** 1997처럼 **국내/위키 錨点에 맞춘 번들** 또는 천문 표와의 차가 수분 이내.
- **outlier:** 1995·2001·2024는 **lunar-js 기본 번들**이 위키 錨点과 **수 시간** 벌어짐. **2026-05 錨点 갱신 후** \|Δ\|는 대략 **28431 / 29749 / 28807초**(약 **7.9h / 8.3h / 8.0h**); **최대는 2001**. 위키 쪽은 **연도마다 오후·새벽·저녁 등 전환 시각이 다름**. **lunar-js 쪽은 한 체계(UTC 기준 역산)**로 밀려, 위키·번들 **출처 불일치**가 크게 드러나는 샘플로 보는 것이 타당.
- **의심 포인트:** (1) **2001·2024처럼 대량 outlier**가 나오는 연도는 `build-solar-terms.mjs` → `getJieQiTable` → JD→UTC 경로와 **위키 그리드**를 **같은 “한국 벽시계 입춘일”**로 놓고 비교했을 때의 오해인지(예: 번들이 **다음날 새벽**으로 넘어가 표기되는 경우) `note`에 **양쪽 모두 ISO**를 적어 두면 원인 조사에 유리. (2) **1997만 수동 패치**되어 있어 연도 간 **번들 품질이 균일하지 않음**.

**tolerance 기준(권장)**

- **CI 기본값 유지:** `JIEQI_TOLERANCE_SEC=300`(5분), `JIEQI_FAIL_MAX_ABS_SEC=300` — 연간 입춘은 천문·표기 차가 보통 이 안에 들어오도록 설계.
- **운세위키식 “몇 분 창구”만 비교할 때:** 번들이 창구 **한쪽 끝**(여기서는 04:00)에 맞춰 있으면 diff는 0에 가깝고, 레퍼런스를 창구 **중점**으로 잡으면 최대 **~10분(600초)**까지 벌어질 수 있음. 그 경우는 **FAIL이 아니라 `note`로 창구를 남기고**, 필요 시 일시적으로 `JIEQI_TOLERANCE_SEC=600`으로 **수동 리포트**만 돌려 병합 여부를 사람이 판단하는 방식을 권장(기본 CI는 300 유지).

**출력**

- `reports/jieqi-lichun-report.json` — 연도별 행 + `summary` 블록
- `reports/jieqi-lichun-report.txt` — 사람 읽기용 10줄 내외 요약

`reports/`는 `.gitignore`에 두어 CI 아티팩트로만 보관해도 됨.

---

## 3. 분류: exact / within_tolerance / outlier

| 분류 | 조건 (기본값) |
|------|----------------|
| `missing_reference` | CSV에 해당 연 입춘 행 없음 또는 `instantKst` 비어 있음 |
| `missing_bundle` | 번들에 `lichunUtcByCalendarYear[y]` 없음 |
| `exact` | \|Δ\| ≤ `JIEQI_EXACT_MAX_ABS_SEC` 초 |
| `within_tolerance` | `exact` 초과且 \|Δ\| ≤ `JIEQI_TOLERANCE_SEC` 초 |
| `outlier` | \|Δ\| > `JIEQI_TOLERANCE_SEC` 초 |

선택: `within_tolerance`에 `exact`를 포함시키지 않고 **배타**로 두면 운영 리포트가 읽기 쉬움(현 스크립트는 배타).

---

## 4. `build-bundle-from-reference.mjs` (향후)

구체 단계표·시드/병합/검증은 **`docs/jieqi-data-pipeline.md` §3.1**에 두고, 여기서는 요약만 한다.

1. **입력:** `jieqi-reference.csv`(입춘 전 구간) + 선택 `manual-overrides.json` + 선택 시드 번들(`build-solar-terms.mjs` 출력).
2. **베이스:** 시드는 **선택**; `lunar-js`는 **fallback/초기 12절**만 ([`jieqi-strategy.md`](./jieqi-strategy.md)).
3. **병합:** CSV 입춘으로 `lichunUtcByCalendarYear[y]` 및 `baziyearTerms[y][0]` 동기화; 인접 사주연 시간순 검증.
4. **출력:** `bundle.json` + `meta.sourceType: domestic_reference`(또는 composite), `referenceVersion`.
5. **검증:** 동일 파이프에서 `npm run qa:jieqi:report`; domestic 번들이 기본이 되기 전에는 **report-only**도 허용 가능.

---

## 5. 런타임 A/B: `lunar-js` vs `domestic verified`

| 환경변수 | 제안 |
|----------|------|
| `SOLAR_TERMS_BUNDLE_PATH` | 절대 또는 저장소 루트 기준 상대 경로. 미설정 시 기본 `app/api/saju/data/solar-terms/bundle.json`. |
| (선택) `SOLAR_TERMS_BUNDLE_PROFILE` | `default` \| `domestic` — 프로필명만 주고 실제 경로는 서버 설정 테이블에 매핑. |

Next.js 서버에서는 `process.env.SOLAR_TERMS_BUNDLE_PATH`를 읽어 `korean-month-pillar.js`의 `loadBundle()`이 **단일 진입점**으로 로드하도록 변경하면 A/B가 됨(구현은 별 태스크).

---

## 6. 우선순위 (데이터 신뢰)

**1단계(현재):** [`jieqi-strategy.md`](./jieqi-strategy.md)에 맞춰 **입춘 reference 행 축적**(1995·1997·2001·2024 등 운세위키 QA 행) + `qa:jieqi:report`로 delta·기준 고정. **구현·엄격 CI FAIL은 그 다음.**

1. CSV 채움 + `qa:jieqi:report`를 CI에 연결(초기에는 아티팩트·경고 위주 가능).  
2. domestic 번들이 기본이 되면 `FAIL` 임계값으로 레그레션 방지.  
3. `build-bundle-from-reference`(§4, 파이프라인 §3.1)로 domestic 번들 아티팩트화.  
4. 런타임 경로 스위치로 스테이징 검증.

이 문서는 `docs/jieqi-data-pipeline.md`, [`jieqi-strategy.md`](./jieqi-strategy.md)와 함께 **데이터 계약**으로 유지합니다.

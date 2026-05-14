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

**운세위키 QA 사례: 1995 입춘 (오후 창구 vs 현재 번들)**

- 관측: **2월 4일 16:00 KST**까지 갑술·정축, **17:00 KST**부터 을해·무인 → 입춘 **약 16:00~17:00 KST(오후)** 구간.
- **1997·2001(새벽)과의 대비:** 운세위키는 **연도별 실제 입춘 시각**에 맞춘 창구로 보이며, **매년 고정 새벽 4시 규칙이 아님**. 1995(오후 17시 전후)·1997(새벽 04시 전후)·2024(저녁 18시 전후)가 **서로 다른 시각대**임.
- 현재 번들(lunar-javascript): `1995-02-04T15:12:51.000Z` → **한국 벽시계 약 2월 5일 00:13 KST** — 위키 **錨点 2월 4일 17:00**과 비교 시 **\|Δ\| ≈ 7.2시간(약 25971초)** → **outlier** (300초 밖).
- CSV: `instantKst=1995-02-04T17:00:00+09:00`(새 기둥 시작 시각을 錨点으로 둠), 창구·번들 UTC는 `note`에 기록.

**운세위키 QA 사례: 1997 입춘 (창구 vs 번들)**

- 관측: **2월 4일 03:50 KST**까지 병자·신축, **04:00 KST**부터 정축·임인 → 입춘은 **약 03:50~04:00 KST** 구간.
- 현재 번들: `1997-02-03T19:00:00.000Z` = **KST 04:00** — 위 창구의 **상한과 일치**하므로 운세위키 기준과 **거의 정합**으로 기록.
- CSV 반영: `instantKst`는 검증용 **錨点**으로 `1997-02-04T04:00:00+09:00`을 두고, **창구·출처는 `note`**에 남긴다(중간값을 쓰면 `note`에 근거 명시).

**운세위키 QA 사례: 2001 입춘 (창구 vs 현재 번들)**

- 관측: **2월 4일 03:00 KST**까지 경진·기축, **04:00 KST**부터 신사·경인(05:00 동일) → 입춘 **약 03:00~04:00 KST** 구간.
- **패턴:** 1997과 같이 **새벽** 창구인 연도가 있으나, **1995(오후)·2024(저녁)**처럼 **같은 날짜라도 시각대가 연도마다 다름** — 위키는 **고정 새벽 4시 규칙이 아니라 연도별 절입 근처**로 보는 것이 타당(국내 reference table 전략과 부합).
- 현재 번들(lunar-javascript): `2001-02-04T02:28:49.000Z` → **KST 약 11:28** — 위키 **錨点 04:00**과 비교 시 **\|Δ\| ≈ 7.5시간(약 26929초)** → 기본 **`JIEQI_TOLERANCE_SEC=300` 밖 → `outlier`**. **tolerance 내 아님.**
- CSV: `instantKst=2001-02-04T04:00:00+09:00`으로 **창구 상한**을 두고, 차이는 `note`에 명시. `qa:jieqi:report`는 **outlier·FAIL**로 드러나며, **국내 기준 번들 병합 전까지 기대되는 신호**로 보면 됨(1997은 수동 정합으로 exact).

**운세위키 QA 사례: 2024 입춘 (저녁 창구 vs 현재 번들)**

- 관측: **2월 4일 07:00~17:00 KST**까지 계묘·을축, **18:00 KST**부터 갑진·병인 → 입춘 **약 17~18시 KST(저녁)** 구간.
- **1995·1997·2001과의 차이:** 위키 UI가 **매년 동일 시각(예: 새벽 4시)**로 고정된 것이 아니라, **해당 연도 실제 절입 근처**로 그리드가 붙는 패턴(1995 오후·1997·2001 새벽·2024 저녁 등).
- 현재 번들(lunar-javascript): `2024-02-04T16:27:07.000Z` → **한국 벽시계 약 2월 5일 01:27 KST** — 위키 **錨点 2월 4일 18:00**과 비교 시 **\|Δ\| ≈ 7.45시간(약 26827초)** → **outlier** (300초 밖).
- CSV: `instantKst=2024-02-04T18:00:00+09:00`, 창구·번들 UTC는 `note`에 기록.

**입춘 QA 연도별 비교 요약 (운세위키 錨点 vs 현재 bundle)**

| 연도 | 위키 관측 창구(요약) | 위키 錨点 `instantKst` | 번들 `lichunUtc`(UTC) | 번들 KST(요약) | \|Δ\|(초) 대략 | 분류 |
|------|----------------------|-------------------------|------------------------|----------------|---------------|------|
| 1995 | 오후 ~16:00~17:00 | `1995-02-04T17:00:00+09:00` | `1995-02-04T15:12:51.000Z` | 2/**5** **00:13** | ~25971 | **outlier** |
| 1997 | 새벽 ~03:50~04:00 | `1997-02-04T04:00:00+09:00` | `1997-02-03T19:00:00.000Z` | 2/4 04:00 | ~0 | **exact** (수동 정합) |
| 2001 | 새벽 ~03:00~04:00 | `2001-02-04T04:00:00+09:00` | `2001-02-04T02:28:49.000Z` | 2/4 **11:28** | ~26929 | **outlier** |
| 2024 | 저녁 ~17:00~18:00 | `2024-02-04T18:00:00+09:00` | `2024-02-04T16:27:07.000Z` | 2/**5** **01:27** | ~26827 | **outlier** |

**“연도별 정상 / outlier” 패턴 (가설)**

- **정상(위키와 맞춘 상태):** 1997처럼 **국내/위키 錨点에 맞춘 번들** 또는 천문 표와의 차가 수분 이내.
- **outlier:** 1995·2001·2024는 **lunar-js 기본 번들**이 위키 錨点과 **수 시간** 벌어짐. 위키 쪽은 **연도마다 오후·새벽·저녁 등 창구 시각이 다름**(고정 “새벽 4시” 아님). **lunar-js 쪽은 한 체계(UTC 기준 역산)**로 밀려, 위키·번들 **출처 불일치**가 크게 드러나는 샘플로 보는 것이 타당.
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

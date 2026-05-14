# 국내 기준 절입 QA 자동화

계산 엔진과 분리된 **데이터 신뢰·회귀** 레이어입니다.

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

**운세위키 QA 사례: 1997 입춘 (창구 vs 번들)**

- 관측: **2월 4일 03:50 KST**까지 병자·신축, **04:00 KST**부터 정축·임인 → 입춘은 **약 03:50~04:00 KST** 구간.
- 현재 번들: `1997-02-03T19:00:00.000Z` = **KST 04:00** — 위 창구의 **상한과 일치**하므로 운세위키 기준과 **거의 정합**으로 기록.
- CSV 반영: `instantKst`는 검증용 **錨点**으로 `1997-02-04T04:00:00+09:00`을 두고, **창구·출처는 `note`**에 남긴다(중간값을 쓰면 `note`에 근거 명시).

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

1. **입력:** `jieqi-reference.csv`(입춘 전 구간) + 선택 `manual-overrides.json`.
2. **베이스:** `build-solar-terms.mjs` 출력 또는 동일 로직으로 12절 생성.
3. **병합:** CSV 입춘으로 `lichunUtcByCalendarYear[y]` 및 `baziyearTerms[y][0]` 동기화; 인접 사주연 시간순 검증.
4. **출력:** `bundle.json` + `meta.sourceType: domestic_reference`, `referenceVersion`, `manualOverridesApplied`.
5. **검증:** `npm run qa:jieqi:report`를 같은 파이프에서 실행해 FAIL이면 빌드 실패.

---

## 5. 런타임 A/B: `lunar-js` vs `domestic verified`

| 환경변수 | 제안 |
|----------|------|
| `SOLAR_TERMS_BUNDLE_PATH` | 절대 또는 저장소 루트 기준 상대 경로. 미설정 시 기본 `app/api/saju/data/solar-terms/bundle.json`. |
| (선택) `SOLAR_TERMS_BUNDLE_PROFILE` | `default` \| `domestic` — 프로필명만 주고 실제 경로는 서버 설정 테이블에 매핑. |

Next.js 서버에서는 `process.env.SOLAR_TERMS_BUNDLE_PATH`를 읽어 `korean-month-pillar.js`의 `loadBundle()`이 **단일 진입점**으로 로드하도록 변경하면 A/B가 됨(구현은 별 태스크).

---

## 6. 우선순위 (데이터 신뢰)

1. CSV 채움 + `qa:jieqi:report`를 CI에 연결.  
2. `FAIL` 임계값으로 레그레션 방지.  
3. `build-bundle-from-reference`로 domestic 번들 아티팩트화.  
4. 런타임 경로 스위치로 스테이징 검증.

이 문서는 `docs/jieqi-data-pipeline.md`와 함께 **데이터 계약**으로 유지합니다.

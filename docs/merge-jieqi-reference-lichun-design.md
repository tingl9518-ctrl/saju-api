# `merge-jieqi-reference-lichun.mjs` — domestic bundle 병합 설계 (구현과 동기)

**목표:** `build-solar-terms.mjs`가 만든 **시드 번들**에 `reference/jieqi-reference.csv`의 **입춘(錨点)**만 반영해, 런타임이 읽는 **`bundle.json`과 동일 스키마**의 산출물을 만든다.  
**전제:** CSV에 **QA 확정** 행이 있는 연도만 병합(예: 1995·1997·2001·2024). 나머지 연도는 시드 그대로.

**관련:** [`jieqi-data-pipeline.md`](./jieqi-data-pipeline.md) §3.1, [`domestic-bundle-operations.md`](./domestic-bundle-operations.md), [`jieqi-qa-automation.md`](./jieqi-qa-automation.md).

---

## 1. `merge-jieqi-reference-lichun.mjs`의 실제 역할

| 단계 | 내용 |
|------|------|
| **입력** | (1) **시드 JSON** — 원칙적으로 `build-solar-terms.mjs`의 출력과 **동일 스키마**인 객체(파일 경로 또는 stdin). (2) **`reference/jieqi-reference.csv`** — `parseJieqiReferenceRows` 등 기존 파서 재사용. |
| **선별** | `jieId`가 `ipchun` \| `lichun`(대소문자 무시)이고 `instantKst`가 비어 있지 않은 행만 **병합 대상**. `calendarYear`(또는 `year` 별칭)를 **양력 입춘 연도 키**로 사용. |
| **변환** | 각 행의 `instantKst`(예: `1995-02-04T16:19:00+09:00`)를 **UTC ISO8601** 문자열로 정규화한다. 번들은 관례상 `...Z` 또는 `...000Z` 형태 — **시드와 동일한 문자열 규칙**을 맞춘다(파서·`Date.parse` 호환). |
| **적용** | 아래 §3·§4 규칙으로 시드 객체의 **지정 필드만** deep copy 후 수정(원본 시드 파일은 **읽기 전용**으로 두는 것을 권장). |
| **검증** | §5의 **시간순·인접 연도** 검사를 통과하지 못하면 **비정상 종료(exit ≠ 0)** 및 오류 메시지(어느 연도·어느 제약인지). |
| **메타 갱신** | §6 참고. |
| **출력** | 병합된 `bundle.json` 한 개(파일 쓰기 또는 stdout). CI에서는 시드와 병합 결과를 **아티팩트로 분리** 저장 가능. |

**하지 않는 것(범위 밖):** 12절 전부를 CSV에서 생성하지 않음. `lunar-javascript`를 런타임에 호출하지 않음. 골든 expected 수정은 **별 PR/태스크**.

---

## 2. `build-solar-terms.mjs`와의 관계

```
build-solar-terms.mjs
        │
        ▼
   시드 bundle.json   (meta.generator = build-solar-terms.mjs, lunar-js 단일 출처)
        │
        │   reference/jieqi-reference.csv (입춘 행만 채워진 부분집합)
        ▼
merge-jieqi-reference-lichun.mjs
        │
        ▼
   배포용 bundle.json (meta = composite / domestic 병합 이력)
```

| 구분 | `build-solar-terms.mjs` | `merge-jieqi-reference-lichun.mjs` |
|------|-------------------------|-------------------------------------|
| **역할** | `Lunar.getJieQiTable()` 기반으로 **`lichunUtcByCalendarYear`(1969–2036)** 및 **`baziyearTerms`(1969–2035)** 전량 생성 | 시드를 **복사한 뒤**, CSV에 있는 **연도만** 입춘 관련 필드 **덮어쓰기** |
| **진실 소스** | `lunar-javascript` | CSV의 `instantKst`(국내 QA 錨点) |
| **실행 순서** | **항상 먼저**(또는 CI에서 시드 아티팩트 확보) | 시드 확정 **직후** |

**운영 권장:** 시드를 `bundle.lunarjs.json`(가칭)으로 두고, 병합 산출만 `bundle.json`으로 배포하면 **rollback·diff**가 쉬움([`domestic-bundle-operations.md`](./domestic-bundle-operations.md)).

---

## 3. 덮어쓰는 필드 (최소 집합)

CSV에 **연도 `Y` 한 줄**이 병합되면, 시드 객체에서 다음만 변경한다.

| 경로 | 변경 내용 |
|------|-----------|
| `lichunUtcByCalendarYear[String(Y)]` | 해당 연 **양력 입춘**의 UTC ISO — `resolveBaziYear()`가 이 키를 직접 사용함(`korean-month-pillar.js`). |
| `baziyearTerms[String(Y)][0].instantUtc` | 사주연 `Y`의 **첫 절입(입춘)** 시각을 **위와 동일한 UTC 문자열**로 설정. |
| `baziyearTerms[String(Y)][0].id` | **변경하지 않음.** 시드가 `lichun`이면 검증만; 다르면 **병합 실패**로 두는 것이 안전. |

**변경하지 않는 것:** `baziyearTerms[Y][1..11]`(경칩·청명 등), 다른 연도의 배열 전체, `lichunUtcByCalendarYear`의 CSV에 없는 키.

**키 존재 정책(결정 필요):**

- **권장 A:** `lichunUtcByCalendarYear[Y]`와 `baziyearTerms[Y]`가 시드에 **모두 있을 때만** 병합. 없으면 **경고 후 스킵** 또는 **실패**.
- **권장 B:** CSV 연도가 `1969..2036`(lichun 맵 범위) 밖이면 **실패**.

**`lichunUtc` vs `baziyearTerms` 이중 이유:** 런타임은 **연주 경계**에 `lichunUtcByCalendarYear(calendarYear)`를 쓰고, **월주**는 `baziyearTerms(baziYear)`의 절입 리스트를 순회한다. 둘 중 하나만 맞추면 **입춘 전후 생시**에서 연주·월주가 **서로 다른 타임라인**을 보게 되어 **반드시 동일 instant**로 맞춘다.

---

## 4. `baziyearTerms` / `lichunUtcByCalendarYear` 동기화 방식

**불변식(병합 후 반드시 성립):**

```
Date.parse(lichunUtcByCalendarYear[String(Y)])
    === Date.parse(baziyearTerms[String(Y)][0].instantUtc)
```

**알고리즘(의사코드):**

1. CSV에서 병합 대상 행 집합 `R`을 만든다.
2. 각 `r ∈ R`에 대해 `Y = r.calendarYear`, `utc = kstIsoToUtcIso(r.instantKst)`.
3. `bundle.lichunUtcByCalendarYear[String(Y)] = utc`.
4. `terms = bundle.baziyearTerms[String(Y)]` — 없거나 비어 있으면 정책에 따라 실패.
5. `terms[0].id === "lichun"`이 아니면 실패.
6. `terms[0].instantUtc = utc`.
7. (선택) `lichunUtcByCalendarYear`에만 있고 `baziyearTerms[Y]`가 없는 **캘린더 전용 키**(예: 2036)는 CSV 설계상 나오지 않게 하거나, 별도 정책으로 “lichun 맵만 패치” 분기 — **MVP는 1970–2035 CSV와 1969–2035 시드가 겹치는 구간만** 다루면 됨.

**KST → UTC:** `Date.parse(instantKst)` 또는 Temporal/명시 오프셋 파서로 **일관된 UTC 문자열** 출력. 서머타임 이슈 없음(한국 `+09:00` 고정).

---

## 5. Regression 위험

| 위험 | 설명 | 완화 |
|------|------|------|
| **입춘 시각 이동** | 錨点이 시드보다 **이르거나 늦게** 바뀌면, 그 순간 전후 **같은 양력 일시**의 `baziYear`·`lastJieId`가 바뀜 | 병합 후 `npm test` + `npm run qa:jieqi:report`; 입춘 직전·직후 **슬롯 골든** 추가 검토 |
| **시간순 역전** | 새 입춘이 **이전 사주연의 소한**보다 이르거나, **경칩**보다 늦게 밀림 | 병합 직후 **전역 검증:** 각 `baziyearTerms[Y]` 배열 내부는 엄격 증가, `terms[Y][11]`(소한) `< terms[Y+1][0]`(다음 연 입춘) 등(구현 시 연도 경계 규칙 표로 고정) |
| **1997 이중 패치** | 현재 `bundle.json`은 `manualOverridesApplied` 등으로 1997만 손댄 이력이 있음 | 병합으로 **동일 값**이면 메타만 `composite`로 정리; **CSV가 단일 SoT**가 되도록 `manualOverrideIds` 비우기 등 운영 규칙 결정 |
| **골든 `known_mismatch`** | 입춘·월주가 위키에 가까워지면 **기대값 역전** 가능 | 병합 배포 PR에서 **expected·known_mismatch 재분류**를 같은 배치로 계획 |
| **해시/캐시** | 번들 내용 변경 시 **CDN·에지 캐시** | 배포 파이프에서 `meta.mergedAt`·`referenceVersion` 노출 |

---

## 6. 구현 순서 (권장)

1. **시드-only 산출 고정:** `build-solar-terms.mjs` → `bundle.lunarjs.json`(또는 CI 아티팩트). Git에 시드를 둘지는 팀 정책.
2. **`merge-jieqi-reference-lichun.mjs` 스켈레톤:** argv로 `--seed`, `--csv`, `--out`, 실패 시 stderr.
3. **CSV 파서 재사용:** `scripts/lib/parse-jieqi-reference-csv.mjs`.
4. **KST→UTC + 이중 쓰기:** §3–§4.
5. **검증 모듈:** 시간순·인접 연도(별 파일 `validate-baziyear-continuity.mjs`로 분리 가능).
6. **`package.json` 스크립트:** `npm run build:data:lunarjs` → `npm run build:data:domestic`; 전체는 `npm run build:data`.
7. **`meta` 작성:** `sourceType: "composite"`(또는 `domestic_reference_partial`), `mergedAt`, `referenceVersion`(CSV 해시 또는 수동 버전 문자열), `generator`는 **병합 스크립트명을 추가**하거나 `dataLineageNote`에 한 줄 요약.
8. **`npm run qa:jieqi:report`:** 병합 산출에 대해 돌려 **1997=exact 유지**, 나머지 CSV 연도는 **의도된 잔차**인지 확인.
9. **`npm test`:** 골든 조정 PR.
10. **문서:** `jieqi-data-pipeline.md` §3.1에 “구현 완료” 및 스크립트 이름 확정 반영.

---

## 7. Rollback 가능 여부

| 방식 | 가능 여부 |
|------|-----------|
| **이전 `bundle.json`으로 Git revert / 태그 체크아웃** | **가능** — 가장 단순. |
| **시드 파일(`bundle.lunarjs.json`)만 유지** | 병합 전 상태로 **재실행 없이** 복구 가능(시드가 진실). |
| **런타임 `SOLAR_TERMS_BUNDLE_PATH`** (향후) | 스테이징에서 시드 경로만 가리키면 **배포 롤백 없이** 검증 가능. |
| **CSV에서 행 제거** | 해당 연도는 시드값으로 돌아감 — **데이터 롤백**으로 기능적 롤백. |

**주의:** 시드와 병합 결과를 **한 파일에 덮어쓰기만** 하면, 로컬에서 시드가 사라질 수 있음. **시드 아티팩트 보존**이 rollback의 전제.

---

## 8. QA 확정 錨点(참고, 구현 시 테스트 입력)

| 연도 | KST (전환) | `instantKst` (CSV) |
|------|------------|---------------------|
| 1995 | 1995-02-04 16:19~ | `1995-02-04T16:19:00+09:00` |
| 1997 | 1997-02-04 04:00~ | `1997-02-04T04:00:00+09:00` |
| 2001 | 2001-02-04 03:13~ | `2001-02-04T03:13:00+09:00` |
| 2024 | 2024-02-04 17:27~ | `2024-02-04T17:27:00+09:00` |

이 값들은 **`reference/jieqi-reference.csv`에 이미 반영**되어 있으므로, 병합 스크립트는 **하드코딩 없이** CSV만 읽으면 된다([`jieqi-strategy.md`](./jieqi-strategy.md) — 연도 하드코딩 금지).

---

## 9. 구현 시 체크리스트 (요약)

- [ ] 시드 경로와 출력 경로 **분리**
- [ ] `lichunUtc`와 `baziyearTerms[][0]` **동시 동일**
- [ ] `id === "lichun"` 가드
- [ ] 연도 경계 **단조 증가** 검증
- [ ] `meta`에 병합 이력·CSV 버전
- [ ] `qa:jieqi:report` + `npm test` 녹색(또는 의도된 갱신 포함 PR)

이 문서는 **코드 없이** 병합 구현 직전의 **계약·순서·리스크**를 고정한다. 구현 후에는 스크립트 헤더 주석에서 본 문서를 링크하면 된다.

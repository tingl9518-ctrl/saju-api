# Event-driven sparse override — 운영 정책 (2026-05)

**상태:** Tier1 lichun **blind QA 전략 종료**. 이후 절기·입춘 보정은 **이벤트·증상 기반 sparse override**만 수행한다.

**근거 (Tier1 폐기):**

| 지표 | 결과 |
|------|------|
| Week1 + Week2 sampled | **10** |
| rejected (`no_patch_needed`) | **10** |
| 실제 patch 필요 | **0** |
| feb4 10~16 / feb5 시드 패턴 | **mismatch proxy 부적합** (가설 기각) |

---

## 1. 현재 운영 전략 — Event-driven sparse override

### 정의

| 요소 | 내용 |
|------|------|
| **Event-driven** | CSV 행 추가는 **사전 정의된 패턴 큐**가 아니라, **증상·회귀·제보**가 발생했을 때만 진행 |
| **Sparse** | `reference/jieqi-reference.csv`에 **문제가 입증된 (연도 × 절기)** 만 기록; lunar-js 시드는 그대로 두고 **해당 셀만** 병합 덮어쓰기 |
| **Hybrid** | `npm run build:data` — 시드(`bundle.lunarjs.json`) + CSV 병합 → `bundle.json` (변경 없음) |

### 하지 않는 것

- Tier1 **33연** feb4/feb5 패턴 기반 **주간 blind 위키 QA**
- `patch_needed_est`를 **KPI·일정**으로 쓰는 것
- 입춘 **66연 전수** 錨点 채우기 (MVP 1970–2035)
- **1900~2100** domestic 전량 구축 (본 문서 §5)

### 하는 것

1. **회귀 앵커 유지** — 이미 CSV 반영된 **1995·1997·2001·2024 입춘** + **1995 bailu·hanlu**; `npm test`·`qa:jieqi:report` green 유지  
2. **증상 발생 시** 해당 **calendarYear × jieId** 만 CSV 추가 → `build:data` → 골든/리포트 재확인  
3. **입춘 경계** — 2/3~2/5 **분 단위** 전후 QA는 **이슈·랜덤 소량**만 (연 0~5시각 수준), 패턴 큐 전수 아님  
4. **12절** — **월주 mismatch가 확인된 절**만 sparse 추가 (1995 bailu·hanlu 선례)

### 관련 산출물

| 경로 | 역할 |
|------|------|
| `reference/jieqi-reference.csv` | SoT sparse 錨点 |
| `reference/golden/golden-cases.json` | 회귀·경계 생시 |
| `npm run qa:jieqi:report` | 입춘 ref vs bundle (병합 전/후) |
| `npm run qa:jieqi:coverage` | 792칸 커버리지·통계 (의사결정 보조) |
| `reference/lichun-human-qa-queue.csv` | **archived** — Tier1 실험 기록 (§2) |

---

## 2. Tier1 blind QA queue — 상태: **archived**

### `archived` vs `low_priority` — **archived 권장**

| 상태 | 의미 | Tier1에 맞는가 |
|------|------|----------------|
| **low_priority** | “아직 할 일”로 남음, 여유 시 진행 | **부적합** — feb4/feb5는 **proxy가 아님**이 확인됨. 잔여 23연을 돌려도 **patch 기대치 ≈ 0**에 가깝다. |
| **archived** | **전략 종료**, 감사·재현용 보존 | **적합** — Week1+2 표본으로 가설 **기각**; 큐를 열어두면 “미완 QA 백로그”로 **오해**하기 쉬움 |

**운영 규칙:**

- `reference/lichun-human-qa-queue.csv` — **수정·주간 배치 진행 중단**
- `progress=unchecked` 잔여 행 — **일괄 조사 대상 아님** (필요 시 개별 **이벤트**로만 재검)
- `npm run export:lichun-qa-queue` — **선택 실행**(히스토리 재생성). **신규 Tier1 배치 생성 금지**로 간주
- `report-jieqi-coverage`의 `tier1HumanQa` — **참고 통계만**, patch 일정·우선순위 **미사용**

상세: `reference/lichun-human-qa-queue.README.md`

---

## 3. Patch trigger 조건 (앞으로 CSV 행을 넣는 경우)

**원칙:** 위 4가지 **중 하나 이상** 충족 + **위키 錨点(`instantKst`) human 확정** 후에만 CSV·병합.

### T1. 실사용 mismatch (production / support)

| 조건 | 예 |
|------|-----|
| API·서비스 **실제 문의** | “입춘 전후인데 연주/월주가 운세위키와 다름” |
| 재현 가능한 **입력·기댓값** | 생년월일시 + 위키 스크린/창구 |
| **야자시 토글**은 별도 | `yajaMode`·R3 — **절기 CSV와 혼동 금지** |

### T2. 경계 생시 fail (boundary instant)

| 조건 | 예 |
|------|-----|
| **입춘·12절 instant 직전/직후 1~수십 분** | 연주·월주 전환 시각 불일치 |
| 위키에서 **錨点** 확인 | “16:19부터 을해”류 **분 단위** 전환 |
| Tier1식 검사 **불충분** | “시드 시각에 위키도 입춘 후”만 보면 **T2 미검출** — **반드시 경계 시각** 필요 |

### T3. Golden regression

| 조건 | 예 |
|------|-----|
| `golden-cases.json` **active** 케이스 fail | `known_mismatch` 해제 목표 |
| 신규 골든 추가 후 fail | 해당 연·절 CSV 후보 |
| **병합 후** 1997·1995·2001·2024 입춘 **exact 유지** 필수 | 파이프 무결성 앵커 |

### T4. 12절 월주 mismatch

| 조건 | 예 |
|------|-----|
| **월주만** 위키와 불일치 | 1995-10-09 한로, 1995-09-08 백로 |
| 입춘은 맞고 **다른 절** 틀림 | **입춘-only로 해결 불가** — 해당 `jieId` 행 추가 |
| 윤달 라벨만 있는 경우 | **절기 錨点** 먼저 검증 (R2, `wiki-divergence-rules.md`) |

### Patch 하지 않는 경우 (명시적 reject)

- feb4 10~16 / feb5 시드만으로 queue에 올라온 연도
- “시드 KST에 위키도 **이미 입춘 이후**” (Week1+2 전형)
- `qa:jieqi:report`에서 ref 없이 bundle만 outlier — **위키 錨点 미확정**
- tolerance 이내 잔차만 있는 경우 (팀 T, 예 300초 — `domestic-reference-priority.md` 3차)

### Patch 워크플로 (변경 없음)

1. `reference/jieqi-reference.csv` 행 추가 (`calendarYear`, `jieId`, `instantKst`, 출처·note)  
2. `npm run build:data`  
3. `npm run qa:jieqi:report` (해당 연·절) + `npm test`  
4. 필요 시 골든 expected 갱신  

---

## 4. Sparse patch 예상 최종 규모 (재정리)

**범위:** MVP **1900–2100**, 입춘 **201 calendar years**, 12절 그리드 **2,412 cells** (201×12). (2026-05 bundle 확장)

### 입춘 (`lichun` / `ipchun`)

| 구분 | 연도 수 | 비고 |
|------|---------|------|
| **현재 반영** | **4** | 1995, 1997, 2001, 2024 |
| **보수 (제보·회귀만)** | **+0~4** | 추가 이벤트 거의 없음 가정 |
| **중간 (권장 상한)** | **+6~12** | 경계 QA·리포트 outlier·제보 누적 |
| **입춘 최종 예상** | **10~16 / 66** (**15~24%**) | Tier1 33연 가정(**50%+**) **폐기** |

### 12절 전체 (sparse)

| 구분 | 칸 수 | 비고 |
|------|-------|------|
| **현재** | **6** | 1995×3 + 2001·2024·1997 입춘 |
| **이벤트 누적 (중간)** | **+15~40** | 월주 이슈 연·절만 |
| **792칸 대비** | **~3~6%** patched | **전량 domestic 아님** |

### KPI (운영)

| KPI | 사용 |
|-----|------|
| CSV 행 수 / 792 | **추적** (과도한 증가 시 경고) |
| `npm test` / 골든 fail 수 | **차단** |
| Tier1 `rejected` 누적 | **중단** (archived) |
| `patch_needed_est` | **미사용** |

---

## 5. 1900~2100 전체 domestic 구축 — 필요성 재평가

### 결론: **현 단계 비필수 · 비현실적 일괄 목표**

| 주장 | 판단 |
|------|------|
| “위키 100% = 1900~2100×12 전부 CSV” | **목표로 두지 않음**. Tier1이 증명한 것처럼 **시드 패턴만으로는 patch 대상 예측 불가**. |
| MVP **1970–2035** | **서비스 범위와 일치**. sparse + 이벤트로 **증상 구간만** 맞추는 것이 **비용 대비 효과 최대**. |
| **792칸 전량** | 리포트·baseline은 **맵/갭 가시화**용; **전 행 수동 錨点**는 운영 부담 과다 |
| **1900–1968 / 2036–2100** | 번들·API 범위 **확장 전**에는 CSV만 채워도 **런타임 이득 없음** |

### 권장 로드맵 (기존 domestic-reference-priority와 정합)

1. **1970–2035** — **sparse event-driven** (본 문서)  
2. **번들·API 범위 확장** 시 — 해당 구간만 **동일 sparse 정책** 적용  
3. **과거·미래 10년 단위** — 제품 요구·라이선스 확보 후; **자동 크롤 일괄 금지** 유지  

**한 줄:** 전체 domestic은 **이상적 SoT**이지 **현재 필수 작업이 아니다**. **event-driven sparse**가 운영·위키 정합의 **실제 전략**이다.

---

## 6. Tier1 실험 요약 (기록)

| 항목 | 내용 |
|------|------|
| 가설 | feb4 10~16 / feb5 시드 → 위키와 어긋나 patch 필요 |
| 방법 | 33연 queue, 주간 blind “입춘 이후 상태” 확인 |
| 결과 | **10/10 rejected**, patch **0** |
| 교훈 | mismatch는 **錨点 ~8h급 + 경계 생시**; **시드 달력 위치**와 무관할 수 있음 |
| 후속 | **T1–T4 trigger**만 사용 |

---

## 관련 문서

- `docs/wiki-divergence-rules.md` — R1~R4 mismatch 규칙  
- `docs/domestic-bundle-operations.md` — Hybrid 병합  
- `docs/domestic-reference-priority.md` — 연도 우선 (2차 outlier; Tier1 blind **종료**)  
- `docs/jieqi-strategy.md` — SoT 원칙  
- `reference/lichun-human-qa-queue.README.md` — archived queue  

본 문서가 **절기 domestic 운영의 단일 정책**이다. 표본·CSV 행 수가 바뀌면 §4만 갱신한다.

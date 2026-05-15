# 절입·번들 전략 방향 (국내 체감 기준)

**서비스 목표:** 국내 사용자 체감 기준(운세위키·국내 만세력 계열)과 **동일한 사주팔자 출력** — 특히 연·월(입춘·절입) 경계.

---

## QA에서 확인된 사실 (요약)

| 연도 | 운세위키 錨点 대비 | 해석 |
|------|-------------------|------|
| **1997** | 번들과 **정합 가능** (수동으로 위키 錨点에 맞춤) | 로직 문제라기보다 **데이터 출처 정합** 이슈 |
| **2001** | lunar-js 번들과 **약 7.5h** | 위키(새벽 창구) vs lunar-js **체계적 괴리** |
| **2024** | lunar-js 번들과 **약 7.45h** | 위키(저녁 창구)와 **동일 규모 괴리** — 연도마다 “새벽 4시” 고정이 아님 |

**결론:** 문제는 **월주 계산 로직**보다 **`lunar-javascript` 절입 시각이 국내 체감 기준과 맞지 않는 데이터 출처** 쪽으로 수렴한다. (성격만 한정한 판단: [`lichun-mismatch-nature.md`](./lichun-mismatch-nature.md).)

---

## 원칙 (고정)

1. **`lunar-javascript` 절입값을 절대 기준으로 두지 않는다.** 검증·초안·비교용으로만 쓴다.
2. **국내 기준 reference table**(`reference/jieqi-reference.csv` 확장 및 후속 표)을 **source of truth**로 본다.
3. **`bundle.json`은 reference 기반으로 재생성 가능한 산출물**로 유지한다(수동 hex 편집 지양).
4. **장기적으로는** 1997형 **수동 patch-in-bundle**이 아니라, **reference CSV(및 검증 파이프) 기반 생성**으로만 번들을 만든다.

---

## 다음 단계 (우선순위: QA·기준 확정)

1. **입춘 reference 행 축적:** `1995`·`2001`·`2024` 등 연도별로 운세위키·국내 만세력으로 확인한 시각을 CSV에 쌓는다. (`1997`은 이미 행 존재; 필요 시 `1995` 등 추가 회귀 앵커.)
2. **`build-bundle-from-reference.mjs` 설계 구체화** — 아래 `docs/jieqi-data-pipeline.md` §4·본 문서 §빌더 참고. 구현은 **CSV·기준이 충분히 찬 뒤**.
3. **`lunar-js` 역할:** **fallback / 초기 12절 채움(seed)** 만. 최종 운영 번들의 입춘·절입 **최종값은 reference**.
4. **운영 번들:** 성숙 단계에서 **`bundle.json` = domestic reference bundle** (또는 동등 생성물)만 배포하는 구조를 검토한다. 전환 시 `meta.sourceType`·`referenceVersion`으로 출처 고정.

---

## 관련 문서

- 기술·파이프라인: [`jieqi-data-pipeline.md`](./jieqi-data-pipeline.md)
- QA·diff·연도별 사례: [`jieqi-qa-automation.md`](./jieqi-qa-automation.md)
- 네 기둥 골든·회귀: [`saju-golden-test-strategy.md`](./saju-golden-test-strategy.md)
- 레퍼런스 파일 안내: [`../reference/README.md`](../reference/README.md)

**지금은 구현 확대보다, event-driven sparse CSV 축적과 `qa:jieqi:report`로 기준을 굳힌 뒤** 번들 생성기·런타임 스위치를 붙인다.  
운영: [`event-driven-sparse-override.md`](./event-driven-sparse-override.md) (Tier1 blind QA 종료).

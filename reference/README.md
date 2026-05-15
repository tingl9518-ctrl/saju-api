# 절입 레퍼런스·수동 패치

## 파일

| 파일 | 용도 |
|------|------|
| `jieqi-reference.csv` | 국내 기준 **입춘**(및 향후 12절) 시각. 빈 `instantKst` 행은 비교·빌드에서 스킵. |
| `jieqi-reference.sample.csv` | 스키마·작성 예시. |
| `manual-overrides.sample.json` | 베이스 번들에 덮어쓸 **임시/부분 패치** 스키마 예시. |
| `golden/` | `golden-cases.json`(회귀), `golden-cases.sample.json`, README. `npm test` 연동. 설계: `docs/saju-golden-test-strategy.md`. |

상세 파이프라인은 `docs/jieqi-data-pipeline.md`를 참고하세요.

**전략 방향(국내 체감 = truth, 번들은 reference 재생성):** `docs/jieqi-strategy.md`

## CSV 스키마

```text
calendarYear,jieId,instantKst,source,confidence,verifiedBy,note
```

- `calendarYear`: 양력 연(`year` 헤더도 동일 취급).
- `jieId`: 입춘은 `ipchun` 또는 `lichun`.
- `instantKst`: `1997-02-04T05:00:00+09:00` 형식 권장.
- `confidence`: `0`–`1` 또는 `high`/`medium`/`low`.
- `verifiedBy`: 검증 주체(예: `human:홍길동`, `pipeline:ci-123`).

상세 QA·리포트·FAIL 규칙: `docs/jieqi-qa-automation.md`

**데이터 빌드:** `npm run build:data:lunarjs` → `app/api/saju/data/solar-terms/bundle.lunarjs.json`(시드). `npm run build:data:domestic` → CSV 입춘 병합 후 `bundle.json`. `npm run build:data` = 둘 다 순차 실행.

**1995 입춘:** 운세위키 QA 확정(2026-05) **2/4 16:19 KST**부터 을해·무인. CSV 錨点 `1995-02-04T16:19:00+09:00`. 현 lunar-js 번들은 KST 약 2/5 00:13으로 **\|Δ\| ≈ 28431초(~7.9h) outlier** — `docs/jieqi-qa-automation.md` 비교 표·`reports/jieqi-lichun-report.json` 참고.

**1997 입춘:** 운세위키 QA 확정 **2/4 04:00 KST**부터 정축·임인; 번들 동일 시각. 레퍼런스 행·문서에 반영됨.

**2001 입춘:** 운세위키 QA 확정 **2/4 03:13 KST**부터 신사·경인; 현 lunar-js 번들은 KST 11:28대로 **\|Δ\| ≈ 29749초(~8.3h) outlier**(네 연도 중 최대) — CSV·`docs/jieqi-qa-automation.md`·리포트로 delta 확인.

**2024 입춘:** 운세위키 QA 확정 **2/4 17:27 KST**부터 갑진·병인; 번들은 **KST 2월 5일 01:27경**으로 **\|Δ\| ≈ 28807초(~8.0h) outlier**. 연도별 비교 표는 `docs/jieqi-qa-automation.md`.

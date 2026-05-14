# 절입 레퍼런스·수동 패치

## 파일

| 파일 | 용도 |
|------|------|
| `jieqi-reference.csv` | 국내 기준 **입춘**(및 향후 12절) 시각. 빈 `instantKst` 행은 비교·빌드에서 스킵. |
| `jieqi-reference.sample.csv` | 스키마·작성 예시. |
| `manual-overrides.sample.json` | 베이스 번들에 덮어쓸 **임시/부분 패치** 스키마 예시. |

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

**1995 입춘:** 운세위키 기준 2/4 16:00까지 갑술·정축, 17:00부터 을해·무인 → 창구 약 16:00~17:00 KST(오후). CSV `instantKst`는 錨点 `1995-02-04T17:00:00+09:00`. 현 lunar-js 번들은 KST 약 2/5 00:13으로 **~7.2h outlier** — `docs/jieqi-qa-automation.md` 비교 표 참고.

**1997 입춘:** 운세위키 기준 창구 약 03:50~04:00 KST; 번들은 KST 04:00. 레퍼런스 행·문서에 반영됨.

**2001 입춘:** 운세위키 창구 약 03:00~04:00 KST; 현 lunar-js 번들은 KST 11:28대로 **대량 outlier** — CSV·`docs/jieqi-qa-automation.md`에 기록, 리포트로 delta 확인.

**2024 입춘:** 위키 창구 약 17~18시 KST(저녁); 번들은 **KST 2월 5일 01:27경**으로 위키 18:00 錨点과 **~7.45h outlier**. 연도별 비교 표는 `docs/jieqi-qa-automation.md`.

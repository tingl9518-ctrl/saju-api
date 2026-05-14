# 절입 레퍼런스·수동 패치

## 파일

| 파일 | 용도 |
|------|------|
| `jieqi-reference.csv` | 국내 기준 **입춘**(및 향후 12절) 시각. 빈 `instantKst` 행은 비교·빌드에서 스킵. |
| `jieqi-reference.sample.csv` | 스키마·작성 예시. |
| `manual-overrides.sample.json` | 베이스 번들에 덮어쓸 **임시/부분 패치** 스키마 예시. |

상세 파이프라인은 `docs/jieqi-data-pipeline.md`를 참고하세요.

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

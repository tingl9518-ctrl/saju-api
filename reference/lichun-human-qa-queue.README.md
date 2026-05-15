# lichun-human-qa-queue.csv — archived

**Queue status:** `archived` (2026-05)

Tier1 lichun **blind QA 전략 종료**. 본 CSV는 **감사·재현용**으로만 보존한다.

## 왜 archived인가

- Week1 + Week2: **sampled 10, rejected 10, patch 필요 0**
- feb4 10~16 / feb5 시드 패턴은 **mismatch proxy 부적합**
- `low_priority`로 두면 “미완 백로그”로 **오해** → **archived** 권장

## 운영

- **주간 blind QA 중단** — `progress=unchecked` 잔여 행 일괄 처리하지 않음
- patch는 `docs/event-driven-sparse-override.md`의 **T1~T4 trigger**만
- `npm run export:lichun-qa-queue` — 히스토리 재생성용 **선택**; 신규 Tier1 배치 **생성하지 않음**

## 정책 문서

`docs/event-driven-sparse-override.md`

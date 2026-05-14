# 골든 케이스 (사주 엔진 회귀)

**목적:** 입력(양력/음력·시각)에 대한 **연·월·일·시** 기대값을 버전 관리하고, `npm test`로 회귀를 막는다.

## 파일

| 파일 | 설명 |
|------|------|
| `golden-cases.json` | **회귀 소스 오브 트루스.** `npm test`에서 로드·자동 비교. |
| `golden-cases.sample.json` | 동일 스키마 예시(복사용). |

## 설계·운영

전체 전략·카테고리·운세위키를 truth로 두는 방법: **`docs/saju-golden-test-strategy.md`**

절입 **데이터** CSV·리포트는 `reference/jieqi-reference.csv` 및 `docs/jieqi-qa-automation.md` — 본 폴더는 **네 기둥 end-to-end** 골든이다.

## 기여 시

1. `golden-cases.json`에 행을 추가하거나 `golden-cases.sample.json`과 동일 필드 형식을 따른다.  
2. `id`는 고유하고, `category`는 **비어 있지 않은 배열**(전략 문서 태그).  
3. 운세위키 등에서 딴 값이면 `source`·`note`를 채운다.  
4. 다른 경로의 fixture를 쓰려면 `GOLDEN_CASES_PATH`(절대 또는 cwd 기준 상대)를 설정한다.

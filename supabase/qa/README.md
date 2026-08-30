# 369 추천/후원 QA 재현 기록

## 목적

직추천 조직과 후원 배치 조직을 분리한 369 규칙이 가입 순서와 상품 구매
보너스에 정확히 적용되는지 검증한다.

- 추천보너스: 직접 추천인(`recommender_id`)에게 구매금액의 30%
- 육성보너스: 후원인(`sponsor_id`)에게 구매금액의 10%
- 엄마보너스: 육성보너스를 실제로 받은 후원인의 직접 추천인에게 해당 실제
  육성보너스와 동일한 금액
- 3, 6, 9번째 직접 추천 회원도 `recommender_id`는 바뀌지 않는다. 오직
  `sponsor_id`만 추천 상위 조직으로 올라간다.

## 사전 조건

`20260813152000_fix_369_sponsor_rollup_and_mama_bonus.sql` 마이그레이션이
적용되어 있어야 한다. 이 마이그레이션은 활성화 시점의 후원 배치와
`settle_machine_purchase` 보너스 정산 규칙을 정의한다.

## 테스트 조직

새 테스트는 아래 가입 순서로 생성한다.

1. `antz15`
2. `QAANTZ01` - `antz15`의 직접 추천
3. `QAT3A01` - `QAANTZ01`의 직접 추천
4. `QAT3A02`부터 `QAT3A11` - `QAT3A01`이 직접 추천한 10명
5. `QAT3B01`부터 `QAT3B09` - 세 번째 A 회원인 `QAT3A04`가 직접 추천한 9명

### QAT3A01 기준 10명

| 직접 추천 순번 | 회원 | 추천인 | 후원인 |
| --- | --- | --- | --- |
| 1 | QAT3A02 | QAT3A01 | QAT3A01 |
| 2 | QAT3A03 | QAT3A01 | QAT3A01 |
| 3 | QAT3A04 | QAT3A01 | QAANTZ01 |
| 4 | QAT3A05 | QAT3A01 | QAT3A01 |
| 5 | QAT3A06 | QAT3A01 | QAT3A01 |
| 6 | QAT3A07 | QAT3A01 | antz15 |
| 7 | QAT3A08 | QAT3A01 | QAT3A01 |
| 8 | QAT3A09 | QAT3A01 | QAT3A01 |
| 9 | QAT3A10 | QAT3A01 | antz15 |
| 10 | QAT3A11 | QAT3A01 | QAT3A01 |

### 세 번째 A 회원(QAT3A04) 기준 9명

| 직접 추천 순번 | 회원 | 추천인 | 후원인 |
| --- | --- | --- | --- |
| 1 | QAT3B01 | QAT3A04 | QAT3A04 |
| 2 | QAT3B02 | QAT3A04 | QAT3A04 |
| 3 | QAT3B03 | QAT3A04 | QAT3A01 |
| 4 | QAT3B04 | QAT3A04 | QAT3A04 |
| 5 | QAT3B05 | QAT3A04 | QAT3A04 |
| 6 | QAT3B06 | QAT3A04 | QAANTZ01 |
| 7 | QAT3B07 | QAT3A04 | QAT3A04 |
| 8 | QAT3B08 | QAT3A04 | QAT3A04 |
| 9 | QAT3B09 | QAT3A04 | antz15 |

## 구매 시나리오

모든 22명이 정확히 3개 상품을 구매하고, 모든 상품을 즉시 정산한다.

- 일반 회원: L1(100), L2(500), L3(1,000), 합계 1,600 USDT
- `QAT3A01`: L3 3개, 합계 3,000 USDT

`QAT3A01`은 직접 추천 매출이 많으므로 세 개의 L3 상품으로 보너스 지급
한도를 충분히 확보한다. 전체 구매는 66건, 총 36,600 USDT다.

## 검증 기대값

| 구분 | 기대 금액 |
| --- | ---: |
| 추천보너스 | 7,000 USDT |
| 육성보너스 | 3,500 USDT |
| 엄마보너스 | 2,860 USDT |

주요 수령인 보너스 합계는 다음과 같다.

| 회원 | 기대 금액 |
| --- | ---: |
| antz15 | 1,580 USDT |
| QAANTZ01 | 2,500 USDT |
| QAT3A01 | 5,440 USDT |
| QAT3A04 | 3,840 USDT |

## 실행 방법

먼저 삭제 대상만 확인한다.

```powershell
node supabase/qa/reset-and-rerun-369-qa.mjs
```

검토 후 실제 초기화, 가입, 충전, 구매, 보너스 검증을 실행한다.

```powershell
node supabase/qa/reset-and-rerun-369-qa.mjs --apply
```

스크립트는 `antz15`, `QAANTZ*`, `QAT3A*`, `QAT3B*` 형식의 독립 QA 조직에만
작동한다. 실행 전 드라이런에서 일반 회원 참조가 없는지 검사하며, 일반 회원이
테스트 조직을 참조하면 중단한다. 운영 계정에 이 패턴을 사용하지 않는다.

## 2026-08-13 실행 결과

- 기존 테스트 조직 40명, 인증 40개, 게임기 132개, 원장 832건 삭제
- 새 테스트 조직 22명 생성
- 66개 상품 모두 `bonus_settled = true` 확인
- 추천/후원 계보와 세 종류 보너스 합계가 위 기대값과 일치
- `apps/user-web`에서 `npm run lint` 완료: 오류 0건, 기존 경고 44건

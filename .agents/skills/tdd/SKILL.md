---
name: tdd
description: 새 기능이나 버그 수정을 테스트 우선(Red → Green → Refactor)으로 구현할 때 적용한다. 순수 로직(이벤트 계약, URL 정책, 카탈로그 파싱, 이력 병합)부터 테스트로 고정한다.
---

# TDD (테스트 우선 개발)

## 먼저 확인: 테스트 러너
현재 저장소에는 테스트 러너가 **없다**(`package.json`에 `test` 스크립트, jest·vitest 없음). 러너가 없으면 TDD를 실행한 것처럼 보고하지 않는다.
1. 러너 도입이 현재 작업 범위인지 사용자에게 확인한다(이슈 #16 "테스트 코드"). 승인되면 Expo 호환 조합으로 추가한다: `npx expo install jest-expo jest @types/jest`, `package.json`에 `"test": "jest"`를 둔다. 버전은 Expo SDK 공식 문서로 확인한다.
2. 도입 전이면 아래 절차에서 테스트 작성은 "작성할 테스트 목록"으로 남기고, 검증은 `npm run typecheck`와 `npx expo lint`, 수동 확인으로 대체하며 **테스트 미실행**이라고 보고한다.

## 절차
1. **Red**: 구현 전에 실패하는 테스트를 먼저 쓴다. 완료 기준을 입력 → 기대 출력 한 줄로 옮긴 것이어야 한다. 실행해서 **의도한 이유로** 실패하는지 확인한다(문법 오류로 실패한 것은 Red가 아니다).
2. **Green**: 테스트를 통과시키는 가장 작은 구현만 쓴다. 다른 동작을 미리 만들지 않는다.
3. **Refactor**: 테스트가 통과한 상태에서만 정리한다. 매 단계 뒤 전체 테스트를 다시 실행한다.
4. 버그 수정은 먼저 버그를 재현하는 실패 테스트를 쓴 뒤 고친다.
5. 완료 전에 `npm run typecheck`, `npx expo lint`, 테스트를 실행하고 결과를 보고에 적는다.

## 무엇을 테스트하나 (구조 기준)
| 위치 | 대상 | 방식 |
|---|---|---|
| `src/features/notifications/contract.ts` | `parseDeploymentEvent`: 필수 필드, 잘못된 status, 계약 밖 값 | 순수 함수, 표 형태 케이스 |
| `src/features/projects/url-policy.ts` | `isInternalUrl`, `isExternalOpenable`: 서비스 호스트, `allowedHosts`, `http:`·`javascript:`·포트 | 순수 함수 |
| `src/features/projects/catalog.ts` | `parseCatalog`: 잘못된 항목 제거, 중복 id, `allowedHosts` 검증, 전부 무효면 null | 순수 함수 |
| `src/features/notifications/history.ts` | 병합·중복 제거·50건 제한·손상된 저장값 | AsyncStorage 모의 |
| 화면·훅 | 로딩·오류·재시도·알림 탭 분기 | 컴포넌트 테스트(러너 도입 후) |
- 외부에서 오는 입력(푸시 payload, 원격 카탈로그)은 **경계값과 악의적 값**을 반드시 케이스에 넣는다.
- 네트워크, 시간, 저장소, 네이티브 모듈은 모의하고 로직은 순수 함수로 분리해 모의 없이 테스트할 수 있게 한다.

## 규칙
- 테스트 파일은 대상 옆에 `<이름>.test.ts(x)`로 둔다(예: `contract.test.ts`).
- 구현 세부가 아니라 **동작**(입력 → 출력, 호출 결과)을 검증한다. 테스트를 통과시키려고 테스트를 약하게 고치지 않는다.
- 실패하는 테스트를 건너뛰거나(`skip`) 지워서 CI를 통과시키지 않는다.
- 한 테스트는 하나의 이유로 실패해야 한다. 이름은 "상황 → 기대 결과"로 쓴다.

---
name: tdd
description: 새 기능이나 버그 수정을 테스트 우선(Red → Green → Refactor)으로 구현할 때 적용한다. 순수 로직(이벤트 계약, URL 정책, 카탈로그 파싱, 이력 병합)부터 테스트로 고정한다.
---

# TDD (테스트 우선 개발)

## 테스트 러너
**Vitest**를 쓴다(`vitest.config.ts`, `@` 별칭 = `src`, 환경 `node`, 대상 `src/**/*.test.ts`).
- 전체 실행: `npm test`(= `vitest run`), 감시 모드: `npm run test:watch`, 파일 지정: `npx vitest run src/features/projects/catalog.test.ts`.
- 순수 로직 테스트가 대상이다. React Native 런타임이 필요한 화면·훅 테스트는 아직 환경이 없으므로, 필요해지면 추가 도입 여부를 사용자에게 확인한다(로직을 순수 함수로 빼서 테스트하는 쪽을 먼저 고려).
- 네이티브·RN 모듈은 `vi.mock`으로 대체한다(예: `history.test.ts`의 AsyncStorage). 각 테스트 전에 `vi.clearAllMocks()`로 호출 기록을 초기화한다.
- CI의 `check`가 `npm test`를 실행하므로 실패하는 테스트는 병합을 막는다.

## 절차
1. **Red**: 구현 전에 실패하는 테스트를 먼저 쓴다. 완료 기준을 입력 → 기대 출력 한 줄로 옮긴 것이어야 한다. 실행해서 **의도한 이유로** 실패하는지 확인한다(문법 오류로 실패한 것은 Red가 아니다).
2. **Green**: 테스트를 통과시키는 가장 작은 구현만 쓴다. 다른 동작을 미리 만들지 않는다.
3. **Refactor**: 테스트가 통과한 상태에서만 정리한다. 매 단계 뒤 전체 테스트를 다시 실행한다.
4. 버그 수정은 먼저 버그를 재현하는 실패 테스트를 쓴 뒤 고친다.
5. 완료 전에 `npm run typecheck`, `npx expo lint`, `npm test`를 실행하고 결과를 보고에 적는다.

## 무엇을 테스트하나 (구조 기준)
| 위치 | 대상 | 방식 |
|---|---|---|
| `src/features/notifications/contract.ts` | `parseDeploymentEvent`: 필수 필드, 잘못된 status, 계약 밖 값 | 순수 함수, 표 형태 케이스 |
| `src/features/projects/url-policy.ts` | `isInternalUrl`, `isExternalOpenable`: 서비스 호스트, `allowedHosts`, `http:`·`javascript:`·포트 | 순수 함수 |
| `src/features/projects/catalog.ts` | `parseCatalog`: 잘못된 항목 제거, 중복 id, `allowedHosts` 검증, 전부 무효면 null | 순수 함수 |
| `src/features/notifications/history.ts` | 병합·중복 제거·50건 제한·손상된 저장값 | AsyncStorage 모의(`vi.mock`) |
| 화면·훅 | 로딩·오류·재시도·알림 탭 분기 | 아직 환경 없음. 분기 로직을 순수 함수로 분리해 위 방식으로 테스트 |
- 외부에서 오는 입력(푸시 payload, 원격 카탈로그)은 **경계값과 악의적 값**을 반드시 케이스에 넣는다.
- 네트워크, 시간, 저장소, 네이티브 모듈은 모의하고 로직은 순수 함수로 분리해 모의 없이 테스트할 수 있게 한다.

## 규칙
- 테스트 파일은 대상 옆에 `<이름>.test.ts(x)`로 둔다(예: `contract.test.ts`).
- 구현 세부가 아니라 **동작**(입력 → 출력, 호출 결과)을 검증한다. 테스트를 통과시키려고 테스트를 약하게 고치지 않는다.
- 실패하는 테스트를 건너뛰거나(`skip`) 지워서 CI를 통과시키지 않는다.
- 한 테스트는 하나의 이유로 실패해야 한다. 이름은 "상황 → 기대 결과"로 쓴다.

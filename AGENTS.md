# 프로젝트 공통 지침

## 제품 목표
React Native + Expo 앱에서 사이드 프로젝트를 목록으로 탐색하고 WebView로 실제 서비스를 이용한다. 별도 백오피스나 운영 대시보드는 현재 제품 범위가 아니다.

## 작업 시작
- 이 문서와 `LOOP.md`, `STATE.md`를 읽는다.
- 앱 구현은 `.agents/skills/expo-webview/SKILL.md`, JOB 발견·실행·검증·학습은 `.agents/skills/engineering-loop/SKILL.md`를 적용한다.
- 사용자 지시가 최우선이다. 기존 변경을 보존하고 현재 요청에 필요한 범위에서 진행한다.

## 구현 기준
- TypeScript와 React Native 함수 컴포넌트를 사용한다. 화면, 프로젝트 카탈로그, WebView 정책을 분리한다.
- Expo SDK와 React Native 호환성을 공식 문서로 확인하고 Expo 패키지는 `npx expo install`로 설치한다. SDK 버전을 추측하거나 React Native만 단독 업그레이드하지 않는다.
- 패키지 매니저는 기존 lockfile을 따른다. 초기 선택은 npm으로 하고 lockfile은 하나만 유지한다.
- 프로젝트 목록·기본 탐색은 네이티브, 서비스 본문은 WebView로 구현한다. 실제 서비스 URL은 확인한 값만 등록한다.
- 로딩·오류·재시도·뒤로 가기·외부 링크·접근성·safe area를 함께 고려한다.
- 비밀 키와 개인 데이터는 코드, 학습 기록, 로그에 저장하지 않는다. EXPO_PUBLIC_ 값은 공개 정보로 취급한다.

## 검증과 보고
- 실제 존재하는 package scripts만 실행한다. 앱 초기화 전에는 실행 가능한 빌드·테스트가 없다고 기록한다.
- 변경에 맞는 타입·정적 검사 및 의미 있는 동작 검증을 수행한다. iOS/Android 검증 여부를 각각 보고한다.
- 구현자의 자체 확인과 독립 검증을 구분한다. 독립 검증 없이 JOB을 완료 처리하지 않는다.
- 실행 결과, 미검증 항목, 다음 행동을 기록한다. 자율 실행의 경계와 종료 조건은 LOOP.md를 따른다.

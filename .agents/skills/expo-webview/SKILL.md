---
name: expo-webview
description: React Native + Expo 기반 WebView 허브 앱을 초기 구성하거나 화면, 의존성, 탐색 및 서비스 연결을 구현할 때 적용한다.
---

# Expo WebView 앱 구현

1. AGENTS.md와 현재 JOB의 완료 기준을 읽는다. package.json과 lockfile이 없으면 초기화 작업임을 명시한다.
2. 초기화 시 기존 문서를 보존한다. Expo 공식 템플릿과 호환 SDK를 확인하고 TypeScript로 구성한다. 라우팅은 초기화 시 선택한 방식을 일관되게 사용한다.
3. 네이티브 목록, 타입이 있는 프로젝트 카탈로그, 서비스 WebView, URL 처리 정책을 분리한다. 카탈로그는 id/name/description/icon/url을 기준으로 하고 필요 없는 필드는 강제하지 않는다.
4. WebView는 `npx expo install react-native-webview`로 설치한다. Expo Go 지원 여부와 실제 앱 빌드에서의 동작을 구분한다.
5. URL을 파싱해 검증한다. 등록된 서비스는 HTTPS를 사용하며 개발용 HTTP 예외는 명시한다. 서비스/인증 도메인과 외부 링크 정책을 정의하고 임의 javascript/file URL을 실행하지 않는다.
6. 로딩, 네트워크/HTTP 실패, 재시도, Android 웹 내부 뒤로 가기, 목록 복귀, 새 창·외부 앱 링크를 처리한다. 전체 WebView를 불필요하게 재마운트해 탐색 상태를 잃지 않도록 한다.
7. 로그인·쿠키·OAuth는 서비스 및 플랫폼별로 확인한다. 외부 브라우저와 WebView의 세션 공유를 가정하지 않는다. 필요한 OAuth는 공급자 정책을 확인한다. JS bridge는 필요할 때만 추가하고 출처와 메시지 스키마를 검증한다.
8. 실제 scripts에 따른 정적 검사와 변경 범위에 맞는 검증을 수행한다. 로그인, 리디렉션, 뒤로 가기는 iOS/Android 실제 실행 결과를 남긴다. 실행 환경이 없으면 미검증으로 보고한다.

## 공식 참고
- https://docs.expo.dev/workflow/using-libraries/
- https://docs.expo.dev/versions/latest/sdk/webview/
- https://docs.expo.dev/guides/environment-variables/
- https://github.com/react-native-webview/react-native-webview/tree/master/docs

# Android 빌드·배포

EAS Build/Submit 기준. 계정 로그인과 자격증명 등록은 사람이 직접 수행한다.

## 최초 1회
1. `npx eas-cli login`
2. `npx eas-cli init` — EAS 프로젝트를 만들고 `app.json`의 `extra.eas.projectId`를 기록한다(푸시 토큰 발급에 필요).
3. FCM v1: Firebase 프로젝트에 패키지 `com.sideprojectslabs.app` Android 앱을 등록하고 `google-services.json`을 받는다. 파일은 커밋하지 않고 EAS 파일 환경변수 `GOOGLE_SERVICES_JSON`(production/preview)으로 올린다. `app.config.ts`가 이 값을 `android.googleServicesFile`로 주입하며, production 빌드에서 누락되면 빌드가 실패한다. development 프로필에는 아직 등록하지 않아 dev 빌드에서는 푸시 토큰이 발급되지 않는다. FCM 서비스 계정 키는 `eas credentials`로 등록한다.
4. 업로드 키스토어는 `eas credentials`로 EAS가 생성·보관하게 한다. 키스토어/키 파일은 저장소에 넣지 않는다.
5. Play Console에서 앱을 만들고 첫 AAB는 수동 업로드한다. 이후 `submit:android`용 서비스 계정 키를 `eas credentials`에 등록한다.

## 프로필
| 프로필 | 산출물 | 용도 |
|---|---|---|
| development | APK(dev client) | 푸시 등 네이티브 기능 개발 검증 |
| preview | APK | 내부 테스트 배포 링크 |
| production | AAB(versionCode 자동 증가) | Play Console 내부 테스트 트랙(draft) |

## 명령
- `npm run build:android:dev|preview|prod`
- `npm run submit:android` (production 빌드를 Play 내부 테스트로 제출)
- 사전 점검: `npm run typecheck && npx expo lint && npx expo-doctor`

## GitHub Actions 릴리즈
- `.github/workflows/release-android.yml`: `android-v*` 태그 push → production 빌드 + Play 내부 테스트 제출. 수동 실행(workflow_dispatch)으로 preview/production 선택 가능.
- `.github/workflows/release-ios.yml`: iOS 전용 별도 워크플로. Apple 설정 전까지 수동 실행 골격이며 iOS 프로필은 `eas.json`에 아직 없다.
- 필요한 저장소 Secret: `EXPO_TOKEN`(expo.dev 액세스 토큰). 키스토어·Play/Apple 자격증명은 EAS가 보관하며 GitHub에 두지 않는다.
- 릴리즈 예: `git tag android-v1.0.0 && git push origin android-v1.0.0`

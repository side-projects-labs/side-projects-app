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

각 프로필은 같은 이름의 업데이트 채널에 연결된다.

## OTA 업데이트 (EAS Update)
JS·에셋만 바뀐 변경은 새 APK 설치 없이 기기에 배포한다. 앱은 실행 시 업데이트를 확인해 내려받고, **다음 실행부터** 적용된다.
- **채널**: 빌드 프로필 이름과 같다(`development`·`preview`·`production`, `eas.json`의 `channel`). 빌드는 자기 채널의 업데이트만 받는다.
- **runtimeVersion**: `appVersion` 정책이라 `app.json`의 `version`이 같은 빌드에만 업데이트가 간다. 네이티브 코드·권한·플러그인·SDK가 바뀌면 `version`을 올리고 새 빌드를 설치한다. 그렇지 않으면 업데이트를 받은 앱이 네이티브와 맞지 않아 크래시할 수 있다.
- **배포**: Actions → **Update Android (OTA)** → 채널 선택, 또는 `npx eas-cli update --channel preview --platform android --message "설명"`. 워크플로는 타입·lint·테스트를 통과해야 올린다.
- **적용 확인**: 목록 화면 ℹ️ → **앱 정보**(앱 업데이트 정보)에서 실행 중인 코드(빌드 포함본 / OTA), 채널, 런타임 버전, 업데이트 ID(앞 8자)와 게시 시각(UTC)을 본다. OTA를 받은 앱은 '실행 중인 코드'가 *OTA 업데이트*로 바뀌고 ID가 `eas update:list` 결과의 것과 맞는다. 
- **적용 안내**: 새 업데이트를 내려받으면 화면 하단에 "새 버전이 준비됐어요"와 **다시 시작**·**나중에**가 뜬다. 다시 시작을 누르면 바로 적용되고, 나중에를 누르면 같은 업데이트는 다시 묻지 않는다(더 새 업데이트가 오면 다시 뜬다). 개발 모드에서는 뜨지 않는다. 내려받기는 앱 실행 시와, 앱이 백그라운드에서 돌아올 때(마지막 확인 후 10분 이상 지난 경우) 일어난다.
- **되돌리기**: 문제가 있으면 `eas update:rollback` 또는 이전 커밋으로 다시 업데이트한다.
- **최초 1회**: OTA를 처음 켠 이번 빌드부터 적용된다. `expo-updates`가 없던 이전 APK는 업데이트를 받지 못하므로 **새 preview 빌드를 한 번 설치**해야 한다.
- **비용**: Free 플랜은 월간 활성 사용자(업데이트를 내려받은 기기) 1,000명까지다. 본인 기기만 쓰는 동안은 한도에 닿지 않는다. 정책은 바뀔 수 있으니 [Expo 요금 페이지](https://expo.dev/pricing)에서 확인한다.

## 앱 잠금 (생체 인증)
ℹ️ **앱 정보**에서 "앱 잠금"을 켜면 앱을 열 때와, 다른 앱을 30초 넘게 쓰다 돌아올 때 지문·얼굴·기기 비밀번호로 확인한다. 켜기·끄기 모두 인증이 필요하다. 설정은 기기에만 저장(`app-lock-v1`)한다.
- 기기에 화면 잠금(생체·PIN·패턴)이 없으면 켤 수 없고, 켠 뒤 잠금 수단이 사라지면 잠금을 자동으로 끄고 열어 준다(앱에서 쫓겨나지 않게).
- 네이티브 모듈(`expo-local-authentication`)이 들어 있어 **새 APK가 필요**하다. `app.json`의 `version`을 `1.1.0`으로 올려 runtime을 분리했고, 따라서 이전 APK(`1.0.0`)는 이 코드를 OTA로 받지 않는다. 이전 APK에는 `1.0.0` OTA를 계속 올릴 수 있다.
- 한계: 안드로이드 최근 앱 목록에 보이는 화면 미리보기는 가리지 않는다.

## 명령
- `npm run build:android:dev|preview|prod`
- `npm run submit:android` (production 빌드를 Play 내부 테스트로 제출)
- 사전 점검: `npm run typecheck && npx expo lint && npx expo-doctor`

## GitHub Actions 릴리즈
- `.github/workflows/ci.yml`: PR과 master push마다 typecheck, lint, expo-doctor를 실행한다(EAS 빌드는 포함하지 않는다).
- `.github/workflows/release-android.yml`: `android-v*` 태그 push → production 빌드 + Play 내부 테스트 제출. 수동 실행(workflow_dispatch)으로 preview/production 선택 가능.
- `.github/workflows/update-android.yml`: 수동 실행으로 OTA 업데이트를 채널에 게시한다(위 OTA 절).
- `.github/workflows/release-ios.yml`: iOS 전용 별도 워크플로. Apple 설정 전까지 수동 실행 골격이며 iOS 프로필은 `eas.json`에 아직 없다.
- 필요한 저장소 Secret: `EXPO_TOKEN`(expo.dev 액세스 토큰). 키스토어·Play/Apple 자격증명은 EAS가 보관하며 GitHub에 두지 않는다.
- 릴리즈 예: `git tag android-v1.0.0 && git push origin android-v1.0.0`

# side-projects-app
React Native + Expo app for browsing and using side projects through WebView.

## 현재 구현
2026-11-23 기준으로 구현된 것입니다. 자세한 상태와 후보 작업은 [STATE.md](STATE.md)에 있습니다.

- 프로젝트 목록 탐색과 WebView 보기: 이어서 보기, 고정·순서 변경, 상태 표시, 하단 툴바, 프로젝트별 로그인 초기화
- 원격 카탈로그와 조직 저장소 기반 동기화: [docs/catalog.md](docs/catalog.md)
- 배포 푸시 알림과 배포 이력(알림 수신 + GitHub 배포 기록 보충): [docs/deployment-notifications.md](docs/deployment-notifications.md)
- 생체 인증 앱 잠금, 앱 정보 화면과 업데이트 안내(EAS Update OTA), 다크 모드: [docs/android-release.md](docs/android-release.md)

Android는 EAS preview 빌드를 직접 설치해 씁니다. Play 내부 테스트 배포(#23)와 iOS 지원(#22)은 아직 없습니다. 자율 루프의 실행기(스케줄러·JOB 저장소)는 구현하지 않았습니다([LOOP.md](LOOP.md)).

## 개발
```bash
npm install
npm start            # Expo 개발 서버
npm run typecheck    # 타입 체크
npm run lint         # lint (expo lint)
npm test             # Vitest
```

PR의 CI(`check`)는 타입 체크, lint, 테스트와 리뷰 게이트를 실행합니다. 병합 조건은 [docs/review-gate.md](docs/review-gate.md)를 따릅니다.

## 개발 지침

- [공통 지침](AGENTS.md)
- [자율 학습 기반 엔지니어링 루프 설계](LOOP.md)
- [작업 큐 및 학습 상태](STATE.md)
- [Expo WebView 구현 스킬](.agents/skills/expo-webview/SKILL.md)
- [JOB 실행·검증·학습 스킬](.agents/skills/engineering-loop/SKILL.md)

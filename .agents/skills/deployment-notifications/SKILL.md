---
name: deployment-notifications
description: 사이드 프로젝트 레포의 배포 시작·성공·실패를 앱 푸시로 연결하거나, 재사용 워크플로(notify-deployment.yml)를 수정하고 호출 레포를 갱신하거나, 알림이 오지 않는 원인을 조사할 때 적용한다.
---

# 배포 알림 연결

원본 문서는 `docs/deployment-notifications.md`다. 이 스킬은 작업 순서와 이미 겪은 함정을 정리한다.

## 연결 방식 고르기
1. 대상 레포의 배포 주체를 먼저 확인한다(`gh api repos/<org>/<repo>/deployments`의 creator, `.github/workflows`).
2. **Actions가 직접 배포**(예: portfolio-admin): 배포 워크플로에 알림 job을 추가한다. 시작·성공·실패를 모두 보낼 수 있다.
   - `notify-start`는 배포 전제 job만 `needs`로 걸고 `deploy`와 병렬로 둔다.
   - `notify-result`는 `needs: deploy`, `if: always() && (result == 'success' || 'failure')`로 취소·skip을 성공으로 알리지 않는다.
   - 알림 job을 배포의 `needs`로 걸지 않는다. 알림 때문에 배포가 막히면 안 된다.
3. **Vercel Git 연동이 배포**(예: jobs-scrap-dashboard, Dreamweaver-AI, stock-ai-platform): `on: deployment_status` 워크플로를 추가한다.
   - Vercel은 완료 상태(`success`/`failure`/`error`)만 보고하므로 **시작 알림은 보낼 수 없다**.
   - `startsWith(github.event.deployment.environment, 'Production')`일 때만 호출한다(Preview 제외).
   - `deployment_status` 워크플로는 기본 브랜치에 있어야 동작한다.
   - `log_url`/`target_url`은 빌드 로그가 아니라 배포 `*.vercel.app` 주소다. 알림 탭 이동에 쓰지 않는다.
   - 이 방식을 쓰는 레포에 Actions 배포 알림을 함께 넣으면 알림이 중복된다.

## 호출 규칙
- 재사용 워크플로는 커밋 SHA로 고정한다: `uses: side-projects-labs/side-projects-app/.github/workflows/notify-deployment.yml@<SHA>`. 브랜치(`@master`)로 두지 않는다.
- `project-id`는 카탈로그 `id`(= 레포 이름)와 **정확히 같아야** 한다. 다르면 알림은 오지만 탭해도 이동하지 않는다.
- 재사용 워크플로를 바꾸면 master에 머지한 뒤 **호출하는 레포 모두의 SHA를 새 커밋으로 올리는 PR**을 만든다. 머지 전 SHA를 쓰지 않는다.
- 재사용 워크플로는 알림이 실패해도 항상 성공으로 끝나고 경고만 남긴다. 이 성질을 깨는 변경을 하지 않는다.

## 시크릿
- `EXPO_PUSH_TOKENS`(이름 끝의 **S** 주의, 단수형 `EXPO_PUSH_TOKEN`은 동작하지 않는다)는 조직 시크릿이다. 값은 쉼표로 구분한 `ExponentPushToken[...]` 목록이다.
- 시크릿 값은 사람이 등록한다: `gh secret set EXPO_PUSH_TOKENS --org side-projects-labs --visibility all`(`admin:org` 권한 필요). 값은 코드·이슈·로그에 남기지 않는다.
- 시크릿을 등록·수정한 뒤에는 **새 실행**이 필요하다. 실패한 job만 다시 돌리면(`gh run rerun --failed`) 이전 시크릿 평가가 그대로 쓰여 같은 오류가 난다.
- 앱 재설치 등으로 토큰이 바뀌면 `DeviceNotRegistered`가 나온다. 앱 🔔 화면에서 새 토큰을 복사해 시크릿을 갱신한다.

## 검증
- 수동 시험: `gh workflow run notify-test.yml -f project-id=<id> -f status=<started|succeeded|failed>`. 프로젝트를 추가하면 `notify-test.yml`의 options도 갱신한다.
- Expo ticket 수락(`accepted=1 error=0`)은 **기기 수신 확인이 아니다.** 실제 수신은 기기에서 확인한다.
- 실제 배포로 확인할 것: 시작·성공·실패 도착, 중복 없음, Preview 미발송, 알림 job 실패가 배포에 영향 없음.

## 다른 레포를 수정할 때
- 레포마다 별도 PR을 만들고 머지는 담당자가 확인한다. 머지하면 그 레포의 Production 배포가 일어날 수 있으니 미리 알린다.
- 병합 전 CI(해당 레포에 있는 것)와 mergeable 상태를 확인한다.

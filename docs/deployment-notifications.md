# 배포 푸시 알림 (이슈 #2, 1단계: 서버 없이 GitHub Actions → Expo)

대상 프로젝트의 배포 시작·성공·실패를 앱에서 푸시로 받는다. 서버 없이 재사용 워크플로가 Expo 푸시 API를 직접 호출한다.

## 구조
1. 각 프로젝트의 배포 워크플로가 `notify-deployment.yml`(이 저장소의 재사용 워크플로)을 호출한다.
2. 재사용 워크플로가 이벤트(`version=1`: `eventId`, `projectId`, `status`)를 만들어 Expo 푸시 API로 보낸다.
3. 앱은 알림을 받고, 탭하면 `projectId`에 해당하는 WebView로 이동한다.

`projectId`는 카탈로그(`catalog/projects.json`)의 `id`(= 레포 이름)와 같아야 한다. 다르면 알림은 오지만 탭해도 이동하지 않는다.

## 알림 탭 시 이동
상태와 관계없이 알림을 탭하면 해당 프로젝트 화면(WebView)을 연다. 알림은 **어느 프로젝트에서 무슨 일이 났는지**(제목: 시작·완료·실패, 본문: 프로젝트)만 알려주고, 빌드 로그 등은 사용자가 직접 GitHub·Vercel에서 확인한다. 로그 페이지를 자동으로 여는 기능은 두지 않는다(Vercel Git 연동이 보고하는 `log_url`이 빌드 로그가 아니라 배포 주소라 쓸 수 없었다).

## 알림 본문과 배포 이력
- 본문은 `프로젝트 · 상세` 형식이다. 상세가 40자 커밋 해시(Vercel Git 연동의 `deployment.ref`)면 7자로 줄여 보낸다.
- 앱 목록 화면의 🕘 → **배포 이력**에서 이 기기가 받은 배포 알림을 최근 50건까지 본다. 항목을 탭하면 해당 프로젝트가 열린다.
- 상태(시작·완료·실패)와 프로젝트(이력에 나온 것만)로 걸러 볼 수 있다. 항목 오른쪽 ✕로 한 건을 지운다. 지운 항목과 "기록 지우기"로 지운 항목(알림 센터에만 남아 있던 알림 포함)의 id는 기기에 기억(`deleted-event-ids-v1`, 최근 200개)해, 앱을 다시 열 때 알림 센터에서 되살아나지 않게 한다.
- 이력은 기기에만 저장한다(서버 없음). 앱 실행 중 수신, 알림 탭, 앱이 열릴 때 알림 센터에 남아 있던 알림을 기록한다. 같은 `eventId`는 한 건으로 합친다.
- 앱이 꺼진 동안 도착해 알림 센터에서 지워진 알림은 위 방법으로는 남지 않는다. 그래서 앱이 열리거나 활성화될 때 **GitHub Deployments의 공개 기록**을 읽어 이력을 보충한다.
  - 대상은 카탈로그에 `repo`가 있는 프로젝트의 최근 Production 배포 5건이다. 토큰 없이 읽을 수 있는 공개 저장소만 가능하다(앱에 비밀 값을 두지 않는다). 비공개 저장소는 보충되지 않는다.
  - 배포가 끝난 상태(성공·실패·오류)만 이력이 된다. 진행 중이거나 Preview 배포는 제외한다.
  - GitHub Deployments에 기록되지 않는 배포는 보충되지 않는다. 예를 들어 Actions에서 직접 배포하는 `portfolio-admin`의 최근 배포는 이 방법으로 읽히지 않고, 알림으로 받은 것만 남는다(2026-11-23 기준 마지막 기록은 11/16).
  - `eventId`는 알림과 같은 규칙(`<레포>-deployment-<id>-<상태>`)이라 알림으로 받은 배포와 한 건으로 합쳐진다. Actions 실행 기준 알림(`portfolio-admin` 등)은 eventId가 달라 같은 프로젝트·상태가 15분 안에 이미 있으면 같은 배포로 본다.
  - 비인증 요청은 시간당 60회로 제한된다. 처음 한 번은 저장소 6개 기준 약 36회를 쓰고, 이후에는 15분 간격으로 저장소당 목록 1회만 조회한다. 확정된 배포의 상태는 기기에 기억(`deployment-sync-v1`, 최근 200건)해 다시 조회하지 않는다. 요청 한도(429, 또는 남은 횟수 0·재시도 대기가 있는 403)나 네트워크 오류로 막히면 그 시점까지의 결과만 반영하고, 앱은 그대로 동작하며 다음 간격에 다시 시도한다. 접근 차단 같은 한도 외의 403은 그 저장소만 건너뛴다.
  - 사용자가 지운 항목은 위와 같은 방식으로 기억해 다시 되살아나지 않는다. "기록 지우기"는 동기화로 알게 된 배포의 id도 함께 기억해, 이력이 50건으로 잘려 저장되지 못했던 항목도 지운 뒤 되살아나지 않는다.

## 최초 설정
1. **개발/preview 빌드 설치**: FCM 설정(`GOOGLE_SERVICES_JSON`)이 들어간 빌드여야 토큰이 발급된다. Expo Go와 에뮬레이터는 불가.
2. 앱 목록 화면의 🔔 → **토큰 복사**. 토큰은 `ExponentPushToken[...]` 형식이다.
3. GitHub Secret 등록. 여러 레포에서 쓰므로 **조직 시크릿**을 권장한다.
   - 이름 `EXPO_PUSH_TOKENS`, 값은 쉼표로 구분한 토큰 목록(기기가 여러 대면 모두 나열).
   - 조직 시크릿의 레포 접근 범위에 알림을 붙일 레포를 포함한다.
   - Expo 푸시 보안(Enhanced Security)을 켰다면 `EXPO_ACCESS_TOKEN`도 등록한다.

토큰을 아는 사람은 해당 기기로 알림을 보낼 수 있다. 저장소 코드, 이슈, 로그에 남기지 않는다(워크플로는 로그에서 토큰을 마스킹한다).

## 수동 시험 발송
Actions 탭 → **Notify test** → *Run workflow*에서 프로젝트와 상태를 골라 실행한다. 이 저장소에 `EXPO_PUSH_TOKENS` 시크릿이 있어야 한다. 프로젝트 선택지는 `catalog/projects.json`의 id와 같게 유지한다(카탈로그에 프로젝트를 추가하면 `notify-test.yml`의 options도 갱신).
CLI: `gh workflow run notify-test.yml -f project-id=portfolio-admin -f status=succeeded`

## 호출하는 쪽 워크플로 예시
```yaml
jobs:
  notify-start:
    uses: side-projects-labs/side-projects-app/.github/workflows/notify-deployment.yml@<커밋 SHA>
    with:
      project-id: portfolio-admin
      status: started
      detail: ${{ github.ref_name }}
    secrets: inherit   # 조직 시크릿 사용 시

  deploy:
    # 알림 job을 needs로 걸지 않는다. 알림 때문에 배포가 막히면 안 된다.
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh

  notify-result:
    needs: deploy
    # 성공/실패만 알린다. 취소·skip은 알리지 않는다(성공으로 오인 방지).
    if: ${{ always() && (needs.deploy.result == 'success' || needs.deploy.result == 'failure') }}
    uses: side-projects-labs/side-projects-app/.github/workflows/notify-deployment.yml@<커밋 SHA>
    with:
      project-id: portfolio-admin
      status: ${{ needs.deploy.result == 'success' && 'succeeded' || 'failed' }}
      detail: ${{ github.ref_name }}
    secrets: inherit
```
- `@<커밋 SHA>`는 이 저장소에서 확인한 커밋으로 고정한다. 브랜치명(`@master`)으로 두면 변경이 즉시 전파된다.
- 재사용 워크플로는 알림이 실패해도(`토큰 오류`, `Expo 장애`, `네트워크`) **항상 성공으로 끝나고** 경고 주석만 남긴다. 배포 결과에는 영향이 없다.

## 알림 소리와 채널
- 알림은 기본 소리(`sound: default`)로 발송하고, 앱을 켠 상태에서도 소리가 난다.
- Android 알림 채널은 한번 만들어지면 앱이 소리·중요도를 바꿀 수 없다. 설정을 바꿔야 하면 `src/features/notifications/setup.ts`의 채널 ID를 올리고(`deployments-v2` → `v3`) 이전 ID를 `LEGACY_CHANNELS`에 넣는다. 발송 워크플로의 `channelId`도 같은 값으로 맞춘다.
- 소리가 나는지는 폰의 무음·방해 금지 모드와 알림 설정(채널별 소리)에도 영향을 받는다.

## 한계와 주의
- Expo **ticket 수락은 기기 수신 확인이 아니다.** 실제 수신은 기기에서 확인해야 한다(receipt 조회는 2단계 서버).
- 토큰은 앱 재설치·데이터 삭제 시 바뀔 수 있다. `DeviceNotRegistered` 경고가 나오면 앱에서 새 토큰을 복사해 Secret을 갱신한다.
- 토큰을 수동 등록하므로 기기 구독 관리, 중복 방지, 재시도 큐는 없다. 2단계(독립 알림 서버)에서 다룬다.
- 같은 이벤트가 재실행되면 알림이 다시 간다. `eventId`는 `레포-run id-시도-상태`로 만들어 클라이언트가 구분할 수 있게 한다.

## 검증 상태 (2026-11-19)
- 발송 스크립트: 로컬 모의 서버로 정상/부분 오류/HTTP 500/연결 실패/인증 헤더를 확인했다(모두 exit 0).
- `EXPO_PUSH_TOKENS`는 **조직 시크릿**(`side-projects-labs`)으로 등록했다. 새 레포는 접근 범위만 확인하면 된다.
- portfolio-admin: 실제 master 배포로 시작·성공 알림이 기기에 도착했다(포그라운드 수신 확인).
- jobs-scrap-dashboard, Dreamweaver-AI, stock-ai-platform: 실제 Production 배포로 `deployment_status` 워크플로가 실행되고 Expo ticket이 수락됐다(`accepted=1 error=0`). 배포 한 건당 알림 실행은 한 번이라 중복은 관찰되지 않았다. Preview 배포는 skip된다.
- 미검증: **실패 알림 전 구간**, 3개 레포의 기기 수신, 백그라운드·종료 상태 수신, 알림 탭 이동(새 앱 빌드 필요).

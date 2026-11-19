# 배포 푸시 알림 (이슈 #2, 1단계: 서버 없이 GitHub Actions → Expo)

대상 프로젝트의 배포 시작·성공·실패를 앱에서 푸시로 받는다. 서버 없이 재사용 워크플로가 Expo 푸시 API를 직접 호출한다.

## 구조
1. 각 프로젝트의 배포 워크플로가 `notify-deployment.yml`(이 저장소의 재사용 워크플로)을 호출한다.
2. 재사용 워크플로가 이벤트(`version=1`: `eventId`, `projectId`, `status`)를 만들어 Expo 푸시 API로 보낸다.
3. 앱은 알림을 받고, 탭하면 `projectId`에 해당하는 WebView로 이동한다.

`projectId`는 카탈로그(`catalog/projects.json`)의 `id`(= 레포 이름)와 같아야 한다. 다르면 알림은 오지만 탭해도 이동하지 않는다.

## 알림 탭 시 이동
| 상태 | 이동 |
|---|---|
| `failed` | 장애난 빌드 로그 페이지(`data.url`)를 기기 브라우저로 연다 |
| `started` | 진행 중인 빌드 페이지(`data.url`)를 기기 브라우저로 연다 |
| `succeeded` | 해당 프로젝트 WebView(현재 완료 페이지)를 연다 |

- `url`은 재사용 워크플로의 선택 입력이다. 비우면 호출한 워크플로 run 페이지(`.../actions/runs/<id>`)를 쓴다. Vercel Git 연동(`deployment_status`)을 쓰는 레포는 `github.event.deployment_status.log_url`을 넘긴다.
- 앱은 `https`이며 호스트가 `github.com`·`vercel.com`인 URL만 연다. 그 외나 `url`이 없으면 프로젝트 화면으로 이동한다.
- 이 변경은 앱 빌드에 포함되므로 새 빌드를 설치해야 동작한다. 이전 앱은 `url`을 무시하고 프로젝트 화면을 연다.

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

## 검증 상태
- 발송 스크립트: 로컬 모의 서버로 정상/부분 오류/HTTP 500/연결 실패/인증 헤더를 확인했다(모두 exit 0).
- 미검증: 실제 Expo 푸시 전송, 기기 수신(포그라운드·백그라운드·종료), 알림 탭 이동, 다른 레포 워크플로 연결.

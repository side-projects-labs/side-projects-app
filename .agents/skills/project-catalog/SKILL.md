---
name: project-catalog
description: 허브 앱 카탈로그(catalog/projects.json)에 사이드 프로젝트를 추가·수정·제거하거나, 소셜 로그인 호스트(allowedHosts)와 알림 연동을 함께 정리할 때 적용한다.
---

# 프로젝트 카탈로그 관리

목록의 원본은 `catalog/projects.json`이고 형식은 `docs/catalog.md`를 따른다. 앱은 master의 raw 파일을 받아 쓰므로 **JSON 변경은 앱 재빌드 없이** 반영된다(단, 앱 코드가 해석하는 새 필드는 새 빌드가 필요하다).

## 프로젝트 추가 순서
1. **서비스 URL을 실제로 확인한다.** 응답하는 HTTPS 주소만 넣는다. 레포 homepage 값은 오래됐을 수 있다. URL을 모르면 추측하지 말고 확인을 요청한다.
2. `id`는 레포 이름과 같게 한다(푸시 이벤트의 `projectId`와 매칭, 중복 불가). `repo`는 `side-projects-labs/<레포>`.
3. 로그인 방식을 확인한다. 소셜 로그인(GitHub·Google 등)이 있으면 로그인 도중 거치는 호스트를 `allowedHosts`에 넣는다.
   - 인증 시작·콜백 API 호스트와 공급자 호스트(`github.com`, `accounts.google.com` 등)가 대상이다.
   - 호스트 이름만 쓴다(HTTPS 전용, 와일드카드·포트·경로 불가, 최대 10개).
   - 목록에 없는 호스트는 기기 브라우저로 열리고, 브라우저와 WebView는 세션을 공유하지 않아 로그인이 유지되지 않는다.
   - Google은 임베디드 WebView OAuth를 막는 정책(`disallowed_useragent`)이 있어 허용해도 거부될 수 있다. 기기에서 확인한다.
4. 알림이 필요하면 `deployment-notifications` 스킬로 레포를 연결하고, `.github/workflows/notify-test.yml`의 `project-id` options에 같은 id를 추가한다.
5. 검증 실패 항목은 앱이 건너뛰므로(전체 실패 시 원격본 폐기), JSON 문법과 필수 필드(`id`, `name`, `description`, `icon`, `url`)를 확인한다. `npx tsc --noEmit`, `npx expo lint`를 실행한다.
6. master에 병합하면 목록이 바뀐다. master 쓰기 권한이 곧 앱의 노출 범위이므로 PR 리뷰를 거친다.

## 제거·수정
- 제거하면 해당 프로젝트의 알림은 탭해도 이동하지 않는다. 알림 연동과 `notify-test.yml` options도 함께 정리한다.
- `url`을 바꿀 때는 새 주소를 다시 확인하고 `allowedHosts`도 점검한다.

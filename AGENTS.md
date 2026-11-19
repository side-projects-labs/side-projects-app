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

## 운영 지침
- 배포 알림 연결·수정은 `.agents/skills/deployment-notifications/SKILL.md`, 카탈로그 변경은 `.agents/skills/project-catalog/SKILL.md`를 적용한다.
- 브랜치는 `feat|fix|docs|ci/<이슈번호>-<설명>` 형식을 쓰고 커밋·PR 본문에 `Refs #<이슈번호>`를 남긴다. PR 병합은 담당자의 지시가 있을 때만 하고, 병합 전 CI와 mergeable 상태를 확인한다.
- 다른 조직 레포를 수정할 때는 레포별 PR로 진행한다. 병합 시 Production 배포가 일어날 수 있으니 먼저 알린다.
- 시크릿·토큰 값은 사람이 등록한다. 에이전트는 값을 읽거나 저장소·이슈·로그에 남기지 않고 등록 방법만 안내한다. 조직 시크릿 권한(`admin:org`)이 없으면 직접 조회하지 못한다.
- 앱 빌드는 EAS를 쓴다(`Release Android` 워크플로, preview는 `gh workflow run "Release Android" -f profile=preview`). 비용이 드는 작업이라 사용자가 요청할 때만 시작한다. GitHub Actions의 `EXPO_TOKEN` 로봇은 환경변수를 읽도록 **Developer 이상 역할**이어야 한다.
- 현재 `expo-updates`가 없어 JS만 바뀌어도 새 APK를 설치해야 반영된다. 여러 변경을 모아 빌드할지 사용자에게 확인한다.
- 알림 문구·동작 변경 시 앱 코드(`src/features/notifications`)와 재사용 워크플로, 이를 호출하는 레포의 SHA를 함께 점검한다.

<!-- portfolio-hub:project-guidance:start -->
## 포트폴리오 문서 입력 계약

- 기본 브랜치 루트 PROJECT.md를 프로젝트 소개의 원본으로 유지합니다. 프로젝트 초안 작업에서 이 저장소의 AI가 아래 규격으로 생성하고 내용 변경 시 함께 갱신합니다. Hub는 내용을 AI로 다시 생성하지 않고 검증한 필드를 그대로 전송합니다.
- PROJECT.md는 첫 번째 JSON 코드 블록에 아래 메타데이터를 작성하고, 블록 뒤 빈 줄 다음에 마크다운 본문을 작성합니다. 본문의 제목·목차·내용 구성은 자유입니다.

```json
{
  "schemaVersion": 1,
  "slug": "project-slug",
  "title": "프로젝트 제목",
  "description": "프로젝트 설명",
  "stacks": ["TypeScript"],
  "image": "https://example.com/public-project.png",
  "linkDemo": null,
  "linkGithub": null
}
```

- schemaVersion, slug, title, description, stacks는 필수입니다. slug는 기존 프로젝트 식별자로 유지하며 변경하면 다른 프로젝트가 생성될 수 있습니다. stacks는 문자열 배열입니다. JSON에 계약 밖 필드를 추가하지 않습니다.
- image는 선택적인 공개 HTTP(S) 이미지 URL입니다. URL이 제공된 경우에만 기존 이미지를 교체합니다. 생략/null/빈 문자열이면 기존 이미지를 유지하며, 신규 프로젝트는 이미지 없이 생성합니다. 로컬 파일 경로·비공개 GitHub 원본 URL·자격 증명이 필요한 URL을 넣지 않습니다.
- 대표 이미지 파일을 저장소에 보관할 때는 루트 PROJECT.png를 사용합니다. 적절한 배포 화면이 있으면 활용하고 없으면 이 저장소에서 생성형 썸네일을 준비합니다. 필요한 경우 갱신하며 일반 코드 변경마다 재생성하지 않습니다.
- 공개 이미지 업로드와 공개 URL 준비는 이 저장소가 담당합니다. Hub는 이미지 파일을 읽거나 업로드하지 않습니다. 도구를 사용할 수 없거나 URL을 제공하지 못하면 image를 생략할 수 있습니다.
- linkDemo와 linkGithub는 선택적인 HTTP(S) 링크이며 생략/null/빈 문자열이면 기존 링크 값을 지웁니다. JSON 뒤 마크다운 전체를 API의 content로 사용하므로 중복 생성하지 않습니다.
- 이 규격 문서가 있으면 Hub가 프로젝트를 생성·업데이트하며 즉시 공개하고 관리자 편집 내용도 교체합니다. 공개 가능한 소개만 작성하고 비밀값·내부 정보는 넣지 않습니다. 이 지침은 다른 비공개 파일을 공개할 권한을 부여하지 않습니다.
- 기존 프로젝트 규칙과 함께 적용하며 충돌은 담당자에게 확인합니다. Hub는 이 구간 밖의 기존 규칙과 원본 PROJECT.md를 변경하지 않습니다. 지침 PR은 담당자가 직접 머지합니다.
<!-- portfolio-hub:project-guidance:end -->

# Copilot Instructions

이 저장소의 에이전트 지침 원본은 루트의 `AGENTS.md`입니다. 작업 전에 `AGENTS.md`, `LOOP.md`, `STATE.md`를 읽고 따릅니다.

필수 규칙 요약 (상세 절차는 `.agents/skills/<name>/SKILL.md`):

- 코드 수정은 `tdd` 스킬로 합니다. 실패하는 테스트(Vitest, `npm test`)를 먼저 쓰고 의도한 이유로 실패하는 것을 확인한 뒤 구현합니다. 로직은 React와 네이티브 모듈 없이 동작하는 순수 함수로 분리합니다.
- 패키지 매니저는 npm이고 lockfile은 하나만 둡니다. Expo 패키지는 `npx expo install`로 추가합니다. 완료 전에 `npm run typecheck`, `npx expo lint`, `npm test`를 실행하고 결과를 보고합니다.
- 푸시 `data`, 원격 카탈로그, WebView가 요청하는 URL은 신뢰할 수 없는 입력이라 사용 전에 파싱·검증하고 허용 목록 방식을 씁니다.
- 브랜치는 `feat|fix|docs|ci/<이슈번호>-<설명>` 형식입니다. 커밋과 PR 본문에 `Refs #<이슈번호>`를 남기고 `Fixes`, `Closes`는 쓰지 않습니다.
- PR 본문은 `.github/pull_request_template.md`, 이슈 본문은 `.github/ISSUE_TEMPLATE.md`의 절을 모두 채웁니다. `gh pr create`와 `gh issue create`를 `--body`나 `--body-file`로 쓸 때는 템플릿이 자동으로 채워지지 않으므로 파일을 읽어 옮겨 적습니다.
- 이슈를 만들거나 닫으면 `STATE.md`의 후보 큐도 이슈 번호로 대응해 함께 갱신합니다.
- PR을 올리면 `code-review` 스킬 기준으로 직접 리뷰하고 `bash .github/scripts/post-review.sh <번호> <파일>`로 남깁니다. 치명·중요 지적이 있거나 최신 커밋의 리뷰가 없으면 CI `check`의 리뷰 게이트가 병합을 막습니다.
- 병합은 담당자의 지시가 있을 때만 하고, 병합 전에 CI와 mergeable 상태를 확인합니다.
- 시크릿과 토큰 값은 사람이 등록합니다. 값을 읽거나 저장소, 이슈, 로그에 남기지 않고 등록 방법만 안내합니다.
- EAS 빌드는 비용이 드는 작업이라 사용자가 요청할 때만 시작합니다. JS·에셋만 바뀐 변경은 `Update Android (OTA)`로 배포할 수 있습니다.
- 알림 문구나 동작을 바꾸면 앱 코드와 재사용 워크플로, 이를 호출하는 레포의 SHA를 함께 점검합니다.

이 파일과 `AGENTS.md`가 다르면 `AGENTS.md`를 따릅니다.

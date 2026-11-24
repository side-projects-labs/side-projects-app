#!/usr/bin/env bash
# 동기화된 catalog/projects.json 변경을 갱신 브랜치로 올려 PR을 만들거나 갱신하고, 안전한 변경이면 자동 병합을 예약한다.
# 워크플로(.github/workflows/sync-catalog.yml)가 `npm run sync:catalog`로 작업 트리의 카탈로그를 갱신한 뒤 호출한다.
#
# 입력(환경변수)
#   ISSUE_NUMBER             필수. 알림 이슈 번호. 갱신 브랜치 이름(ci/<번호>-catalog-sync)과 `Refs #`에 쓴다
#   GH_TOKEN                 gh용 토큰. CI(check)가 실행되도록 기본 토큰이 아니라 전용 토큰을 쓴다
#   BASE_BRANCH, GIT_REMOTE  기본 master, origin
#   POST_REVIEW_SCRIPT       기본 .github/scripts/post-review.sh (시험에서 바꾼다)
#   CATALOG_AUTO_MERGE_CLI   기본 scripts/catalog-auto-merge.mjs (시험에서 바꾼다)
#
# 흐름: 차이 없음 → 종료 / 갱신 브랜치 커밋·푸시 / PR 만들기·갱신 / 자동 병합 판정
#   판정 통과 → 승인 리뷰(post-review.sh로 리뷰 게시 + check 재실행) → `gh pr merge --auto`
#   판정 실패 → 사유를 PR 코멘트로 남기고 사람이 검토하도록 둔다(병합하지 않는다)
# 같은 내용의 갱신 브랜치가 이미 있으면 다시 푸시하지 않는다(매일 새 커밋이 생겨 리뷰가 무효가 되는 것을 막는다).
set -euo pipefail

ISSUE="${ISSUE_NUMBER:-}"
[ -n "$ISSUE" ] || { echo "ISSUE_NUMBER가 필요합니다." >&2; exit 1; }
BASE="${BASE_BRANCH:-master}"
REMOTE="${GIT_REMOTE:-origin}"
POST_REVIEW="${POST_REVIEW_SCRIPT:-.github/scripts/post-review.sh}"
CLI="${CATALOG_AUTO_MERGE_CLI:-scripts/catalog-auto-merge.mjs}"
BRANCH="ci/${ISSUE}-catalog-sync"
FILE="catalog/projects.json"
TITLE="chore(catalog): 조직 저장소 목록과 카탈로그를 동기화한다"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if git diff --quiet -- "$FILE"; then
  echo "카탈로그에 차이가 없어 PR을 만들지 않습니다."
  exit 0
fi

git fetch -q "$REMOTE" "$BASE"

# 같은 내용의 갱신 브랜치가 이미 있는지 확인한다.
SAME=0
if git fetch -q "$REMOTE" "$BRANCH" 2>/dev/null; then
  if git show "FETCH_HEAD:$FILE" 2>/dev/null | cmp -s - "$FILE"; then SAME=1; fi
fi

# 판정은 로컬 HEAD를 base와 비교하므로 항상 로컬에 커밋한다. 푸시는 내용이 달라졌을 때만 한다.
git config user.name "${GIT_COMMITTER_NAME:-github-actions[bot]}"
git config user.email "${GIT_COMMITTER_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git checkout -q -B "$BRANCH"
git add "$FILE"
git commit -q -m "chore(catalog): 조직 저장소 목록과 카탈로그를 동기화한다

조직 저장소(토픽 side-project-app)와 catalog/projects.json의 차이를
npm run sync:catalog로 반영한다.

Refs #${ISSUE}"
if [ "$SAME" = "0" ]; then
  git push -q --force "$REMOTE" "$BRANCH"
fi

cat > "$WORK/body.md" <<BODY
## 설명

조직 저장소(토픽 \`side-project-app\`)와 \`catalog/projects.json\`의 차이를 \`npm run sync:catalog\`로 반영하는 자동 PR입니다. 매일 한 번 \`sync-catalog.yml\`이 만들거나 갱신합니다.

## 관련 이슈

Refs #${ISSUE}

## 변경사항

- \`catalog/projects.json\`만 갱신합니다. 알림 계약, 카탈로그 형식, 워크플로 SHA, 환경변수는 바꾸지 않습니다.
- 자동 병합 판정(\`scripts/catalog-auto-merge.mjs\`)을 통과하면 승인 리뷰가 남고 자동 병합이 예약됩니다. 통과하지 못하면 사유가 코멘트로 남고 사람이 검토합니다(\`docs/catalog.md\`).

## 체크리스트

- [ ] 테스트를 먼저 작성하고 의도한 이유로 실패(Red)하는 것을 확인했습니다 (코드 변경이 없는 자동 PR이라 해당하지 않습니다)
- [ ] \`npm run typecheck\`, \`npx expo lint\`, \`npm test\`가 통과합니다 (CI의 \`check\`가 실행합니다)
- [ ] 동작이 바뀐 부분의 \`docs/\`와 지침을 함께 갱신했습니다 (해당하지 않습니다)
- [x] 비밀 값과 토큰을 코드, 문서, 로그에 남기지 않았습니다
- [ ] Expo 패키지는 \`npx expo install\`로 추가했고 lockfile은 하나만 유지합니다 (해당하지 않습니다)
- [ ] 이슈를 만들거나 닫았다면 \`STATE.md\`의 후보 큐를 함께 갱신했습니다 (해당하지 않습니다)

## 검증 결과

- 타입 체크·lint·테스트: PR의 CI \`check\`에서 실행됩니다.
- Android 실기기: 앱 코드 변경이 없어 해당하지 않습니다.
- iOS 실기기: 앱 코드 변경이 없어 해당하지 않습니다.

## 한계와 확인하지 못한 것

- 주소 응답은 동기화 스크립트가 확인했지만 WebView에서 실제로 동작하는지는 기기에서 확인하지 않았습니다.
BODY

PR="$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')"
CREATED=0
if [ -z "$PR" ]; then
  gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" --body-file "$WORK/body.md" > /dev/null
  PR="$(gh pr view "$BRANCH" --json number --jq .number)"
  CREATED=1
elif [ "$SAME" = "0" ]; then
  gh pr edit "$PR" --body-file "$WORK/body.md" > /dev/null
fi

# 같은 내용이고 이미 자동 병합이 예약되어 있으면 할 일이 없다.
# 예약되어 있지 않다면(설정을 고친 다음 날 등) 아래 판정으로 다시 시도하고, 사유 코멘트는 처음 한 번만 남긴다.
if [ "$SAME" = "1" ] && [ "$CREATED" = "0" ]; then
  RESERVED="$(gh pr view "$PR" --json autoMergeRequest --jq '.autoMergeRequest != null')"
  if [ "$RESERVED" = "true" ]; then
    echo "이미 자동 병합이 예약된 PR #${PR}입니다."
    exit 0
  fi
fi

set +e
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$CLI" --base-ref "$REMOTE/$BASE" --review-out "$WORK/review.md" --comment-out "$WORK/comment.md"
CODE=$?
set -e

case "$CODE" in
  0)
    bash "$POST_REVIEW" "$PR" "$WORK/review.md"
    if ! gh pr merge "$PR" --auto --merge; then
      echo "::error::자동 병합 예약에 실패했습니다. 저장소 설정 allow_auto_merge가 켜져 있는지 확인하세요."
      exit 1
    fi
    echo "PR #${PR}의 자동 병합을 예약했습니다."
    ;;
  3)
    if [ "$SAME" = "0" ] || [ "$CREATED" = "1" ]; then
      gh pr comment "$PR" --body-file "$WORK/comment.md" > /dev/null
    fi
    echo "::notice::PR #${PR}은 사람이 확인해야 합니다(자동 병합 조건 미충족)."
    ;;
  *)
    echo "::error::자동 병합 판정에 실패했습니다(종료 코드 ${CODE})."
    exit "$CODE"
    ;;
esac

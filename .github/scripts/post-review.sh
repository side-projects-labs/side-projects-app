#!/usr/bin/env bash
# PR에 코드 리뷰 코멘트를 남기고, 리뷰 게이트가 반영되도록 PR의 `check` 실행을 다시 돌린다.
# 사용: bash .github/scripts/post-review.sh <PR번호> <리뷰 본문 파일>
#
# 왜 다시 돌리나: 게이트는 `check` 안에서 리뷰 코멘트를 읽는다. 리뷰는 CI가 끝난 뒤에 남으므로, 같은 실행을 재실행해야
# 그 체크 결과가 갱신된다. 리뷰 이벤트로 별도 실행을 만들면 같은 이름의 이전 실패 체크가 남아 병합 판정이 풀리지 않는다.
set -euo pipefail

PR="${1:?PR 번호가 필요합니다}"
BODY="${2:?리뷰 본문 파일이 필요합니다}"
[ -f "$BODY" ] || { echo "리뷰 본문 파일이 없습니다: $BODY" >&2; exit 1; }
grep -q '<!-- code-review -->' "$BODY" || { echo "본문에 마커 <!-- code-review --> 가 없습니다." >&2; exit 1; }
grep -q '^판정:' "$BODY" || { echo "본문에 '판정:' 줄이 없습니다." >&2; exit 1; }

BRANCH="$(gh pr view "$PR" --json headRefName --jq .headRefName)"
HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"

gh pr review "$PR" --comment --body-file "$BODY"
echo "리뷰를 남겼습니다(HEAD ${HEAD:0:7})."

# HEAD 커밋의 pull_request 실행을 찾는다(CI가 아직 시작 전일 수 있어 잠시 기다린다).
RUN=""
for _ in $(seq 1 30); do
  RUN="$(gh run list --branch "$BRANCH" --event pull_request --workflow CI --limit 20 --json databaseId,headSha \
    --jq "[.[] | select(.headSha==\"$HEAD\")][0].databaseId // empty")"
  [ -n "$RUN" ] && break
  sleep 5
done
[ -n "$RUN" ] || { echo "HEAD의 CI 실행을 찾지 못했습니다. Actions에서 직접 재실행하세요." >&2; exit 1; }

# 진행 중이면 끝날 때까지 기다린다(최대 15분). 진행 중인 실행은 재실행할 수 없다.
for _ in $(seq 1 90); do
  STATUS="$(gh run view "$RUN" --json status --jq .status)"
  [ "$STATUS" = "completed" ] && break
  sleep 10
done
[ "$STATUS" = "completed" ] || { echo "CI가 15분 안에 끝나지 않았습니다. 나중에 재실행하세요: gh run rerun $RUN --failed" >&2; exit 1; }

case "$(gh run view "$RUN" --json conclusion --jq .conclusion)" in
  success) echo "CI가 이미 성공 상태입니다. 재실행이 필요 없습니다." ;;
  failure) echo "실패한 job을 재실행해 게이트를 다시 평가합니다."; gh run rerun "$RUN" --failed ;;
  *)       echo "실행을 전체 재실행합니다."; gh run rerun "$RUN" ;;
esac

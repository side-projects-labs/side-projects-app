#!/usr/bin/env bash
# 병합 게이트: PR 최신 커밋에 대한 코드 리뷰 코멘트를 읽어 치명·중요 지적이 있으면 실패한다.
# CI의 `check` job 안에서 실행된다(별도 워크플로·별도 필수 체크 없음).
#
# 통과 조건: 최신 커밋(HEAD)에 남긴 리뷰가 있고, `판정:` 줄이 있으며, [치명]·[중요] 지적이 없고 판정이 '수정 필요'가 아니다.
# 실패 조건(병합 차단): 리뷰 없음 / 이전 커밋에 대한 리뷰뿐 / 판정 줄 없음 / [치명]·[중요] 지적 있음 / 판정 '수정 필요'.
# 리뷰 인정 기준: 저장소 쓰기 권한자(OWNER·MEMBER·COLLABORATOR)가 남긴 리뷰, 본문에 마커 `<!-- code-review -->`,
#   그리고 리뷰가 달린 커밋(commit_id)이 PR HEAD와 같아야 한다. 새 커밋을 푸시하면 이전 리뷰는 무효가 된다.
# 입력(환경변수): GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA
# 로컬 시험: REVIEWS_FILE=<reviews JSON 배열> HEAD_SHA=<sha> bash .github/scripts/review-gate.sh
set -uo pipefail

MARKER='<!-- code-review -->'
: "${HEAD_SHA:?HEAD_SHA 가 필요합니다}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

block() { echo "::error::$1"; echo "병합 차단: $1"; exit 1; }

if [ -n "${REVIEWS_FILE:-}" ]; then
  cp "$REVIEWS_FILE" "$WORK/reviews.json"
else
  : "${GITHUB_REPOSITORY:?}" "${PR_NUMBER:?}"
  gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/reviews?per_page=100" | jq -s 'add // []' > "$WORK/reviews.json" \
    || block "리뷰 목록을 가져오지 못했습니다."
fi

# 가장 최근에 제출된 유효 리뷰 본문. 마커가 있고 HEAD 커밋에 달린 것만 본다.
jq -r --arg sha "$HEAD_SHA" --arg marker "$MARKER" '
  [ .[]
    | select(.commit_id == $sha)
    | select(.state == "COMMENTED" or .state == "APPROVED" or .state == "CHANGES_REQUESTED")
    | select(.author_association == "OWNER" or .author_association == "MEMBER" or .author_association == "COLLABORATOR")
    | select((.body // "") | contains($marker)) ]
  | sort_by(.submitted_at) | last | .body // empty' "$WORK/reviews.json" > "$WORK/review.md"

if [ ! -s "$WORK/review.md" ]; then
  block "최신 커밋(${HEAD_SHA:0:7})에 대한 코드 리뷰 코멘트가 없습니다. 리뷰를 남긴 뒤 병합하세요."
fi

grep -q '^판정:' "$WORK/review.md" || block "리뷰 코멘트에 '판정:' 줄이 없습니다(리뷰가 완성되지 않았습니다)."

CRITICAL="$(grep -cE '^[[:space:]]*-[[:space:]]*\[치명\]' "$WORK/review.md" || true)"
MAJOR="$(grep -cE '^[[:space:]]*-[[:space:]]*\[중요\]' "$WORK/review.md" || true)"
MINOR="$(grep -cE '^[[:space:]]*-[[:space:]]*\[제안\]' "$WORK/review.md" || true)"
echo "최신 커밋 리뷰: 치명=$CRITICAL 중요=$MAJOR 제안=$MINOR"

if [ "$CRITICAL" -gt 0 ] || [ "$MAJOR" -gt 0 ]; then
  block "치명 ${CRITICAL}건, 중요 ${MAJOR}건의 지적이 남아 있습니다. 수정하고 다시 리뷰를 남기세요."
fi
if grep -E '^판정:' "$WORK/review.md" | grep -q '수정 필요'; then
  block "리뷰 판정이 '수정 필요'입니다."
fi
echo "리뷰 게이트 통과: 치명·중요 지적 없음"

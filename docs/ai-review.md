# 자동 코드 리뷰와 병합 차단

master 대상 PR은 AI가 변경분을 리뷰하고 **결과를 PR 코멘트로 남긴다.** 병합 가능 여부는 승인할 사람이 아니라 **최신 커밋의 리뷰 코멘트 결과**로 정한다.

## 규칙
- PR을 열거나 새 커밋을 푸시할 때마다 `AI review` 워크플로(`ai-review` 체크)가 실행되어 코멘트를 남긴다.
  - ✅ **승인**: blocking 지적이 없다. 체크가 통과한다.
  - ❌ **수정 필요**: blocking 지적이 있다. 체크가 실패해 병합이 차단된다. 수정 후 푸시하면 다시 리뷰한다.
  - ⚠️ **미완료**: 키 없음, API 오류, 응답 해석 실패, diff 과대(200KB 초과), 포크 PR, 코멘트 게시 실패. 체크가 실패해 병합이 차단된다.
- **리뷰 코멘트가 없으면 병합할 수 없다.** 체크는 코멘트를 남기는 데 성공한 뒤에만 통과하고, 아직 실행되지 않았거나 대기 중인 필수 체크도 병합을 막는다.
- 결과는 **최신 커밋 기준**이다. 이전 커밋의 코멘트는 이력으로만 남는다.
- 리뷰 기준은 `.agents/skills/code-review/SKILL.md`이며, 워크플로·스크립트와 함께 **항상 master의 것**을 쓴다(`pull_request_target`). PR이 리뷰 로직이나 기준을 바꿔 스스로 통과할 수 없다. PR 코드는 체크아웃·실행하지 않고 diff만 읽는다.
- lockfile과 이미지·폰트 같은 바이너리는 리뷰에서 제외한다. 대신 `package-lock.json`에 npm 공식 레지스트리(`registry.npmjs.org`)가 아닌 `resolved` 주소가 추가되면 체크를 실패시킨다(공급망 공격 방지). lockfile만 바뀐 PR은 내용 리뷰 없이 승인되므로 의존성 변경은 사람이 확인한다.

## 구성
| 파일 | 역할 |
|---|---|
| `.github/workflows/ai-review.yml` | `pull_request_target` 트리거, job 이름 `ai-review`(필수 체크 이름) |
| `.github/scripts/ai-review.sh` | diff 수집 → Anthropic Messages API 호출 → 코멘트 게시 → 승인이 아니면 exit 1 |
| `.agents/skills/code-review/SKILL.md` | 리뷰 기준 |

## 켜는 방법 (사람이 수행)
1. 저장소 Secret `ANTHROPIC_API_KEY` 등록(값은 사람이 직접): `gh secret set ANTHROPIC_API_KEY -R side-projects-labs/side-projects-app`
2. 이 워크플로가 master에 머지된 뒤 브랜치 보호의 필수 체크에 `ai-review`를 추가한다.
   ```
   gh api -X PUT repos/side-projects-labs/side-projects-app/branches/master/protection/required_status_checks \
     -f strict=false -f 'contexts[]=check' -f 'contexts[]=ai-review'
   ```
   키 등록과 머지 전에 필수로 걸면 모든 PR이 차단되므로 순서를 지킨다.

## 한계
- AI 리뷰는 보조 수단이며 오탐·누락이 있다. 사람의 판단을 대체하지 않는다.
- PR마다 API 비용이 든다. 변경이 작을수록 저렴하며, 모델은 `REVIEW_MODEL` 환경변수로 바꿀 수 있다(기본 `claude-sonnet-5-5`).
- diff 내용은 모델 입력으로 외부에 전송된다. 비밀 값을 커밋하지 않는다.
- 응답이 잘못 승인 쪽으로 나오는 경우를 막기 위해 `approved`여도 blocking 지적이 있으면 수정 필요로 처리한다.
- 일시적 API 장애로 체크가 실패하면 워크플로를 다시 실행하거나 새 커밋을 푸시한다. 관리자 우회는 `enforce_admins` 설정을 풀어야 가능하다.

## 로컬 시험
`DRY_RUN=1 DIFF_FILE=<diff> MOCK_RESPONSE_FILE=<응답 JSON> SKILL_FILE=<기준 파일> PR_NUMBER=1 HEAD_SHA=<sha> HEAD_REPO=o/r GITHUB_REPOSITORY=o/r bash .github/scripts/ai-review.sh`

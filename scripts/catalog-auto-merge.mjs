// 카탈로그 동기화 PR을 사람 없이 병합해도 되는지 판정한다(판정 규칙: src/features/projects/catalog-auto-merge.ts).
//
// 사용: node --experimental-strip-types scripts/catalog-auto-merge.mjs --base-ref origin/master \
//         [--review-out <파일>] [--comment-out <파일>] [--probe-file <파일>]
//   현재 체크아웃(HEAD)을 base-ref와 비교한다. git 저장소 안에서 실행해야 한다.
//   --review-out   대상일 때 리뷰 게이트가 읽는 승인 리뷰 본문을 저장한다
//   --comment-out  대상이 아닐 때 사람이 확인해야 하는 사유를 PR 코멘트용 마크다운으로 저장한다
//   --probe-file   새 항목의 주소 응답을 {id: {status, location?} | null} JSON으로 주입한다(시험용). 없으면 실제로 요청한다
// 종료 코드: 0 자동 병합 대상, 3 사람이 확인해야 함, 1 오류
// 정책 파일과 기준 카탈로그는 PR 브랜치가 아니라 base-ref의 것을 읽는다(PR이 스스로 규칙을 바꾸지 못하게 한다).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  buildReviewBody,
  evaluateAutoMerge,
  hostAllowed,
  isHttpsServiceUrl,
  parsePolicy,
  probeUrl,
} from '../src/features/projects/catalog-auto-merge.ts';

const CATALOG = 'catalog/projects.json';
const POLICY = 'catalog/auto-merge-policy.json';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const baseRef = opt('--base-ref');
const reviewOut = opt('--review-out');
const commentOut = opt('--comment-out');
const probeFile = opt('--probe-file');

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}
if (!baseRef) fail('--base-ref가 필요합니다');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function parseCatalogFile(text, label) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`${label}가 올바른 JSON이 아닙니다`);
  }
  if (!data || data.version !== 1 || !Array.isArray(data.projects)) fail(`${label}의 형식이 올바르지 않습니다`);
  return data.projects;
}

function notEligible(reasons, summary = { added: [], changed: [], removed: [] }) {
  const decision = { eligible: false, reasons, summary };
  console.log(JSON.stringify(decision));
  if (commentOut) {
    const body = [
      '자동 병합 조건을 만족하지 않아 **사람이 확인해야 합니다.** 이 PR은 자동으로 병합되지 않습니다.',
      '',
      ...reasons.map((r) => `- ${r}`),
      '',
      '조건과 허용 호스트는 `docs/catalog.md`와 `catalog/auto-merge-policy.json`을 봅니다.',
      '',
    ].join('\n');
    writeFileSync(commentOut, body);
  }
  process.exit(3);
}

let baseText;
try {
  baseText = git('show', `${baseRef}:${CATALOG}`);
} catch {
  fail(`${baseRef}의 ${CATALOG}를 읽지 못했습니다`);
}
const base = parseCatalogFile(baseText, `${baseRef}의 ${CATALOG}`);
const head = parseCatalogFile(readFileSync(CATALOG, 'utf8'), `PR의 ${CATALOG}`);

let policy = null;
try {
  policy = parsePolicy(JSON.parse(git('show', `${baseRef}:${POLICY}`)));
} catch {
  policy = null;
}
if (!policy) notEligible([`${baseRef}에 올바른 자동 병합 정책(${POLICY})이 없어 자동 병합하지 않습니다`]);

let changedFiles;
try {
  changedFiles = git('diff', '--name-only', baseRef, 'HEAD').split('\n').filter(Boolean);
} catch {
  fail('변경 파일 목록을 읽지 못했습니다');
}

// 새 항목의 주소는 실제로 요청해 로그인 벽이나 다른 호스트로의 리다이렉트가 아닌지 본다.
// 허용 호스트 밖이거나 형식이 틀린 주소는 요청하지 않는다(판정에서 이미 막히며, 임의의 호스트로 요청이 나가지 않게 한다).
const baseIds = new Set(base.map((e) => e.id));
const added = head.filter((e) => !baseIds.has(e.id));
let probes = {};
if (probeFile) {
  try {
    probes = JSON.parse(readFileSync(probeFile, 'utf8'));
  } catch {
    fail('--probe-file을 읽지 못했습니다');
  }
} else {
  for (const e of added) {
    if (typeof e.url !== 'string' || !isHttpsServiceUrl(e.url)) continue;
    const u = new URL(e.url);
    if (u.port || !hostAllowed(u.hostname, policy.allowedUrlHosts)) continue;
    probes[e.id] = await probeUrl(e.url);
  }
}

const decision = evaluateAutoMerge({ base, head, changedFiles, policy, probes });
if (!decision.eligible) notEligible(decision.reasons, decision.summary);

console.log(JSON.stringify(decision));
if (reviewOut) writeFileSync(reviewOut, buildReviewBody(decision));
process.exit(0);

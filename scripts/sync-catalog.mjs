#!/usr/bin/env node
// GitHub 조직 저장소에서 catalog/projects.json을 만든다. 설명: docs/catalog.md "조직 저장소로 동기화"
//
// 사용법
//   npm run sync:catalog          카탈로그를 갱신한다(--write)
//   npm run sync:catalog:check    차이만 확인한다(--check). 차이가 있으면 종료 코드 2
//   옵션: --report <파일>         결과를 마크다운으로 저장한다(워크플로가 이슈 본문으로 쓴다)
// 종료 코드: 0 차이 없음, 1 오류, 2 차이 있음(--check)
//
// 입력은 환경변수로만 받는다: GITHUB_TOKEN(선택, 호출 한도를 늘린다), GITHUB_ORG(기본 side-projects-labs)
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  SYNC_TOPIC,
  buildCatalog,
  diffCatalog,
  parseOverrides,
  selectRepos,
  serializeCatalog,
} from '../src/features/projects/catalog-sync.ts';

const ORG = process.env.GITHUB_ORG || 'side-projects-labs';
const ROOT = new URL('../', import.meta.url);
const CATALOG_PATH = fileURLToPath(new URL('catalog/projects.json', ROOT));
const OVERRIDES_PATH = fileURLToPath(new URL('catalog/overrides.json', ROOT));

const args = process.argv.slice(2);
const mode = args.includes('--write') ? 'write' : args.includes('--check') ? 'check' : 'plan';
const reportIdx = args.indexOf('--report');
const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : undefined;

function fail(message) {
  console.error(`오류: ${message}`);
  process.exit(1);
}

async function fetchRepos() {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'side-projects-app-catalog-sync' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const repos = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(`https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public&page=${page}`, { headers });
    if (!res.ok) fail(`GitHub API가 ${res.status}를 반환했습니다(${ORG} 저장소 목록).`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    description: r.description ?? null,
    homepage: r.homepage || null,
    topics: Array.isArray(r.topics) ? r.topics : [],
    archived: Boolean(r.archived),
    fork: Boolean(r.fork),
  }));
}

/** 주소가 실제로 응답하는지 확인한다. 리다이렉트를 따라가 최종 응답이 400 미만이면 정상이다. */
async function isReachable(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'side-projects-app-catalog-sync' },
    });
    return res.status < 400;
  } catch {
    return false;
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const repos = selectRepos(await fetchRepos());
// 토픽을 붙인 저장소가 하나도 없으면 목록을 비우지 않고 멈춘다(토픽 누락·API 이상 대비).
if (repos.length === 0) fail(`토픽 \`${SYNC_TOPIC}\`를 가진 공개 저장소가 없습니다. 저장소 토픽을 확인해 주세요.`);

const existing = readJson(CATALOG_PATH, { projects: [] }).projects ?? [];
const overrides = parseOverrides(readJson(OVERRIDES_PATH, {}));

// 1차로 후보 주소를 만들고, 응답을 확인한 뒤 다시 만든다.
const candidates = buildCatalog({ repos, overrides, existing, reachable: {} }).projects;
const reachable = {};
await Promise.all(candidates.map(async (p) => { reachable[p.id] = await isReachable(p.url); }));
const { projects, problems } = buildCatalog({ repos, overrides, existing, reachable });

const diff = diffCatalog(existing, projects);
const drift = diff.added.length + diff.removed.length + diff.changed.length > 0;

const lines = [];
lines.push('## 카탈로그 동기화 결과', '');
lines.push(`- 대상: 조직 \`${ORG}\`의 토픽 \`${SYNC_TOPIC}\` 저장소 ${repos.length}개`);
if (drift) {
  if (diff.added.length) lines.push(`- 추가: ${diff.added.map((id) => `\`${id}\``).join(', ')}`);
  if (diff.removed.length) lines.push(`- 제거: ${diff.removed.map((id) => `\`${id}\``).join(', ')}`);
  if (diff.changed.length) lines.push(`- 변경: ${diff.changed.map((id) => `\`${id}\``).join(', ')}`);
} else {
  lines.push('- 변경 사항이 없습니다.');
}
if (problems.length) {
  lines.push('', '### 확인이 필요한 항목', '');
  for (const p of problems) lines.push(`- \`${p.id}\`: ${p.reason}`);
  lines.push('', '주소가 틀렸다면 `catalog/overrides.json`의 `url`로 덮어쓰고, 응답하지 않는 항목은 기존 값을 유지했습니다.');
}
if (drift) {
  lines.push('', '### 갱신 방법', '', '```bash', 'npm run sync:catalog', '```', '', '결과를 확인하고 일반 PR 절차(리뷰와 CI)로 반영합니다.');
}
const report = `${lines.join('\n')}\n`;
console.log(report);
if (reportPath) writeFileSync(reportPath, report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

if (mode === 'write') {
  if (drift) {
    writeFileSync(CATALOG_PATH, serializeCatalog(projects));
    console.log('catalog/projects.json을 갱신했습니다.');
  }
  process.exit(0);
}
process.exit(mode === 'check' && drift ? 2 : 0);

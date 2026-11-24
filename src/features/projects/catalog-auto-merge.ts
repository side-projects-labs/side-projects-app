// 런타임 import를 두지 않는다. scripts/catalog-auto-merge.mjs가 Node(--experimental-strip-types)로 이 파일을 직접 읽는데,
// Node의 ESM은 확장자 없는 상대 경로를 해석하지 못하고 tsconfig는 `.ts` 확장자 import를 허용하지 않는다.
// 타입은 `import type`으로 가져오고(실행 시 사라진다) 아래 두 헬퍼는 catalog-sync.ts와 같은 동작을 유지한다
// (같은 동작임은 catalog-auto-merge.test.ts의 동등성 테스트가 확인한다).
import type { SyncEntry } from './catalog-sync';

/**
 * 카탈로그 동기화 PR을 사람 없이 병합해도 되는지 기계적으로 판정한다.
 * 카탈로그는 앱이 WebView로 여는 주소를 정하므로 "안전하다고 확인되는 변경"만 통과시킨다.
 * 통과하지 못하면 PR은 열어 두고 사람이 검토한다(docs/catalog.md).
 */

export type AutoMergePolicy = { allowedUrlHosts: string[] };
export type AutoMergeDecision = {
  eligible: boolean;
  reasons: string[];
  summary: { added: string[]; changed: string[]; removed: string[] };
};

const CATALOG_FILE = 'catalog/projects.json';
const ORG = 'side-projects-labs';
const MAX_PROJECTS = 50;
const MAX_POLICY_HOSTS = 50;
const MAX_NAME = 60;
const MAX_DESCRIPTION = 200;
const MAX_ICON = 16;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

/** 호스트 허용 목록 패턴: 정확한 호스트(`a.example.com`) 또는 하위 도메인 전체(`*.example.com`, 상위 도메인은 제외). */
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  return allowed.some((raw) => {
    const p = raw.trim().toLowerCase();
    if (p.startsWith('*.')) {
      const suffix = p.slice(1);
      return h.length > suffix.length && h.endsWith(suffix);
    }
    return h === p;
  });
}

/** 정책 파일(catalog/auto-merge-policy.json)을 엄격하게 검증한다. 하나라도 이상하면 null(자동 병합을 하지 않는다). */
export function parsePolicy(raw: unknown): AutoMergePolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const hosts = (raw as { allowedUrlHosts?: unknown }).allowedUrlHosts;
  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.length > MAX_POLICY_HOSTS) return null;

  const result: string[] = [];
  for (const item of hosts) {
    if (typeof item !== 'string') return null;
    const p = item.trim().toLowerCase();
    const bare = p.startsWith('*.') ? p.slice(2) : p;
    // `*`, `*.com`처럼 너무 넓은 패턴과 스킴·경로·포트가 섞인 값은 HOSTNAME(점 포함 도메인)에서 걸러진다.
    if (!HOSTNAME.test(bare)) return null;
    if (!result.includes(p)) result.push(p);
  }
  return { allowedUrlHosts: result };
}

function textProblem(e: SyncEntry): string | null {
  const fields: [string, string, number][] = [
    ['이름', e.name, MAX_NAME],
    ['설명', e.description, MAX_DESCRIPTION],
    ['아이콘', e.icon, MAX_ICON],
  ];
  for (const [label, value, max] of fields) {
    if (typeof value !== 'string' || value.trim() === '') return `${label}이 비어 있습니다`;
    if (CONTROL.test(value)) return `${label}에 줄바꿈이나 제어 문자가 있습니다`;
    if (value.length > max) return `${label}이 ${max}자를 넘습니다`;
  }
  return null;
}

const stable = (v: unknown) => JSON.stringify(v ?? null);

/** 서비스 URL은 자격증명이 없는 HTTPS만 허용한다(catalog-sync.ts의 isValidServiceUrl과 같은 기준). */
export function isHttpsServiceUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** 두 목록의 차이를 id로 알려 준다(catalog-sync.ts의 diffCatalog와 같은 동작). */
function diffById(
  before: readonly SyncEntry[],
  after: readonly SyncEntry[],
): { added: string[]; removed: string[]; changed: string[] } {
  const b = new Map(before.map((e) => [e.id, e]));
  const a = new Map(after.map((e) => [e.id, e]));
  return {
    added: [...a.keys()].filter((id) => !b.has(id)),
    removed: [...b.keys()].filter((id) => !a.has(id)),
    changed: [...a.keys()].filter(
      (id) => b.has(id) && JSON.stringify(b.get(id)) !== JSON.stringify(a.get(id)),
    ),
  };
}

export function evaluateAutoMerge(input: {
  base: readonly SyncEntry[];
  head: readonly SyncEntry[];
  changedFiles: readonly string[];
  policy: AutoMergePolicy;
}): AutoMergeDecision {
  const { base, head, changedFiles, policy } = input;
  const reasons: string[] = [];
  const summary = diffById(base, head);

  if (changedFiles.length !== 1 || changedFiles[0] !== CATALOG_FILE) {
    reasons.push(`변경된 파일이 ${CATALOG_FILE} 하나가 아닙니다`);
  }
  if (new Set(head.map((e) => e.id)).size !== head.length) reasons.push('중복된 id가 있습니다');
  if (head.length > MAX_PROJECTS) reasons.push(`항목이 ${MAX_PROJECTS}개를 넘습니다`);
  if (summary.added.length + summary.changed.length + summary.removed.length === 0) {
    reasons.push('카탈로그에 변경이 없습니다');
  }
  for (const id of summary.removed) reasons.push(`삭제된 프로젝트 ${id}는 사람이 확인해야 합니다`);

  const before = new Map(base.map((e) => [e.id, e]));
  const after = new Map(head.map((e) => [e.id, e]));

  for (const id of summary.changed) {
    const b = before.get(id) as SyncEntry;
    const a = after.get(id) as SyncEntry;
    if (b.url !== a.url) reasons.push(`프로젝트 ${id}의 주소 변경은 사람이 확인해야 합니다`);
    if (stable(b.repo) !== stable(a.repo)) reasons.push(`프로젝트 ${id}의 repo 변경은 사람이 확인해야 합니다`);
    if (stable(b.allowedHosts) !== stable(a.allowedHosts)) {
      reasons.push(`프로젝트 ${id}의 allowedHosts 변경은 사람이 확인해야 합니다`);
    }
    const problem = textProblem(a);
    if (problem) reasons.push(`프로젝트 ${id}: ${problem}`);
  }

  for (const id of summary.added) {
    const a = after.get(id) as SyncEntry;
    if (!ID.test(a.id)) {
      reasons.push('새 프로젝트의 id 형식이 올바르지 않습니다');
      continue;
    }
    if (a.repo !== `${ORG}/${a.id}`) reasons.push(`새 프로젝트 ${id}: repo가 ${ORG}/${id}가 아닙니다`);
    if (a.allowedHosts !== undefined) reasons.push(`새 프로젝트 ${id}: allowedHosts는 사람이 확인해야 합니다`);
    if (!isHttpsServiceUrl(a.url)) {
      reasons.push(`새 프로젝트 ${id}: 주소가 자격증명 없는 HTTPS가 아닙니다`);
    } else {
      const host = new URL(a.url).hostname;
      if (!hostAllowed(host, policy.allowedUrlHosts)) {
        reasons.push(`새 프로젝트 ${id}: 주소 호스트(${host})가 허용 목록에 없습니다`);
      }
    }
    const problem = textProblem(a);
    if (problem) reasons.push(`새 프로젝트 ${id}: ${problem}`);
  }

  return { eligible: reasons.length === 0, reasons, summary };
}

/**
 * 리뷰 게이트(.github/scripts/review-gate.sh)가 읽는 형식의 승인 리뷰 본문.
 * 자유 텍스트(설명 등)는 넣지 않고 검증을 통과한 id만 적어, 본문에 지적 줄이나 판정 줄이 끼어들 수 없게 한다.
 */
export function buildReviewBody(decision: AutoMergeDecision): string {
  if (!decision.eligible) throw new Error('자동 병합 대상이 아닌 결정으로는 승인 리뷰를 만들 수 없습니다');
  const { added, changed } = decision.summary;
  const list = (ids: string[]) => (ids.length > 0 ? ids.join(', ') : '없음');
  return [
    '<!-- code-review -->',
    '## 코드 리뷰 (자동 검증)',
    '',
    '이 리뷰는 사람이 쓴 것이 아니라 `scripts/catalog-auto-merge.mjs`의 자동 검증 결과입니다. 사람이 검토하지 않았습니다.',
    '',
    `- 추가된 프로젝트: ${list(added)}`,
    `- 이름·설명·아이콘이 바뀐 프로젝트: ${list(changed)}`,
    '',
    '검증한 조건: 변경 파일이 `catalog/projects.json` 하나, 삭제와 `id`·주소·`repo`·`allowedHosts` 변경 없음, 새 항목의 주소가 HTTPS이고 `catalog/auto-merge-policy.json`의 허용 호스트 안에 있음, 새 항목의 `repo`가 같은 조직의 같은 이름, 이름·설명·아이콘에 제어 문자와 과도한 길이 없음.',
    '',
    '판정: 승인',
    '',
  ].join('\n');
}

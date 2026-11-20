/**
 * GitHub 조직 저장소에서 카탈로그(catalog/projects.json)를 만드는 순수 로직.
 * scripts/sync-catalog.mjs가 Node에서 그대로 불러 쓰므로 React Native나 다른 모듈에 의존하지 않는다.
 *
 * 저장소의 homepage는 오래되거나 틀릴 수 있어(예: 404, API 루트의 403) 그대로 믿지 않는다.
 * 응답을 확인하고, 틀린 값은 catalog/overrides.json으로 덮어쓴다.
 */

/** 이 토픽을 붙인 저장소만 허브 앱에 노출한다(옵트인). */
export const SYNC_TOPIC = 'side-project-app';

const DEFAULT_ICON = '📦';
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export type RepoInfo = {
  name: string;
  full_name: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
};

/** catalog.ts의 ProjectEntry와 같은 모양. 앱 코드를 가져오지 않으려고 따로 선언한다. */
export type SyncEntry = {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  repo?: string;
  allowedHosts?: string[];
};

export type Override = Partial<Pick<SyncEntry, 'name' | 'description' | 'icon' | 'url' | 'allowedHosts'>>;
export type Overrides = Record<string, Override>;

export type Problem = { id: string; reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** 서비스 URL은 자격증명이 없는 HTTPS만 허용한다(catalog.ts와 같은 기준). */
export function isValidServiceUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** 토픽이 있고 보관·포크가 아닌 저장소만 고른다. */
export function selectRepos(repos: readonly RepoInfo[]): RepoInfo[] {
  return repos.filter((r) => r.topics.includes(SYNC_TOPIC) && !r.archived && !r.fork);
}

/** 덮어쓰기 설정을 검증한다. 허용한 필드만 남기고 잘못된 값은 버린다. */
export function parseOverrides(raw: unknown): Overrides {
  if (!isObject(raw)) return {};
  const result: Overrides = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    const o: Override = {};
    if (isNonEmptyString(value.name)) o.name = value.name;
    if (isNonEmptyString(value.description)) o.description = value.description;
    if (isNonEmptyString(value.icon)) o.icon = value.icon;
    if (isNonEmptyString(value.url)) o.url = value.url;
    if (Array.isArray(value.allowedHosts)) {
      const hosts = value.allowedHosts
        .filter((h): h is string => typeof h === 'string')
        .map((h) => h.trim().toLowerCase())
        .filter((h) => HOSTNAME.test(h));
      if (hosts.length > 0) o.allowedHosts = hosts;
    }
    result[id] = o;
  }
  return result;
}

type BuildInput = {
  repos: readonly RepoInfo[];
  overrides: Overrides;
  /** 지금 catalog/projects.json에 있는 항목. 순서와 응답 실패 시 유지할 값으로 쓴다. */
  existing: readonly SyncEntry[];
  /** id별 주소 응답 여부. 점검하지 않았거나 없으면 응답하는 것으로 본다. */
  reachable: Record<string, boolean>;
};

function toEntry(r: RepoInfo, o: Override | undefined): { entry?: SyncEntry; reason?: string } {
  const url = o?.url ?? r.homepage ?? '';
  if (!url) return { reason: '서비스 주소가 없습니다(저장소 homepage와 덮어쓰기 모두 비어 있습니다).' };
  if (!isValidServiceUrl(url)) return { reason: `서비스 주소가 올바른 HTTPS가 아닙니다: ${url}` };
  const description = o?.description ?? r.description ?? '';
  if (!description.trim()) return { reason: '설명이 없습니다(저장소 description과 덮어쓰기 모두 비어 있습니다).' };
  const entry: SyncEntry = {
    id: r.name,
    name: o?.name ?? r.name,
    description,
    icon: o?.icon ?? DEFAULT_ICON,
    url,
    repo: r.full_name,
  };
  if (o?.allowedHosts) entry.allowedHosts = o.allowedHosts;
  return { entry };
}

/**
 * 대상 저장소로 카탈로그를 만든다.
 * - 주소가 없거나 올바르지 않은 저장소, 설명이 없는 저장소는 건너뛰고 문제로 보고한다.
 * - 응답하지 않는 주소는 기존 항목이 있으면 그 값을 유지하고, 없으면 제외한다(둘 다 문제로 보고).
 * - 순서는 기존 순서를 유지하고 새 항목은 이름순으로 뒤에 붙인다.
 */
export function buildCatalog(input: BuildInput): { projects: SyncEntry[]; problems: Problem[] } {
  const problems: Problem[] = [];
  const existingById = new Map(input.existing.map((e) => [e.id, e]));
  const built = new Map<string, SyncEntry>();

  for (const r of input.repos) {
    const { entry, reason } = toEntry(r, input.overrides[r.name]);
    if (!entry) {
      problems.push({ id: r.name, reason: reason ?? '항목을 만들 수 없습니다.' });
      continue;
    }
    if (input.reachable[r.name] === false) {
      problems.push({ id: r.name, reason: `주소가 응답하지 않습니다: ${entry.url}` });
      const previous = existingById.get(r.name);
      if (previous) built.set(r.name, previous);
      continue;
    }
    built.set(r.name, entry);
  }

  const orderedIds = input.existing.map((e) => e.id).filter((id) => built.has(id));
  const newIds = [...built.keys()].filter((id) => !existingById.has(id)).sort((a, b) => a.localeCompare(b));
  const projects = [...orderedIds, ...newIds].map((id) => built.get(id) as SyncEntry);
  return { projects, problems };
}

function same(a: SyncEntry, b: SyncEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 두 목록의 차이를 id로 알려 준다. */
export function diffCatalog(
  before: readonly SyncEntry[],
  after: readonly SyncEntry[],
): { added: string[]; removed: string[]; changed: string[] } {
  const b = new Map(before.map((e) => [e.id, e]));
  const a = new Map(after.map((e) => [e.id, e]));
  return {
    added: [...a.keys()].filter((id) => !b.has(id)),
    removed: [...b.keys()].filter((id) => !a.has(id)),
    changed: [...a.keys()].filter((id) => b.has(id) && !same(b.get(id) as SyncEntry, a.get(id) as SyncEntry)),
  };
}

/** catalog/projects.json 형식으로 직렬화한다. 키 순서를 고정해 불필요한 차이를 만들지 않는다. */
export function serializeCatalog(projects: readonly SyncEntry[]): string {
  const ordered = projects.map((p) => {
    const o: Record<string, unknown> = {
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      url: p.url,
    };
    if (p.repo !== undefined) o.repo = p.repo;
    if (p.allowedHosts !== undefined) o.allowedHosts = p.allowedHosts;
    return o;
  });
  return `${JSON.stringify({ version: 1, projects: ordered }, null, 2)}\n`;
}

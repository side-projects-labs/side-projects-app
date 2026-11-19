import bundled from '../../../catalog/projects.json';

/**
 * 허브에 노출하는 사이드 프로젝트 카탈로그.
 * 원본은 저장소의 catalog/projects.json 이며, 앱은 이를 원격에서 받아오고(catalog-source.ts)
 * 실패하면 마지막 캐시 → 앱에 포함된 이 번들본 순으로 대체한다.
 * url은 실제로 응답을 확인한 배포 주소만 등록한다. (레포 homepage 값은 오래될 수 있다)
 */
export type ProjectEntry = {
  /** 레포 이름과 동일. 푸시 이벤트의 projectId와 매칭된다. */
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  repo?: string;
  /**
   * WebView 안에서 함께 열 추가 호스트(소셜 로그인 등). 서비스 URL의 호스트는 항상 허용된다.
   * 호스트 이름만 쓴다(HTTPS 전용, 와일드카드·포트·경로 불가). 목록에 없는 외부 주소는 기기 브라우저로 연다.
   */
  allowedHosts?: string[];
};

const MAX_PROJECTS = 50;
const MAX_ALLOWED_HOSTS = 10;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** 호스트 이름 목록을 검증한다. 형식이 틀린 항목은 버리고, 남는 게 없으면 undefined. */
function parseAllowedHosts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hosts = value
    .filter((h): h is string => typeof h === 'string')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => HOSTNAME.test(h));
  const unique = [...new Set(hosts)].slice(0, MAX_ALLOWED_HOSTS);
  return unique.length > 0 ? unique : undefined;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** 서비스 URL은 자격증명이 없는 HTTPS만 허용한다. */
function isValidServiceUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** 원격에서 받은 신뢰할 수 없는 JSON을 검증한다. 잘못된 항목은 버리고, 쓸 항목이 없으면 null. */
export function parseCatalog(data: unknown): ProjectEntry[] | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { version?: unknown; projects?: unknown };
  if (d.version !== 1 || !Array.isArray(d.projects)) return null;

  const seen = new Set<string>();
  const result: ProjectEntry[] = [];
  for (const raw of d.projects.slice(0, MAX_PROJECTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (
      !isNonEmptyString(p.id) ||
      !isNonEmptyString(p.name) ||
      !isNonEmptyString(p.description) ||
      !isNonEmptyString(p.icon) ||
      !isNonEmptyString(p.url) ||
      !isValidServiceUrl(p.url) ||
      seen.has(p.id)
    ) {
      continue;
    }
    seen.add(p.id);
    result.push({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      url: p.url,
      repo: isNonEmptyString(p.repo) ? p.repo : undefined,
      allowedHosts: parseAllowedHosts(p.allowedHosts),
    });
  }
  return result.length > 0 ? result : null;
}

export const BUNDLED_PROJECTS: readonly ProjectEntry[] = parseCatalog(bundled) ?? [];

export function findProject(
  projects: readonly ProjectEntry[],
  id: string | undefined,
): ProjectEntry | undefined {
  return projects.find((p) => p.id === id);
}

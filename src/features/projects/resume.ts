import type { ProjectEntry } from './catalog';
import { findProject } from './catalog';

/** 마지막으로 본 페이지. 프로젝트 id와 서비스 안의 전체 주소(쿼리·해시 포함). */
export type LastVisit = { projectId: string; url: string };

const MAX_URL_LENGTH = 2000;
const MAX_LABEL_LENGTH = 40;

// 로그인·로그아웃·인증 콜백 화면은 다시 열면 깨지거나 의미가 없어 저장하지 않는다. 경로 조각이 정확히 같을 때만 막는다(/authors 는 허용).
const AUTH_PATH = /(^|\/)(login|logout|signin|signout|auth|oauth|callback)(\/|$)/i;
// 저장소(AsyncStorage)는 암호화되지 않으므로 인증 정보가 든 주소는 남기지 않는다.
const SENSITIVE_PARAM =
  /(^|[?&#;])(code|state|token|access_token|id_token|refresh_token|session|sessionid|sid|key|api_key|apikey|secret|password|pwd|otp|auth|authorization|jwt)=/i;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * 이어서 보기로 저장·복원해도 되는 주소인지 판정한다. 저장값도 신뢰하지 않고 복원 때 다시 확인한다.
 * 서비스 호스트(포트 포함)의 HTTPS 주소만 허용한다. allowedHosts 는 로그인용 외부 호스트라 제외한다.
 */
export function isRememberableUrl(project: ProjectEntry, url: string): boolean {
  if (url.length > MAX_URL_LENGTH) return false;
  const target = parse(url);
  const base = parse(project.url);
  if (!target || !base || target.protocol !== 'https:') return false;
  if (target.host !== base.host || target.username || target.password) return false;
  if (AUTH_PATH.test(target.pathname)) return false;
  return !SENSITIVE_PARAM.test(target.search) && !SENSITIVE_PARAM.test(target.hash);
}

export function parseLastVisit(raw: string | null): LastVisit | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const d = v as Record<string, unknown>;
    return typeof d.projectId === 'string' && typeof d.url === 'string'
      ? { projectId: d.projectId, url: d.url }
      : null;
  } catch {
    return null;
  }
}

/** 이어서 보기 대상. 프로젝트가 카탈로그에 없으면 undefined, 저장된 주소가 검증에 실패하면 첫 주소로 대체한다. */
export function resolveResume(
  projects: readonly ProjectEntry[],
  visit: LastVisit | null,
): { project: ProjectEntry; url: string } | undefined {
  if (!visit) return undefined;
  const project = findProject(projects, visit.projectId);
  if (!project) return undefined;
  return { project, url: isRememberableUrl(project, visit.url) ? visit.url : project.url };
}

/** 이어서 보기 버튼에 보여 줄 짧은 경로 설명. */
export function describeVisit(url: string): string {
  const u = parse(url);
  const label = u ? `${u.pathname}${u.search}` || '/' : '/';
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

/** 공유할 주소. 로그인·콜백 경로나 인증 정보가 든 주소는 노출하지 않도록 서비스 첫 주소로 대체한다. */
export function resolveShareUrl(project: ProjectEntry, currentUrl: string | undefined): string {
  return currentUrl && isRememberableUrl(project, currentUrl) ? currentUrl : project.url;
}

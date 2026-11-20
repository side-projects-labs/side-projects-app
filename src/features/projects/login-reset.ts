import type { ProjectEntry } from './catalog';

/**
 * 초기화 범위.
 * - service: 서비스 호스트의 쿠키만. 쿠키 저장소는 모든 프로젝트가 공유하므로 다른 프로젝트의 로그인은 건드리지 않는다.
 * - login: 서비스 호스트와 로그인에 쓰는 allowedHosts(github.com 등)까지. 소셜 로그인 세션도 지우지만 같은 호스트를 쓰는 다른 프로젝트의 로그인도 풀릴 수 있다.
 */
export type ResetScope = 'service' | 'login';

/**
 * 로그인 초기화로 쿠키를 지울 주소. 서비스 주소가 올바른 HTTPS가 아니면 아무것도 지우지 않는다.
 */
export function cookieResetUrls(project: ProjectEntry, scope: ResetScope): string[] {
  let base: URL;
  try {
    base = new URL(project.url);
  } catch {
    return [];
  }
  if (base.protocol !== 'https:') return [];
  const extra = scope === 'login' ? (project.allowedHosts ?? []) : [];
  const hosts = [base.hostname, ...extra].map((h) => h.toLowerCase());
  return [...new Set(hosts)].map((h) => `https://${h}/`);
}

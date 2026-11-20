import type { ProjectEntry } from './catalog';

/**
 * 로그인 초기화로 쿠키를 지울 주소. 서비스 호스트와 로그인에 쓰는 allowedHosts만 대상이다.
 * 서비스 주소가 올바른 HTTPS가 아니면 아무것도 지우지 않는다.
 */
export function cookieResetUrls(project: ProjectEntry): string[] {
  let base: URL;
  try {
    base = new URL(project.url);
  } catch {
    return [];
  }
  if (base.protocol !== 'https:') return [];
  const hosts = [base.hostname, ...(project.allowedHosts ?? [])].map((h) => h.toLowerCase());
  return [...new Set(hosts)].map((h) => `https://${h}/`);
}

import type { ProjectEntry } from './catalog';

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * 서비스 호스트와 카탈로그에 명시한 추가 호스트(allowedHosts, 소셜 로그인 등)만 WebView 안에서 허용한다.
 * 모두 HTTPS여야 하며, 서비스 호스트는 포트까지 같아야 한다.
 */
export function isInternalUrl(project: ProjectEntry, url: string): boolean {
  const target = parse(url);
  const base = parse(project.url);
  if (!target || !base || target.protocol !== 'https:') return false;
  if (target.host === base.host) return true;
  return !target.port && !!project.allowedHosts?.includes(target.hostname.toLowerCase());
}

/** 외부 앱/브라우저로 넘길 수 있는 URL. javascript:, file: 등은 거부한다. */
export function isExternalOpenable(url: string): boolean {
  const target = parse(url);
  return !!target && ['https:', 'mailto:', 'tel:'].includes(target.protocol);
}

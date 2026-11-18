import type { ProjectEntry } from './catalog';

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** 서비스 오리진(HTTPS)과 정확히 같은 호스트만 WebView 안에서 허용한다. */
export function isInternalUrl(project: ProjectEntry, url: string): boolean {
  const target = parse(url);
  const base = parse(project.url);
  if (!target || !base) return false;
  return target.protocol === 'https:' && target.host === base.host;
}

/** 외부 앱/브라우저로 넘길 수 있는 URL. javascript:, file: 등은 거부한다. */
export function isExternalOpenable(url: string): boolean {
  const target = parse(url);
  return !!target && ['https:', 'mailto:', 'tel:'].includes(target.protocol);
}

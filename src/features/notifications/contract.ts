/** 배포 이벤트 계약 (version=1). 워크플로/향후 알림 서버가 push data로 전달한다. */
export type DeploymentStatus = 'started' | 'succeeded' | 'failed';

export type DeploymentEvent = {
  version: 1;
  eventId: string;
  projectId: string;
  status: DeploymentStatus;
  /** 알림 탭 시 열 빌드·로그 페이지(선택). 허용된 호스트의 HTTPS만 통과한다. */
  url?: string;
};

/** 푸시 payload는 신뢰 경계 밖이므로 외부로 여는 URL은 이 호스트로 제한한다. */
const LINK_HOSTS: readonly string[] = ['github.com', 'vercel.com'];

export function parseEventUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return undefined;
    return LINK_HOSTS.includes(u.hostname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const STATUSES: readonly string[] = ['started', 'succeeded', 'failed'];

export function parseDeploymentEvent(data: unknown): DeploymentEvent | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (
    d.version !== 1 ||
    typeof d.eventId !== 'string' ||
    typeof d.projectId !== 'string' ||
    typeof d.status !== 'string' ||
    !STATUSES.includes(d.status)
  ) {
    return null;
  }
  return {
    version: 1,
    eventId: d.eventId,
    projectId: d.projectId,
    status: d.status as DeploymentStatus,
    url: parseEventUrl(d.url),
  };
}

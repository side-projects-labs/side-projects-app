/** 배포 이벤트 계약 (version=1). 워크플로/향후 알림 서버가 push data로 전달한다. */
export type DeploymentStatus = 'started' | 'succeeded' | 'failed';

export type DeploymentEvent = {
  version: 1;
  eventId: string;
  projectId: string;
  status: DeploymentStatus;
};

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
  };
}

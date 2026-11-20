import type { DeploymentStatus } from './contract';
import type { HistoryItem } from './history';

export type HistoryFilter = { projectId?: string; status?: DeploymentStatus };

/** 상태·프로젝트 필터를 함께 적용한다. 값이 없는 필터는 무시한다. */
export function filterHistory(items: readonly HistoryItem[], filter: HistoryFilter): HistoryItem[] {
  return items.filter(
    (it) =>
      (!filter.projectId || it.projectId === filter.projectId) &&
      (!filter.status || it.status === filter.status),
  );
}

/** 이력에 실제로 나온 프로젝트 id(처음 나온 순서, 중복 없음). 필터 칩 후보로 쓴다. */
export function projectsInHistory(items: readonly HistoryItem[]): string[] {
  return [...new Set(items.map((it) => it.projectId))];
}

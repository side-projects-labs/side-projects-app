import type { ProjectEntry } from './catalog';

/** 고정(즐겨찾기)한 프로젝트 id 목록. 배열 순서가 목록에 보이는 순서다. */
export type PinnedIds = string[];

export function togglePin(ids: readonly string[], id: string): PinnedIds {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** 고정한 프로젝트를 한 칸 위/아래로 옮긴다. 고정하지 않았거나 끝에 있으면 그대로 둔다. */
export function movePinned(ids: readonly string[], id: string, dir: 'up' | 'down'): PinnedIds {
  const from = ids.indexOf(id);
  const to = dir === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 고정한 프로젝트를 고정 순서대로 위에, 나머지는 원래 순서로 아래에 둔다. 카탈로그에 없는 id는 무시한다. */
export function sortProjects(
  projects: readonly ProjectEntry[],
  pinned: readonly string[],
): ProjectEntry[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const top = pinned.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
  const topIds = new Set(top.map((p) => p.id));
  return [...top, ...projects.filter((p) => !topIds.has(p.id))];
}

/** 카탈로그에 있는 id만, 중복 없이 남긴다. */
export function sanitizePinned(ids: readonly string[], projects: readonly ProjectEntry[]): PinnedIds {
  const known = new Set(projects.map((p) => p.id));
  return [...new Set(ids)].filter((id) => known.has(id));
}

/** 저장된 JSON을 신뢰하지 않고 문자열 배열만 꺼낸다. */
export function parsePinned(raw: string | null): PinnedIds {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

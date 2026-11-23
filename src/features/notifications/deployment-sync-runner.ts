import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  collectDeploymentItems,
  dedupeAgainst,
  eventIdOf,
  isValidRepo,
  shouldSync,
  type SyncCache,
  type SyncProject,
  type SyncStatus,
} from './deployment-sync';
import { addHistory, loadHistory } from './history';

// 저장 형식이 바뀌면 버전을 올린다.
const KEY = 'deployment-sync-v1';
const STATES: readonly string[] = ['success', 'failure', 'error'];

export type SyncRunState = { lastSyncAt: number | undefined; cache: SyncCache };

const EMPTY = (): SyncRunState => ({ lastSyncAt: undefined, cache: { final: {} } });

function isStatus(v: unknown): v is SyncStatus {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.state === 'string' && STATES.includes(d.state) && typeof d.at === 'number' && Number.isFinite(d.at);
}

/** 저장된 동기화 상태를 읽는다. 없거나 손상됐으면 빈 상태로 대체하고, 형식이 틀린 항목은 버린다. */
export async function loadSyncState(): Promise<SyncRunState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return EMPTY();
    const d = parsed as { lastSyncAt?: unknown; final?: unknown };
    const lastSyncAt = typeof d.lastSyncAt === 'number' && Number.isFinite(d.lastSyncAt) ? d.lastSyncAt : undefined;
    const final: SyncCache['final'] = {};
    if (d.final && typeof d.final === 'object') {
      for (const [key, value] of Object.entries(d.final)) if (isStatus(value)) final[key] = value;
    }
    return { lastSyncAt, cache: { final } };
  } catch {
    return EMPTY();
  }
}

async function saveSyncState(state: SyncRunState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ lastSyncAt: state.lastSyncAt, final: state.cache.final }));
  } catch {
    // 저장에 실패하면 다음 실행에서 다시 조회할 뿐이라 무시한다.
  }
}

// 마운트와 앱 활성화가 겹쳐도 같은 요청을 두 번 보내지 않는다.
let running = false;

/**
 * 카탈로그의 저장소에서 최근 배포를 읽어 이력에 보충한다. 간격(15분) 안이거나 대상이 없으면 아무것도 하지 않는다.
 * 요청이 실패해도 간격은 소비한다. 그래야 오프라인이나 요청 한도 상황에서 앱을 열 때마다 반복 요청하지 않는다.
 * 사용자가 지운 항목은 `addHistory`가 기억한 id로 걸러져 되살아나지 않는다.
 */
export async function runDeploymentSync(
  projects: readonly SyncProject[],
  deps: { now?: () => number; fetchImpl?: typeof fetch } = {},
): Promise<'synced' | 'skipped'> {
  if (running) return 'skipped';
  const targets = projects.filter((p) => isValidRepo(p.repo));
  if (targets.length === 0) return 'skipped';

  running = true;
  try {
    const now = (deps.now ?? Date.now)();
    const state = await loadSyncState();
    if (!shouldSync(state.lastSyncAt, now)) return 'skipped';

    const { items, cache } = await collectDeploymentItems(targets, state.cache, deps.fetchImpl ?? fetch);
    await addHistory(dedupeAgainst(await loadHistory(), items));
    await saveSyncState({ lastSyncAt: now, cache });
    return 'synced';
  } finally {
    running = false;
  }
}

/**
 * 동기화로 알게 된 배포의 eventId 목록. "기록 지우기"가 이 id도 함께 기억하게 해, 이력이 50건으로 잘려 저장되지 못한
 * 동기화 항목이 지운 뒤 다음 동기화에서 되살아나지 않게 한다.
 */
export async function syncedEventIds(): Promise<string[]> {
  const { cache } = await loadSyncState();
  return Object.entries(cache.final).flatMap(([key, status]) => {
    const split = key.lastIndexOf('#');
    const id = Number(key.slice(split + 1));
    if (split <= 0 || !Number.isInteger(id)) return [];
    return [eventIdOf(key.slice(0, split), id, status.state)];
  });
}

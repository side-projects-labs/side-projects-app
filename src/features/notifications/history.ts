import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';

import { parseDeploymentEvent, type DeploymentStatus } from './contract';

const KEY = 'deployment-history-v1';
const DELETED_KEY = 'deleted-event-ids-v1';
const MAX_ITEMS = 50;
// 지운 항목이 알림 센터 동기화로 되살아나지 않도록 id를 기억한다. 무한히 쌓이지 않게 최근 것만 남긴다.
// 기록 지우기는 동기화 캐시 id(최대 200건)와 이력(최대 50건)을 한꺼번에 넣으므로, 이전에 지운 id가 밀려나지 않게 여유를 둔다.
export const MAX_DELETED = 500;

/** 기기에서 본 배포 알림 한 건. 서버가 없어 이 기기가 받은 알림만 남는다. */
export type HistoryItem = {
  eventId: string;
  projectId: string;
  status: DeploymentStatus;
  title: string;
  body: string;
  receivedAt: number;
};

/** expo-notifications의 date는 초 또는 밀리초일 수 있어 값 크기로 구분한다. */
function toMillis(date: number): number {
  return date < 1e12 ? date * 1000 : date;
}

export function toHistoryItem(n: Notifications.Notification): HistoryItem | null {
  const content = n.request.content;
  const event = parseDeploymentEvent(content.data);
  if (!event) return null;
  return {
    eventId: event.eventId,
    projectId: event.projectId,
    status: event.status,
    title: content.title ?? '',
    body: content.body ?? '',
    receivedAt: toMillis(n.date) || Date.now(),
  };
}

function isItem(v: unknown): v is HistoryItem {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.eventId === 'string' &&
    typeof d.projectId === 'string' &&
    typeof d.status === 'string' &&
    typeof d.title === 'string' &&
    typeof d.body === 'string' &&
    typeof d.receivedAt === 'number'
  );
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

// 읽기-수정-쓰기가 겹쳐 항목이 사라지지 않도록 쓰기를 한 줄로 세운다.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function loadDeletedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

async function saveDeletedIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(ids)].slice(-MAX_DELETED)));
  } catch {
    // 저장 실패 시 삭제한 항목이 다시 보일 수 있을 뿐이라 무시한다.
  }
}

async function saveItems(items: HistoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // 저장 실패는 이력 기능만 잃을 뿐이라 무시한다.
  }
}

/** 같은 eventId는 한 번만 남기고(최신 값 유지), 최근 순으로 최대 50건만 저장한다. 사용자가 지운 항목은 넣지 않는다. */
export function addHistory(items: HistoryItem[]): Promise<void> {
  if (items.length === 0) return Promise.resolve();
  return enqueue(async () => {
    const deleted = new Set(await loadDeletedIds());
    const fresh = items.filter((it) => !deleted.has(it.eventId));
    if (fresh.length === 0) return;
    const byId = new Map<string, HistoryItem>();
    for (const it of [...(await loadHistory()), ...fresh]) byId.set(it.eventId, it);
    const merged = [...byId.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAX_ITEMS);
    await saveItems(merged);
  });
}

/** 한 건을 지우고, 알림 센터에서 다시 가져와도 되살아나지 않게 id를 기억한다. */
export function removeHistory(eventId: string): Promise<void> {
  return enqueue(async () => {
    await saveItems((await loadHistory()).filter((it) => it.eventId !== eventId));
    await saveDeletedIds([...(await loadDeletedIds()), eventId]);
  });
}

/**
 * 전체 삭제. 지금 이력에 있던 항목과 `alsoForget`(알림 센터에 있지만 아직 이력에 없는 알림의 eventId)은
 * 알림 센터 동기화로 되살아나지 않게 id를 기억한다.
 */
export function clearHistory(alsoForget: readonly string[] = []): Promise<void> {
  return enqueue(async () => {
    const ids = (await loadHistory()).map((it) => it.eventId);
    await saveDeletedIds([...(await loadDeletedIds()), ...ids, ...alsoForget]);
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // 무시
    }
  });
}

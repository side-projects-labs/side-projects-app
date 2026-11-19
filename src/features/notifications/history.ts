import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Notifications from 'expo-notifications';

import { parseDeploymentEvent, type DeploymentStatus } from './contract';

const KEY = 'deployment-history-v1';
const MAX_ITEMS = 50;

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

/** 같은 eventId는 한 번만 남기고(최신 값 유지), 최근 순으로 최대 50건만 저장한다. */
export function addHistory(items: HistoryItem[]): Promise<void> {
  if (items.length === 0) return Promise.resolve();
  return enqueue(async () => {
    const byId = new Map<string, HistoryItem>();
    for (const it of [...(await loadHistory()), ...items]) byId.set(it.eventId, it);
    const merged = [...byId.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAX_ITEMS);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(merged));
    } catch {
      // 저장 실패는 이력 기능만 잃을 뿐이라 무시한다.
    }
  });
}

export function clearHistory(): Promise<void> {
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // 무시
    }
  });
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addHistory, clearHistory, loadHistory, type HistoryItem } from './history';

// vi.mock 은 import 보다 먼저 실행되도록 vitest 가 끌어올린다.
const store = new Map<string, string>();
const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const item = (n: number, over: Partial<HistoryItem> = {}): HistoryItem => ({
  eventId: `e${n}`,
  projectId: 'p',
  status: 'succeeded',
  title: 't',
  body: 'b',
  receivedAt: n,
  ...over,
});

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  storage.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  storage.setItem.mockImplementation(async (k: string, v: string) => void store.set(k, v));
  storage.removeItem.mockImplementation(async (k: string) => void store.delete(k));
});

describe('이력 저장', () => {
  it('최근 순으로 저장한다', async () => {
    await addHistory([item(1), item(3), item(2)]);
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e3', 'e2', 'e1']);
  });

  it('같은 eventId 는 한 건으로 합치고 최신 값을 남긴다', async () => {
    await addHistory([item(1, { title: 'old' })]);
    await addHistory([item(1, { title: 'new' })]);
    const list = await loadHistory();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('new');
  });

  it('최대 50건만 유지하고 오래된 것부터 버린다', async () => {
    await addHistory(Array.from({ length: 60 }, (_, i) => item(i + 1)));
    const list = await loadHistory();
    expect(list).toHaveLength(50);
    expect(list[0].eventId).toBe('e60');
    expect(list.at(-1)?.eventId).toBe('e11');
  });

  it('빈 입력은 저장소를 건드리지 않는다', async () => {
    await addHistory([]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('동시에 호출해도 항목이 사라지지 않는다', async () => {
    await Promise.all([addHistory([item(1)]), addHistory([item(2)]), addHistory([item(3)])]);
    expect((await loadHistory()).map((i) => i.eventId).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('기록 지우기', async () => {
    await addHistory([item(1)]);
    await clearHistory();
    expect(await loadHistory()).toEqual([]);
  });
});

describe('손상된 저장값', () => {
  it.each([['JSON 아님', '{{{'], ['배열 아님', '{"a":1}']])('%s 는 빈 목록으로 처리한다', async (_n, raw) => {
    store.set('deployment-history-v1', raw);
    expect(await loadHistory()).toEqual([]);
  });

  it('형식이 맞지 않는 항목은 걸러낸다', async () => {
    store.set('deployment-history-v1', JSON.stringify([item(1), { eventId: 1 }, null, 'x']));
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e1']);
  });

  it('저장소 읽기 오류는 빈 목록으로 처리한다', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('boom'));
    expect(await loadHistory()).toEqual([]);
  });

  it('저장소 쓰기 오류는 던지지 않는다', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('full'));
    await expect(addHistory([item(1)])).resolves.toBeUndefined();
  });
});

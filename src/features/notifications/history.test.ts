import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_DELETED, addHistory, clearHistory, loadHistory, removeHistory, subscribeHistory, type HistoryItem } from './history';

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

describe('개별 삭제', () => {
  it('지정한 항목만 지운다', async () => {
    await addHistory([item(1), item(2), item(3)]);
    await removeHistory('e2');
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e3', 'e1']);
  });

  it('지운 항목은 알림 센터 동기화로 다시 들어와도 되살아나지 않는다', async () => {
    await addHistory([item(1), item(2)]);
    await removeHistory('e1');
    await addHistory([item(1), item(3)]); // 앱이 열릴 때 알림 센터에서 다시 가져오는 상황
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e3', 'e2']);
  });

  it('기록 지우기 뒤에도 지운 항목은 되살아나지 않는다', async () => {
    await addHistory([item(1), item(2)]);
    await clearHistory();
    await addHistory([item(1), item(2), item(3)]);
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e3']);
  });

  it('기록 지우기 때 넘긴 id(알림 센터에만 있던 알림)도 되살아나지 않는다', async () => {
    await addHistory([item(1)]);
    await clearHistory(['e9']);
    await addHistory([item(9), item(10)]);
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e10']);
  });

  it('지운 id 기록은 상한을 넘으면 오래된 것부터 버린다', async () => {
    const second = MAX_DELETED - 40; // 처음 50건과 합치면 상한을 10건 넘는다
    await addHistory(Array.from({ length: 50 }, (_, i) => item(i + 1)));
    for (let i = 1; i <= 50; i++) await removeHistory(`e${i}`);
    await addHistory(Array.from({ length: second }, (_, i) => item(1000 + i)));
    for (let i = 0; i < second; i++) await removeHistory(`e${1000 + i}`);
    // 가장 오래전에 지운 e1 은 상한 밖으로 밀려나 다시 들어올 수 있다
    await addHistory([item(1), item(2000)]);
    const ids = (await loadHistory()).map((i) => i.eventId);
    expect(ids).toContain('e2000');
    expect(ids).toContain('e1');
    // 최근에 지운 항목은 계속 막는다
    const last = `e${1000 + second - 1}`;
    await addHistory([item(1000 + second - 1)]);
    expect((await loadHistory()).map((i) => i.eventId)).not.toContain(last);
  });

  it('기록 지우기가 동기화 id를 한꺼번에 넣어도 이전에 지운 id가 밀려나지 않는다', async () => {
    // 동기화 캐시 id(최대 200건)와 이력(최대 50건)을 함께 넣는 가장 큰 경우를 가정한다
    store.set('deleted-event-ids-v1', JSON.stringify(Array.from({ length: 100 }, (_, i) => `old-${i}`)));
    await addHistory(Array.from({ length: 50 }, (_, i) => item(i + 1)));

    await clearHistory(Array.from({ length: 200 }, (_, i) => `sync-${i}`));

    const deleted: string[] = JSON.parse(store.get('deleted-event-ids-v1') ?? '[]');
    expect(deleted).toContain('old-0');
    expect(deleted).toContain('e1');
    expect(deleted).toContain('sync-0');
    expect(deleted).toContain('sync-199');
    expect(deleted).toHaveLength(350);
  });

  it('없는 id 를 지워도 던지지 않는다', async () => {
    await expect(removeHistory('nope')).resolves.toBeUndefined();
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

describe('이력 변경 알림', () => {
  it('이력을 추가하면 저장이 끝난 뒤에 구독자에게 알린다', async () => {
    let seen: string[] = [];
    const listener = vi.fn(async () => {
      seen = (await loadHistory()).map((i) => i.eventId);
    });
    const unsubscribe = subscribeHistory(() => void listener());

    await addHistory([item(1), item(2)]);
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(seen.sort()).toEqual(['e1', 'e2']));
    unsubscribe();
  });

  it('추가할 것이 없거나 모두 지운 항목이면 알리지 않는다', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHistory(listener);
    await addHistory([item(1)]);
    await removeHistory('e1');
    listener.mockClear();

    await addHistory([]);
    await addHistory([item(1)]); // 지운 id라 추가되지 않는다

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('한 건 삭제와 전체 삭제도 알린다', async () => {
    await addHistory([item(1), item(2)]);
    const listener = vi.fn();
    const unsubscribe = subscribeHistory(listener);

    await removeHistory('e1');
    expect(listener).toHaveBeenCalledTimes(1);
    await clearHistory();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('구독을 해제하면 더 알리지 않는다', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHistory(listener);
    unsubscribe();

    await addHistory([item(1)]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('구독자가 여러 명이면 모두에게 알린다', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeHistory(a);
    const offB = subscribeHistory(b);

    await addHistory([item(1)]);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it('구독자가 예외를 던져도 다른 구독자와 이력 저장은 영향받지 않는다', async () => {
    const bad = vi.fn(() => {
      throw new Error('listener failed');
    });
    const good = vi.fn();
    const offBad = subscribeHistory(bad);
    const offGood = subscribeHistory(good);

    await expect(addHistory([item(1)])).resolves.toBeUndefined();

    expect(good).toHaveBeenCalledTimes(1);
    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['e1']);
    offBad();
    offGood();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addHistory, clearHistory, loadHistory, removeHistory, type HistoryItem } from './history';
import { loadSyncState, runDeploymentSync, syncedEventIds } from './deployment-sync-runner';

const store = new Map<string, string>();
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const REPO = 'side-projects-labs/jobs-scrap-dashboard';
const PROJECTS = [{ id: 'jobs-scrap-dashboard', repo: REPO }];
const NOW = Date.parse('2026-11-23T12:00:00Z');
const MIN = 60_000;
const SYNC_KEY = 'deployment-sync-v1';

const response = (body: unknown, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });

/** 배포 하나(성공)를 돌려주는 가짜 GitHub. */
function fakeGithub(over: { deploymentId?: number; at?: string } = {}) {
  const id = over.deploymentId ?? 7;
  return vi.fn(async (url: string) => {
    if (url.includes('/statuses')) return response([{ state: 'success', created_at: over.at ?? '2026-11-23T10:02:00Z' }]);
    return response([{ id, ref: 'a'.repeat(40), environment: 'Production', created_at: '2026-11-23T10:00:00Z' }]);
  });
}

const run = (fetchImpl: ReturnType<typeof vi.fn>, now = NOW) =>
  runDeploymentSync(PROJECTS, { now: () => now, fetchImpl: fetchImpl as unknown as typeof fetch });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  storage.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  storage.setItem.mockImplementation(async (k: string, v: string) => void store.set(k, v));
  storage.removeItem.mockImplementation(async (k: string) => void store.delete(k));
});

describe('loadSyncState', () => {
  it('저장된 값이 없으면 빈 상태다', async () => {
    expect(await loadSyncState()).toEqual({ lastSyncAt: undefined, cache: { final: {} } });
  });

  it('손상된 저장값은 빈 상태로 대체한다', async () => {
    store.set(SYNC_KEY, '{not json');
    expect(await loadSyncState()).toEqual({ lastSyncAt: undefined, cache: { final: {} } });
  });

  it('형식이 틀린 항목은 버리고 올바른 항목만 남긴다', async () => {
    store.set(
      SYNC_KEY,
      JSON.stringify({
        lastSyncAt: 5,
        final: {
          'a/b#1': { state: 'success', at: 10 },
          'a/b#2': { state: 'weird', at: 10 },
          'a/b#3': { state: 'failure', at: 'x' },
          'a/b#4': 'nope',
        },
      }),
    );
    expect(await loadSyncState()).toEqual({ lastSyncAt: 5, cache: { final: { 'a/b#1': { state: 'success', at: 10 } } } });
  });
});

describe('runDeploymentSync', () => {
  it('동기화 간격 안이면 요청하지 않는다', async () => {
    store.set(SYNC_KEY, JSON.stringify({ lastSyncAt: NOW - 5 * MIN, final: {} }));
    const fetchImpl = fakeGithub();

    expect(await run(fetchImpl)).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('GitHub 기록을 이력에 추가하고 마지막 동기화 시각과 캐시를 저장한다', async () => {
    expect(await run(fakeGithub())).toBe('synced');

    const history = await loadHistory();
    expect(history.map((i) => i.eventId)).toEqual([`${REPO}-deployment-7-success`]);
    const saved = JSON.parse(store.get(SYNC_KEY) ?? '{}');
    expect(saved.lastSyncAt).toBe(NOW);
    expect(Object.keys(saved.final)).toEqual([`${REPO}#7`]);
  });

  it('알림으로 이미 받은 같은 배포(같은 eventId)는 한 건으로 남는다', async () => {
    const pushed: HistoryItem = {
      eventId: `${REPO}-deployment-7-success`,
      projectId: 'jobs-scrap-dashboard',
      status: 'succeeded',
      title: '✅ 배포 완료',
      body: 'jobs-scrap-dashboard · aaaaaaa',
      receivedAt: Date.parse('2026-11-23T10:02:30Z'),
    };
    await addHistory([pushed]);

    await run(fakeGithub());

    expect(await loadHistory()).toHaveLength(1);
  });

  it('eventId 규칙이 달라도 같은 프로젝트·상태가 가까운 시각에 있으면 중복으로 보지 않는다', async () => {
    await addHistory([
      {
        eventId: 'side-projects-labs/jobs-scrap-dashboard-999-1-succeeded',
        projectId: 'jobs-scrap-dashboard',
        status: 'succeeded',
        title: '✅ 배포 완료',
        body: 'x',
        receivedAt: Date.parse('2026-11-23T10:05:00Z'),
      },
    ]);

    await run(fakeGithub());

    expect(await loadHistory()).toHaveLength(1);
  });

  it('사용자가 지운 항목은 동기화해도 되살아나지 않는다', async () => {
    await run(fakeGithub());
    await removeHistory(`${REPO}-deployment-7-success`);

    await run(fakeGithub(), NOW + 30 * MIN);

    expect(await loadHistory()).toEqual([]);
  });

  it('요청이 실패해도 예외 없이 끝나고 기존 이력은 그대로며 다음 시도는 간격 뒤로 미룬다', async () => {
    await addHistory([
      { eventId: 'keep', projectId: 'p', status: 'failed', title: 't', body: 'b', receivedAt: 1 },
    ]);
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(run(failing)).resolves.toBe('synced');

    expect((await loadHistory()).map((i) => i.eventId)).toEqual(['keep']);
    expect(JSON.parse(store.get(SYNC_KEY) ?? '{}').lastSyncAt).toBe(NOW);
  });

  it('동시에 두 번 호출해도 한 번만 요청한다', async () => {
    const fetchImpl = fakeGithub();

    const [a, b] = await Promise.all([run(fetchImpl), run(fetchImpl)]);

    expect([a, b].sort()).toEqual(['skipped', 'synced']);
    const listCalls = fetchImpl.mock.calls.filter(([u]) => !String(u).includes('/statuses'));
    expect(listCalls).toHaveLength(1);
  });

  it('기록 지우기 뒤에는 이력이 50건으로 잘려 나갔던 동기화 항목도 되살아나지 않는다', async () => {
    // 최근 항목 50건이 이력을 채워 오래된 동기화 항목(10시 배포)은 저장되지 않는다.
    const recent = Array.from({ length: 50 }, (_, i): HistoryItem => ({
      eventId: `recent-${i}`,
      projectId: 'other',
      status: 'succeeded',
      title: 't',
      body: 'b',
      receivedAt: NOW + (i + 1) * MIN,
    }));
    await addHistory(recent);
    await run(fakeGithub());
    expect((await loadHistory()).some((i) => i.eventId.includes('-deployment-7-'))).toBe(false);

    // 화면의 "기록 지우기"와 같은 순서: 동기화로 알게 된 id도 함께 기억하고 지운다.
    await clearHistory(await syncedEventIds());
    await run(fakeGithub(), NOW + 30 * MIN);

    expect(await loadHistory()).toEqual([]);
  });

  it('저장소가 없는 프로젝트뿐이면 요청하지 않는다', async () => {
    const fetchImpl = fakeGithub();

    await runDeploymentSync([{ id: 'x' }], { now: () => NOW, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('syncedEventIds', () => {
  it('저장된 확정 상태 캐시에서 이력 항목과 같은 eventId를 만든다', async () => {
    store.set(
      SYNC_KEY,
      JSON.stringify({
        lastSyncAt: NOW,
        final: {
          [`${REPO}#7`]: { state: 'success', at: 1 },
          [`${REPO}#8`]: { state: 'failure', at: 2 },
        },
      }),
    );

    expect(await syncedEventIds()).toEqual([`${REPO}-deployment-7-success`, `${REPO}-deployment-8-failure`]);
  });

  it('저장된 값이 없거나 손상됐으면 빈 목록이다', async () => {
    expect(await syncedEventIds()).toEqual([]);
    store.set(SYNC_KEY, '{broken');
    expect(await syncedEventIds()).toEqual([]);
  });

  it('id를 정수로 읽을 수 없는 캐시 키는 건너뛴다', async () => {
    store.set(SYNC_KEY, JSON.stringify({ final: { 'a/b#x': { state: 'success', at: 1 }, 'noseparator': { state: 'success', at: 1 } } }));
    expect(await syncedEventIds()).toEqual([]);
  });
});

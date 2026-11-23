import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  collectDeploymentItems,
  dedupeAgainst,
  eventIdOf,
  isValidRepo,
  parseDeployments,
  parseLatestStatus,
  shouldSync,
  toSyncedItem,
  type SyncCache,
} from './deployment-sync';
import type { HistoryItem } from './history';

const REPO = 'side-projects-labs/jobs-scrap-dashboard';
const MIN = 60_000;

const deployment = (over: Record<string, unknown> = {}) => ({
  id: 101,
  ref: 'a'.repeat(40),
  environment: 'Production',
  created_at: '2026-11-23T10:00:00Z',
  ...over,
});

const status = (state: string, at = '2026-11-23T10:02:00Z') => ({ state, created_at: at });

describe('isValidRepo', () => {
  it.each(['side-projects-labs/portfolio-admin', 'a/b', 'My_Org/repo.name-1'])('올바른 저장소 이름(%s)을 받는다', (repo) => {
    expect(isValidRepo(repo)).toBe(true);
  });

  it.each(['', 'a', 'a/b/c', '../x', 'a/../b', 'a b/c', 'a/b?x=1', 'a/b#c', '/a/b', 'a/', 5, undefined, null])(
    '경로를 바꿀 수 있거나 형식이 틀린 값(%s)은 거절한다',
    (repo) => {
      expect(isValidRepo(repo)).toBe(false);
    },
  );
});

describe('parseDeployments', () => {
  it('Production 환경만 남기고 Preview는 버린다', () => {
    const list = parseDeployments([
      deployment({ id: 1, environment: 'Preview' }),
      deployment({ id: 2, environment: 'Production' }),
      deployment({ id: 3, environment: 'Production – app' }),
    ]);
    expect(list.map((d) => d.id)).toEqual([2, 3]);
  });

  it('id가 정수가 아니거나 ref·생성 시각이 올바르지 않은 항목은 버린다', () => {
    const list = parseDeployments([
      deployment({ id: '5' }),
      deployment({ id: 1.5 }),
      deployment({ ref: 7 }),
      deployment({ created_at: 'not-a-date' }),
      deployment({ id: 9 }),
    ]);
    expect(list.map((d) => d.id)).toEqual([9]);
  });

  it.each([null, undefined, {}, 'x', 3])('배열이 아니면(%s) 빈 목록이다', (data) => {
    expect(parseDeployments(data)).toEqual([]);
  });

  it('최근 5건까지만 남긴다', () => {
    const many = Array.from({ length: 12 }, (_, i) => deployment({ id: 100 + i }));
    expect(parseDeployments(many)).toHaveLength(5);
  });
});

describe('parseLatestStatus', () => {
  it.each(['success', 'failure', 'error'])('가장 최근 상태가 확정 상태(%s)면 상태와 시각을 돌려준다', (state) => {
    expect(parseLatestStatus([status(state, '2026-11-23T10:02:00Z'), status('in_progress')])).toEqual({
      state,
      at: Date.parse('2026-11-23T10:02:00Z'),
    });
  });

  it('이후 배포로 inactive가 덧붙었어도 그 전의 확정 상태를 돌려준다', () => {
    expect(parseLatestStatus([status('inactive', '2026-11-23T11:00:00Z'), status('success', '2026-11-23T10:02:00Z')])).toEqual({
      state: 'success',
      at: Date.parse('2026-11-23T10:02:00Z'),
    });
  });

  it('더 최근의 확정 상태가 있으면 그것을 쓴다', () => {
    expect(parseLatestStatus([status('success', '2026-11-23T10:05:00Z'), status('failure', '2026-11-23T10:02:00Z')])?.state).toBe('success');
  });

  it('확정 상태가 하나도 없으면 null이다', () => {
    expect(parseLatestStatus([status('in_progress'), status('queued'), status('pending')])).toBeNull();
  });

  it.each(['in_progress', 'queued', 'pending', 'inactive'])('아직 끝나지 않은 상태(%s)는 null이다', (state) => {
    expect(parseLatestStatus([status(state)])).toBeNull();
  });

  it.each([[], null, undefined, {}, [null], [{}], [status('success', 'bad-date')]])('판단할 수 없는 값(%j)은 null이다', (data) => {
    expect(parseLatestStatus(data)).toBeNull();
  });
});

describe('eventIdOf', () => {
  it('푸시 알림과 같은 <레포>-deployment-<id>-<상태> 형식이다', () => {
    expect(eventIdOf('side-projects-labs/portfolio-api', 7995323926, 'success')).toBe(
      'side-projects-labs/portfolio-api-deployment-7995323926-success',
    );
  });
});

describe('toSyncedItem', () => {
  const d = { id: 101, ref: 'a'.repeat(40), createdAt: Date.parse('2026-11-23T10:00:00Z') };

  it('성공은 푸시 알림과 같은 eventId·제목·본문으로 만든다', () => {
    expect(toSyncedItem(REPO, 'jobs-scrap-dashboard', d, { state: 'success', at: 5_000 })).toEqual({
      eventId: `${REPO}-deployment-101-success`,
      projectId: 'jobs-scrap-dashboard',
      status: 'succeeded',
      title: '✅ 배포 완료',
      body: 'jobs-scrap-dashboard · aaaaaaa',
      receivedAt: 5_000,
    });
  });

  it.each(['failure', 'error'])('%s는 실패로 만들고 eventId에는 원래 상태를 쓴다', (state) => {
    const item = toSyncedItem(REPO, 'p', d, { state: state as 'failure' | 'error', at: 1 });
    expect(item.status).toBe('failed');
    expect(item.title).toBe('❌ 배포 실패');
    expect(item.eventId).toBe(`${REPO}-deployment-101-${state}`);
  });

  it('40자 해시가 아닌 ref는 그대로 쓰되 40자로 자른다', () => {
    const item = toSyncedItem(REPO, 'p', { ...d, ref: 'x'.repeat(60) }, { state: 'success', at: 1 });
    expect(item.body).toBe(`p · ${'x'.repeat(40)}`);
  });
});

describe('dedupeAgainst', () => {
  const base: HistoryItem = {
    eventId: 'run-1',
    projectId: 'portfolio-admin',
    status: 'succeeded',
    title: '✅ 배포 완료',
    body: 'portfolio-admin · abc1234',
    receivedAt: 1_000_000,
  };
  const synced = (over: Partial<HistoryItem> = {}): HistoryItem => ({ ...base, eventId: 'deployment-1-success', ...over });
  const base2 = (eventId: string, receivedAt: number): HistoryItem => ({ ...base, eventId, receivedAt });

  it('같은 프로젝트·상태가 15분 안에 이미 있으면 같은 배포로 보고 버린다', () => {
    expect(dedupeAgainst([base], [synced({ receivedAt: base.receivedAt + 14 * MIN })])).toEqual([]);
  });

  it('15분을 넘으면 다른 배포로 본다', () => {
    const s = synced({ receivedAt: base.receivedAt + 16 * MIN });
    expect(dedupeAgainst([base], [s])).toEqual([s]);
  });

  it('상태가 다르거나 프로젝트가 다르면 남긴다', () => {
    const a = synced({ status: 'failed' });
    const b = synced({ projectId: 'other' });
    expect(dedupeAgainst([base], [a, b])).toEqual([a, b]);
  });

  it('eventId로 정확히 합쳐지는 배포 기록은 시간이 가깝다는 이유로 버리지 않는다(15분 안의 연속 배포)', () => {
    const prev = base2('owner/repo-deployment-1-success', base.receivedAt);
    const next = base2('owner/repo-deployment-2-success', base.receivedAt + 5 * MIN);
    expect(dedupeAgainst([prev], [next])).toEqual([next]);
  });

  it('이력이 비어 있으면 그대로 돌려준다', () => {
    const s = synced();
    expect(dedupeAgainst([], [s])).toEqual([s]);
  });
});

describe('shouldSync', () => {
  const now = 10_000_000;

  it('한 번도 동기화하지 않았으면 한다', () => {
    expect(shouldSync(undefined, now)).toBe(true);
  });

  it('15분이 지나기 전에는 하지 않는다', () => {
    expect(shouldSync(now - 14 * MIN, now)).toBe(false);
  });

  it('15분이 지나면 한다', () => {
    expect(shouldSync(now - 15 * MIN, now)).toBe(true);
  });

  it('기록된 시각이 미래면(시계 변경) 멈추지 않고 한다', () => {
    expect(shouldSync(now + 60 * MIN, now)).toBe(true);
  });
});

describe('collectDeploymentItems', () => {
  const fetchImpl = vi.fn();
  const emptyCache = (): SyncCache => ({ final: {} });
  const response = (body: unknown, httpStatus = 200, headers: Record<string, string> = {}) => ({
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const route = (table: Record<string, unknown | (() => unknown)>) => {
    fetchImpl.mockImplementation(async (url: string) => {
      for (const [needle, value] of Object.entries(table)) {
        if (url.includes(needle)) return typeof value === 'function' ? (value as () => unknown)() : response(value);
      }
      return response([], 404);
    });
  };

  const run = (projects: { id: string; repo?: string }[], cache = emptyCache()) =>
    collectDeploymentItems(projects, cache, fetchImpl as unknown as typeof fetch);

  it('프로젝트의 Production 배포와 최종 상태를 이력 항목으로 만든다', async () => {
    route({
      [`/repos/${REPO}/deployments?`]: [deployment({ id: 7 }), deployment({ id: 8, environment: 'Preview' })],
      [`/deployments/7/statuses`]: [status('success')],
    });

    const { items } = await run([{ id: 'jobs-scrap-dashboard', repo: REPO }]);

    expect(items.map((i) => i.eventId)).toEqual([`${REPO}-deployment-7-success`]);
    expect(items[0].status).toBe('succeeded');
  });

  it('요청은 GitHub API의 지정된 경로로만 가고 비밀 값을 보내지 않는다', async () => {
    route({ '/deployments?': [] });

    await run([{ id: 'x', repo: REPO }]);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith(`https://api.github.com/repos/${REPO}/deployments?`)).toBe(true);
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it('이미 확정된 배포의 상태는 다시 조회하지 않는다', async () => {
    const cache: SyncCache = { final: { [`${REPO}#7`]: { state: 'success', at: 1_000 } } };
    route({ '/deployments?': [deployment({ id: 7 })] });

    const { items } = await run([{ id: 'p', repo: REPO }], cache);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(items.map((i) => i.eventId)).toEqual([`${REPO}-deployment-7-success`]);
  });

  it('새로 확정된 상태는 캐시에 남기고, 진행 중인 배포는 남기지 않는다', async () => {
    route({
      '/deployments?': [deployment({ id: 1 }), deployment({ id: 2 })],
      '/deployments/1/statuses': [status('failure')],
      '/deployments/2/statuses': [status('in_progress')],
    });

    const { items, cache } = await run([{ id: 'p', repo: REPO }]);

    expect(items.map((i) => i.status)).toEqual(['failed']);
    expect(Object.keys(cache.final)).toEqual([`${REPO}#1`]);
  });

  it('repo가 없거나 형식이 틀린 프로젝트는 요청하지 않는다', async () => {
    const { items } = await run([{ id: 'a' }, { id: 'b', repo: '../etc/passwd' }, { id: 'c', repo: 'x/y/z' }]);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });

  it('한 프로젝트의 응답이 비정상이면 그 프로젝트만 건너뛴다', async () => {
    route({
      '/repos/o/bad/deployments?': () => response({ message: 'Not Found' }, 404),
      '/repos/o/good/deployments?': [deployment({ id: 3 })],
      '/deployments/3/statuses': [status('success')],
    });

    const { items } = await run([
      { id: 'bad', repo: 'o/bad' },
      { id: 'good', repo: 'o/good' },
    ]);

    expect(items.map((i) => i.projectId)).toEqual(['good']);
  });

  it.each([
    ['429', 429, {}],
    ['403 + x-ratelimit-remaining: 0', 403, { 'x-ratelimit-remaining': '0' }],
    ['403 + retry-after(보조 한도)', 403, { 'retry-after': '60' }],
  ])('요청 한도(%s)에 걸리면 남은 요청을 보내지 않고 지금까지의 결과를 돌려준다', async (_name, httpStatus, headers) => {
    route({
      '/repos/o/a/deployments?': [deployment({ id: 1 })],
      '/deployments/1/statuses': () => response({ message: 'rate limit' }, httpStatus, headers),
      '/repos/o/b/deployments?': [deployment({ id: 2 })],
    });

    const { items } = await run([
      { id: 'a', repo: 'o/a' },
      { id: 'b', repo: 'o/b' },
    ]);

    expect(items).toEqual([]);
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('/repos/o/b/'))).toBe(false);
  });

  it('요청 한도와 무관한 403(접근 차단 등)은 그 저장소만 건너뛰고 다음 저장소를 계속 조회한다', async () => {
    route({
      '/repos/o/blocked/deployments?': () => response({ message: 'Repository access blocked' }, 403, { 'x-ratelimit-remaining': '42' }),
      '/repos/o/good/deployments?': [deployment({ id: 3 })],
      '/deployments/3/statuses': [status('success')],
    });

    const { items } = await run([
      { id: 'blocked', repo: 'o/blocked' },
      { id: 'good', repo: 'o/good' },
    ]);

    expect(items.map((i) => i.projectId)).toEqual(['good']);
  });

  it('헤더를 읽을 수 없는 403은 한도로 보지 않고 그 저장소만 건너뛴다', async () => {
    fetchImpl.mockImplementation(async (url: string) =>
      String(url).includes('/o/a/') ? { ok: false, status: 403, json: async () => ({}) } : response([], 200),
    );

    await expect(run([{ id: 'a', repo: 'o/a' }, { id: 'b', repo: 'o/b' }])).resolves.toMatchObject({ items: [] });

    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('/o/b/'))).toBe(true);
  });

  it('네트워크 오류나 잘못된 JSON이어도 예외 없이 빈 결과를 돌려준다', async () => {
    fetchImpl.mockRejectedValue(new Error('network'));
    await expect(run([{ id: 'a', repo: 'o/a' }])).resolves.toMatchObject({ items: [] });

    fetchImpl.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('bad')) });
    await expect(run([{ id: 'a', repo: 'o/a' }])).resolves.toMatchObject({ items: [] });
  });

  it('캐시는 최근 200개까지만 유지한다', async () => {
    const big: SyncCache = {
      final: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`o/old#${i}`, { state: 'success' as const, at: i }])),
    };
    route({ '/deployments?': [deployment({ id: 999 })], '/deployments/999/statuses': [status('success')] });

    const { cache } = await run([{ id: 'p', repo: 'o/new' }], big);

    expect(Object.keys(cache.final)).toHaveLength(200);
    expect(cache.final['o/new#999']).toBeDefined();
    expect(cache.final['o/old#0']).toBeUndefined();
  });
});

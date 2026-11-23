import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CATALOG_URL, fetchRemoteCatalog, readCachedCatalog } from './catalog-source';

const store = new Map<string, string>();
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const CACHE_KEY = 'catalog.v1';
const item = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  name: 'A',
  description: 'desc',
  icon: '📦',
  url: 'https://a.example.com',
  ...over,
});
const catalog = (projects: unknown[], version: unknown = 1) => ({ version, projects });
const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  storage.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  storage.setItem.mockImplementation(async (k: string, v: string) => void store.set(k, v));
  storage.removeItem.mockImplementation(async (k: string) => void store.delete(k));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('CATALOG_URL', () => {
  it('환경변수가 없으면 master의 카탈로그 원본을 가리킨다', () => {
    expect(CATALOG_URL).toBe(
      'https://raw.githubusercontent.com/side-projects-labs/side-projects-app/master/catalog/projects.json',
    );
  });

  it('EXPO_PUBLIC_CATALOG_URL이 있으면 그 주소를 쓴다', async () => {
    vi.stubEnv('EXPO_PUBLIC_CATALOG_URL', 'https://catalog.example.test/projects.json');
    vi.resetModules();

    const mod = await import('./catalog-source');

    expect(mod.CATALOG_URL).toBe('https://catalog.example.test/projects.json');
  });
});

describe('fetchRemoteCatalog', () => {
  it('유효한 카탈로그를 받으면 검증한 값을 돌려주고 캐시에 저장한다', async () => {
    fetchMock.mockResolvedValue(okResponse(catalog([item({ id: 'a' }), item({ id: 'b', url: 'https://b.example.com' })])));

    const result = await fetchRemoteCatalog();

    expect(result?.map((p) => p.id)).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledWith(CATALOG_URL, expect.objectContaining({ signal: expect.anything() }));
    expect((await readCachedCatalog())?.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('검증에서 버려진 항목은 캐시에도 넣지 않는다', async () => {
    fetchMock.mockResolvedValue(okResponse(catalog([item({ id: 'a' }), item({ id: 'bad', url: 'http://insecure.example.com' })])));

    const result = await fetchRemoteCatalog();

    expect(result?.map((p) => p.id)).toEqual(['a']);
    expect(JSON.parse(store.get(CACHE_KEY) ?? '{}').projects.map((p: { id: string }) => p.id)).toEqual(['a']);
  });

  it.each([
    ['형식이 틀린 본문', { nope: true }],
    ['지원하지 않는 버전', catalog([item()], 2)],
    ['쓸 항목이 하나도 없음', catalog([item({ url: 'javascript:alert(1)' })])],
  ])('%s이면 null을 돌려주고 기존 캐시를 덮어쓰지 않는다', async (_name, body) => {
    store.set(CACHE_KEY, JSON.stringify(catalog([item({ id: 'cached' })])));
    fetchMock.mockResolvedValue(okResponse(body));

    expect(await fetchRemoteCatalog()).toBeNull();

    expect((await readCachedCatalog())?.map((p) => p.id)).toEqual(['cached']);
  });

  it('HTTP 오류 응답이면 본문을 읽지 않고 null이다', async () => {
    const json = vi.fn();
    fetchMock.mockResolvedValue({ ok: false, status: 404, json });

    expect(await fetchRemoteCatalog()).toBeNull();
    expect(json).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['네트워크 오류', () => fetchMock.mockRejectedValue(new TypeError('Network request failed'))],
    ['본문이 JSON이 아님', () => fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => Promise.reject(new SyntaxError('bad')) })],
  ])('%s이면 예외 없이 null이다', async (_name, arrange) => {
    arrange();

    await expect(fetchRemoteCatalog()).resolves.toBeNull();
  });

  it('캐시 저장이 실패해도 받은 카탈로그는 돌려준다', async () => {
    fetchMock.mockResolvedValue(okResponse(catalog([item()])));
    storage.setItem.mockRejectedValue(new Error('disk full'));

    const result = await fetchRemoteCatalog();

    expect(result?.map((p) => p.id)).toEqual(['a']);
  });

  it('5초 안에 응답이 없으면 요청을 취소하고 null이다', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );

    const pending = fetchRemoteCatalog();
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
  });

  it('응답을 받으면 타임아웃 타이머를 남기지 않는다', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(okResponse(catalog([item()])));

    await fetchRemoteCatalog();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('readCachedCatalog', () => {
  it('저장된 캐시가 없으면 null이다', async () => {
    expect(await readCachedCatalog()).toBeNull();
  });

  it('저장된 유효한 캐시를 읽는다', async () => {
    store.set(CACHE_KEY, JSON.stringify(catalog([item({ id: 'a' })])));

    expect((await readCachedCatalog())?.map((p) => p.id)).toEqual(['a']);
  });

  it('캐시 안의 형식이 틀린 항목은 버린다', async () => {
    store.set(CACHE_KEY, JSON.stringify(catalog([item({ id: 'a' }), item({ id: 'x', url: 'http://insecure.example.com' })])));

    expect((await readCachedCatalog())?.map((p) => p.id)).toEqual(['a']);
  });

  it.each([
    ['JSON이 아닌 값', '{not json'],
    ['지원하지 않는 버전', JSON.stringify(catalog([item()], 9))],
    ['쓸 항목이 없음', JSON.stringify(catalog([]))],
  ])('손상된 캐시(%s)는 null이다', async (_name, raw) => {
    store.set(CACHE_KEY, raw);

    expect(await readCachedCatalog()).toBeNull();
  });

  it('저장소를 읽지 못해도 예외 없이 null이다', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(readCachedCatalog()).resolves.toBeNull();
  });
});

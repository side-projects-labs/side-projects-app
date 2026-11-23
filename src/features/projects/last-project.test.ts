import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLastVisitFor, loadLastVisit, saveLastVisit } from './last-project';

const store = new Map<string, string>();
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const KEY = 'last-visit-v1';
const visit = { projectId: 'portfolio-admin', url: 'https://admin.ycseng.com/project' };

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  storage.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  storage.setItem.mockImplementation(async (k: string, v: string) => void store.set(k, v));
  storage.removeItem.mockImplementation(async (k: string) => void store.delete(k));
});

describe('loadLastVisit', () => {
  it('저장된 값이 없으면 null이다', async () => {
    expect(await loadLastVisit()).toBeNull();
  });

  it('저장한 값을 그대로 읽는다', async () => {
    await saveLastVisit(visit);

    expect(await loadLastVisit()).toEqual(visit);
  });

  it.each([
    ['JSON이 아님', '{broken'],
    ['객체가 아님', '"text"'],
    ['url이 없음', JSON.stringify({ projectId: 'a' })],
    ['projectId가 문자열이 아님', JSON.stringify({ projectId: 1, url: 'https://a.example.com' })],
  ])('손상된 저장값(%s)은 null이다', async (_name, raw) => {
    store.set(KEY, raw);

    expect(await loadLastVisit()).toBeNull();
  });

  it('이전 형식의 키(last-project-v1)는 읽지 않는다', async () => {
    store.set('last-project-v1', 'portfolio-admin');

    expect(await loadLastVisit()).toBeNull();
  });

  it('저장소를 읽지 못해도 예외 없이 null이다', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(loadLastVisit()).resolves.toBeNull();
  });
});

describe('saveLastVisit', () => {
  it('버전이 붙은 키에 JSON으로 저장한다', async () => {
    await saveLastVisit(visit);

    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(visit));
  });

  it('저장에 실패해도 예외를 던지지 않는다', async () => {
    storage.setItem.mockRejectedValue(new Error('disk full'));

    await expect(saveLastVisit(visit)).resolves.toBeUndefined();
  });
});

describe('clearLastVisitFor', () => {
  it('저장된 마지막 페이지가 그 프로젝트의 것이면 지운다', async () => {
    await saveLastVisit(visit);

    await clearLastVisitFor('portfolio-admin');

    expect(await loadLastVisit()).toBeNull();
  });

  it('다른 프로젝트의 것이면 지우지 않는다', async () => {
    await saveLastVisit(visit);

    await clearLastVisitFor('other-project');

    expect(await loadLastVisit()).toEqual(visit);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('저장된 값이 없어도 예외 없이 끝난다', async () => {
    await expect(clearLastVisitFor('portfolio-admin')).resolves.toBeUndefined();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('저장소 오류가 나도 예외를 던지지 않는다', async () => {
    await saveLastVisit(visit);
    storage.removeItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(clearLastVisitFor('portfolio-admin')).resolves.toBeUndefined();
  });
});

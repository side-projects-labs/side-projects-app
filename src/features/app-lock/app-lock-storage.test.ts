import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadLockEnabled, saveLockEnabled } from './app-lock-storage';

const store = new Map<string, string>();
const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

const KEY = 'app-lock-v1';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  storage.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  storage.setItem.mockImplementation(async (k: string, v: string) => void store.set(k, v));
});

describe('loadLockEnabled', () => {
  it('저장된 값이 없으면 잠금은 꺼져 있다', async () => {
    expect(await loadLockEnabled()).toBe(false);
  });

  it('켜 둔 값(1)은 켜짐, 꺼 둔 값(0)은 꺼짐이다', async () => {
    store.set(KEY, '1');
    expect(await loadLockEnabled()).toBe(true);
    store.set(KEY, '0');
    expect(await loadLockEnabled()).toBe(false);
  });

  it('저장소를 읽지 못하면 사용자가 켜 둔 잠금이 풀리지 않도록 켜진 것으로 본다', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    expect(await loadLockEnabled()).toBe(true);
  });
});

describe('saveLockEnabled', () => {
  it('켜면 1, 끄면 0을 버전이 붙은 키에 저장하고 다시 읽으면 같은 값이다', async () => {
    await saveLockEnabled(true);
    expect(storage.setItem).toHaveBeenLastCalledWith(KEY, '1');
    expect(await loadLockEnabled()).toBe(true);

    await saveLockEnabled(false);
    expect(storage.setItem).toHaveBeenLastCalledWith(KEY, '0');
    expect(await loadLockEnabled()).toBe(false);
  });

  it('저장에 실패해도 예외를 던지지 않는다', async () => {
    storage.setItem.mockRejectedValue(new Error('disk full'));

    await expect(saveLockEnabled(true)).resolves.toBeUndefined();
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { movePinned, parsePinned, togglePin, type PinnedIds } from './pins';

// 형식을 바꾸면 버전을 올린다.
const KEY = 'pinned-projects-v1';

async function save(ids: PinnedIds): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // 저장 실패는 이번 실행에서만 고정이 유지될 뿐이라 무시한다.
  }
}

/** 고정한 프로젝트 id와 고정·해제·순서 변경. 변경은 즉시 화면에 반영하고 기기에 저장한다. */
export function usePins() {
  const [pinned, setPinned] = useState<PinnedIds>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setPinned(parsePinned(raw)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((fn: (prev: PinnedIds) => PinnedIds) => {
    setPinned((prev) => {
      const next = fn(prev);
      void save(next);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => update((prev) => togglePin(prev, id)), [update]);
  const move = useCallback(
    (id: string, dir: 'up' | 'down') => update((prev) => movePinned(prev, id, dir)),
    [update],
  );

  return { pinned, toggle, move };
}

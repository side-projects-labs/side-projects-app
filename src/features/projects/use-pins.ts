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
  // 저장된 값을 읽기 전에 빈 목록으로 덮어쓰지 않도록, 읽기가 끝난 뒤에만 저장한다.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive) return;
        setPinned(parsePinned(raw));
        setHydrated(true);
      })
      .catch(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);

  // 저장은 부수 효과이므로 상태 갱신 함수 밖에서 한다(갱신 함수는 순수하게 유지).
  useEffect(() => {
    if (hydrated) void save(pinned);
  }, [hydrated, pinned]);

  const toggle = useCallback((id: string) => setPinned((prev) => togglePin(prev, id)), []);
  const move = useCallback(
    (id: string, dir: 'up' | 'down') => setPinned((prev) => movePinned(prev, id, dir)),
    [],
  );

  return { pinned, toggle, move };
}

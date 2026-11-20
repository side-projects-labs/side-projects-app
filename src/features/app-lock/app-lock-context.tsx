import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { decideAuthOutcome, shouldLockOnResume } from './app-lock';
import { loadLockEnabled, saveLockEnabled } from './app-lock-storage';

// 잠깐 다른 앱을 보고 오는 정도는 다시 묻지 않는다.
const GRACE_MS = 30_000;

type AppLockState = {
  /** 저장된 설정을 읽는 중. 이 동안에도 내용은 가려 둔다. */
  ready: boolean;
  enabled: boolean;
  locked: boolean;
  /** 잠금 해제 인증을 띄운다. */
  unlock: () => Promise<void>;
  /** 설정에서 켜고 끈다. 켜기·끄기 모두 인증이 필요하다. 결과 메시지를 돌려준다(성공이면 null). */
  setEnabled: (next: boolean) => Promise<string | null>;
};

const AppLockContext = createContext<AppLockState | null>(null);

async function authenticate(message: string) {
  const level = await LocalAuthentication.getEnrolledLevelAsync().catch(
    () => LocalAuthentication.SecurityLevel.NONE,
  );
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return { success: false as const, error: 'not_enrolled' };
  }
  // 생체 인증이 어려울 때 기기 비밀번호로 대체할 수 있게 둔다(disableDeviceFallback 기본값 false).
  return LocalAuthentication.authenticateAsync({ promptMessage: message, cancelLabel: '취소' }).catch(
    () => ({ success: false as const, error: 'unknown' }),
  );
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(true);
  const backgroundedAt = useRef<number | null>(null);
  const authenticating = useRef(false);
  const enabledRef = useRef(false);

  const applyEnabled = useCallback((value: boolean) => {
    enabledRef.current = value;
    setEnabledState(value);
    void saveLockEnabled(value);
  }, []);

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      const outcome = decideAuthOutcome(await authenticate('앱 잠금 해제'));
      if (outcome === 'disable') applyEnabled(false);
      if (outcome !== 'stay') setLocked(false);
    } finally {
      authenticating.current = false;
    }
  }, [applyEnabled]);

  // 시작 시 설정을 읽고, 켜져 있으면 잠근 채 인증을 띄운다.
  useEffect(() => {
    let alive = true;
    void loadLockEnabled().then((value) => {
      if (!alive) return;
      enabledRef.current = value;
      setEnabledState(value);
      setLocked(value);
      setReady(true);
      if (value) void unlock();
    });
    return () => {
      alive = false;
    };
  }, [unlock]);

  // 백그라운드에 오래 있다 돌아오면 다시 잠근다. 인증 창이 떠 있는 동안의 상태 변화는 무시한다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (authenticating.current) return;
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        const lock = shouldLockOnResume({
          enabled: enabledRef.current,
          backgroundedAt: backgroundedAt.current,
          now: Date.now(),
          graceMs: GRACE_MS,
        });
        backgroundedAt.current = null;
        if (lock) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [unlock]);

  const setEnabled = useCallback(
    async (next: boolean): Promise<string | null> => {
      if (authenticating.current) return null;
      authenticating.current = true;
      try {
        const result = await authenticate(next ? '앱 잠금을 켭니다' : '앱 잠금을 끕니다');
        const outcome = decideAuthOutcome(result);
        if (outcome === 'unlock') {
          applyEnabled(next);
          return null;
        }
        if (outcome === 'disable') {
          // 잠금 수단이 사라진 상태에서 끄려는 경우는 인증 없이 끌 수 있어야 한다(켠 채로 갇히지 않게).
          if (!next) {
            applyEnabled(false);
            return null;
          }
          return '기기에 화면 잠금(지문·얼굴·PIN·패턴)이 설정되어 있지 않아 사용할 수 없습니다.';
        }
        return '인증이 완료되지 않아 설정을 바꾸지 않았습니다.';
      } finally {
        authenticating.current = false;
      }
    },
    [applyEnabled],
  );

  const value = useMemo<AppLockState>(
    () => ({ ready, enabled, locked: locked || !ready, unlock, setEnabled }),
    [ready, enabled, locked, unlock, setEnabled],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockState {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock은 AppLockProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}

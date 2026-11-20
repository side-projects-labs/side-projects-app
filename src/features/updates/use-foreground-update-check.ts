import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { shouldCheckForUpdate } from './update-prompt';

const MIN_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 앱을 켜 둔 채 오래 두었다가 돌아왔을 때도 새 업데이트를 내려받는다.
 * expo-updates는 실행 시에만 확인하므로, 포그라운드 복귀 시 최소 간격(10분)을 두고 직접 확인한다.
 * 내려받으면 useUpdates의 isUpdatePending이 켜져 안내 배너가 뜬다. 네트워크 오류 등은 조용히 무시한다.
 */
export function useForegroundUpdateCheck() {
  const lastCheckedAt = useRef<number | null>(null);
  const running = useRef(false);

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      if (
        running.current ||
        !shouldCheckForUpdate({
          isEnabled: Updates.isEnabled,
          lastCheckedAt: lastCheckedAt.current,
          now,
          minIntervalMs: MIN_INTERVAL_MS,
        })
      ) {
        return;
      }
      running.current = true;
      lastCheckedAt.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // 오프라인 등으로 실패해도 다음 복귀 때 다시 시도한다.
      } finally {
        running.current = false;
      }
    };

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, []);
}

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useCatalog } from '@/features/projects/catalog-context';

import { runDeploymentSync } from './deployment-sync-runner';

/**
 * 앱이 열리거나 활성화될 때 카탈로그 저장소의 최근 배포를 이력에 보충한다.
 * 알림을 받지 못했거나 알림 센터에서 지운 배포도 GitHub의 공개 기록으로 채운다(15분 간격, 실패해도 앱은 그대로 동작).
 */
export function useSyncDeploymentHistory() {
  const { projects } = useCatalog();

  useEffect(() => {
    const sync = () => {
      void runDeploymentSync(projects).catch(() => undefined);
    };

    sync();
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => appState.remove();
  }, [projects]);
}

import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { addHistory, toHistoryItem, type HistoryItem } from './history';

function collect(list: Notifications.Notification[]): HistoryItem[] {
  return list.map(toHistoryItem).filter((x): x is HistoryItem => x !== null);
}

/**
 * 배포 알림을 이력에 남긴다.
 * - 앱 실행 중 수신, 알림 탭
 * - 앱이 꺼져 있는 동안 받은 알림: 앱이 열리거나 활성화될 때 알림 센터에 남은 것을 가져온다.
 *   사용자가 알림 센터에서 미리 지운 알림은 가져올 수 없다.
 */
export function useRecordDeploymentHistory() {
  useEffect(() => {
    const syncPresented = () => {
      Notifications.getPresentedNotificationsAsync()
        .then((list) => addHistory(collect(list)))
        .catch(() => undefined);
    };

    syncPresented();
    const received = Notifications.addNotificationReceivedListener((n) => {
      void addHistory(collect([n]));
    });
    const response = Notifications.addNotificationResponseReceivedListener((r) => {
      void addHistory(collect([r.notification]));
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncPresented();
    });
    return () => {
      received.remove();
      response.remove();
      appState.remove();
    };
  }, []);
}

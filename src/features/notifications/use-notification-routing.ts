import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { findProject } from '../projects/catalog';
import { parseDeploymentEvent } from './contract';

/** 알림 탭(실행 중·백그라운드·종료 상태 진입 포함) 시 해당 프로젝트 WebView로 이동한다. */
export function useNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const event = parseDeploymentEvent(response?.notification.request.content.data);
      if (event && findProject(event.projectId)) {
        router.push({ pathname: '/project/[id]', params: { id: event.projectId } });
      }
    };

    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

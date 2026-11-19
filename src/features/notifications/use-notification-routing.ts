import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useCatalog } from '../projects/catalog-context';
import { parseDeploymentEvent } from './contract';

/** 알림 탭(실행 중·백그라운드·종료 상태 진입 포함) 시 해당 프로젝트 WebView로 이동한다. */
export function useNotificationRouting() {
  const router = useRouter();
  const { find } = useCatalog();
  // 카탈로그가 원격으로 갱신돼도 리스너를 다시 달지 않도록 최신 함수만 ref로 참조한다.
  const findRef = useRef(find);
  useEffect(() => {
    findRef.current = find;
  }, [find]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const event = parseDeploymentEvent(response?.notification.request.content.data);
      if (event && findRef.current(event.projectId)) {
        router.push({ pathname: '/project/[id]', params: { id: event.projectId } });
      }
    };

    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

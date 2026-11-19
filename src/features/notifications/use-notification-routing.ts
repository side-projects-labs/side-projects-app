import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import { useCatalog } from '../projects/catalog-context';
import { parseDeploymentEvent } from './contract';

/**
 * 알림 탭(실행 중·백그라운드·종료 상태 진입 포함) 시 이동한다.
 * - failed·started: 빌드·로그 페이지(event.url)를 외부 브라우저로 연다. url이 없으면 프로젝트 화면.
 * - succeeded: 해당 프로젝트 WebView(완료 페이지)를 연다.
 * 로그 페이지는 GitHub/Vercel 로그인이 필요해 WebView 대신 기기 브라우저로 연다.
 */
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
      if (!event) return;
      if (event.status !== 'succeeded' && event.url) {
        Linking.openURL(event.url).catch(() => undefined);
        return;
      }
      if (findRef.current(event.projectId)) {
        router.push({ pathname: '/project/[id]', params: { id: event.projectId } });
      }
    };

    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

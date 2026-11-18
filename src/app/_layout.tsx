import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { registerForDeploymentPush } from '@/features/notifications/setup';
import { useNotificationRouting } from '@/features/notifications/use-notification-routing';

export default function RootLayout() {
  useNotificationRouting();

  useEffect(() => {
    // 토큰 서버 등록은 후속 작업. 현재는 권한·채널·토큰 발급 가능 여부만 확인한다.
    void registerForDeploymentPush();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Side Projects' }} />
        <Stack.Screen name="project/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}

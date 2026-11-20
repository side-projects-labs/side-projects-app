import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import { registerForDeploymentPush } from '@/features/notifications/setup';
import { useNotificationRouting } from '@/features/notifications/use-notification-routing';
import { useRecordDeploymentHistory } from '@/features/notifications/use-record-history';
import { AppLockProvider } from '@/features/app-lock/app-lock-context';
import { LockScreen } from '@/features/app-lock/lock-screen';
import { CatalogProvider } from '@/features/projects/catalog-context';
import { UpdatePrompt } from '@/features/updates/update-prompt-banner';
import { DARK, LIGHT } from '@/theme/theme';

function AppShell() {
  useNotificationRouting();
  useRecordDeploymentHistory();

  useEffect(() => {
    // 토큰 서버 등록은 후속 작업. 현재는 권한·채널·토큰 발급 가능 여부만 확인한다.
    void registerForDeploymentPush();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Side Projects' }} />
        <Stack.Screen name="notifications" options={{ title: '배포 알림' }} />
        <Stack.Screen name="about" options={{ title: '앱 정보' }} />
        <Stack.Screen name="history" options={{ title: '배포 이력' }} />
        <Stack.Screen name="project/[id]" options={{ title: '' }} />
      </Stack>
      <UpdatePrompt />
      <LockScreen />
    </View>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const palette = dark ? DARK : LIGHT;
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      primary: palette.accent,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      <AppLockProvider>
        <CatalogProvider>
          <AppShell />
        </CatalogProvider>
      </AppLockProvider>
    </ThemeProvider>
  );
}

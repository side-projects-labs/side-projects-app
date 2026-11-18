import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { registerForDeploymentPush } from '@/features/notifications/setup';
import { useNotificationRouting } from '@/features/notifications/use-notification-routing';
import { CatalogProvider } from '@/features/projects/catalog-context';
import { DARK, LIGHT } from '@/theme/theme';

function AppShell() {
  useNotificationRouting();

  useEffect(() => {
    // 토큰 서버 등록은 후속 작업. 현재는 권한·채널·토큰 발급 가능 여부만 확인한다.
    void registerForDeploymentPush();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Side Projects' }} />
      <Stack.Screen name="project/[id]" options={{ title: '' }} />
    </Stack>
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
      <CatalogProvider>
        <AppShell />
      </CatalogProvider>
    </ThemeProvider>
  );
}

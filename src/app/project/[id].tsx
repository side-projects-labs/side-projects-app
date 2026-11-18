import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useCatalog } from '@/features/projects/catalog-context';
import { isExternalOpenable, isInternalUrl } from '@/features/projects/url-policy';
import { useTheme } from '@/theme/theme';

export default function ProjectWebViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { find } = useCatalog();
  const project = find(id);
  const t = useTheme();
  const webRef = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();

  // Android 하드웨어 뒤로가기: 웹 히스토리가 있으면 웹 내부 먼저, 없으면 기본 동작(목록 복귀).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCurrentUrl(nav.url);
  }, []);

  const reload = useCallback(() => {
    setFailed(false);
    webRef.current?.reload();
  }, []);

  const openInBrowser = useCallback(() => {
    const target = currentUrl ?? project?.url;
    if (target && isExternalOpenable(target)) void Linking.openURL(target);
  }, [currentUrl, project?.url]);

  if (!project) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text }}>등록되지 않은 프로젝트입니다.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.background }]}
      edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: project.name,
          headerRight: () => (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="새로고침"
                hitSlop={8}
                onPress={reload}>
                <Text style={[styles.action, { color: t.accent }]}>↻</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="브라우저로 열기"
                hitSlop={8}
                onPress={openInBrowser}>
                <Text style={[styles.action, { color: t.accent }]}>↗</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {progress > 0 && progress < 1 && !failed ? (
        <View style={styles.progressTrack} pointerEvents="none">
          <View
            style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: t.accent }]}
          />
        </View>
      ) : null}
      {failed ? (
        <View style={styles.center}>
          <Text style={[styles.msg, { color: t.text }]}>페이지를 불러오지 못했어요.</Text>
          <Text style={[styles.sub, { color: t.subtext }]}>네트워크 연결을 확인해 주세요.</Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.retry, { borderColor: t.border }]}
            onPress={reload}>
            <Text style={{ color: t.text }}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={webRef}
        style={[failed ? styles.hidden : styles.screen, { backgroundColor: t.background }]}
        source={{ uri: project.url }}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.center, styles.fill, { backgroundColor: t.background }]}>
            <ActivityIndicator />
          </View>
        )}
        pullToRefreshEnabled
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onLoadStart={() => setFailed(false)}
        onNavigationStateChange={onNavChange}
        onError={() => setFailed(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setFailed(true);
        }}
        // WebView 프로세스가 종료되면(메모리 부족 등) 빈 화면으로 남지 않게 다시 불러온다.
        onContentProcessDidTerminate={reload}
        onRenderProcessGone={reload}
        onShouldStartLoadWithRequest={(req) => {
          if (isInternalUrl(project, req.url)) return true;
          if (isExternalOpenable(req.url)) void Linking.openURL(req.url);
          return false;
        }}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hidden: { height: 0 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  msg: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 14 },
  retry: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: 16, paddingRight: 4 },
  action: { fontSize: 22 },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 },
  progressBar: { height: 2 },
});

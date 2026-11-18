import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { findProject } from '@/features/projects/catalog';
import { isExternalOpenable, isInternalUrl } from '@/features/projects/url-policy';

export default function ProjectWebViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = findProject(id);
  const webRef = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const onNavChange = useCallback((nav: WebViewNavigation) => setCanGoBack(nav.canGoBack), []);

  if (!project) {
    return (
      <View style={styles.center}>
        <Text>등록되지 않은 프로젝트입니다.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: project.name }} />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.msg}>페이지를 불러오지 못했어요.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.retry}
            onPress={() => {
              setFailed(false);
              webRef.current?.reload();
            }}>
            <Text>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={webRef}
        style={failed ? styles.hidden : styles.screen}
        source={{ uri: project.url }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}
        onNavigationStateChange={onNavChange}
        onError={() => setFailed(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) setFailed(true);
        }}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  msg: { fontSize: 15 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
});

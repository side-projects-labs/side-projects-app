import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useCatalog } from '@/features/projects/catalog-context';
import {
  clearLastVisitFor,
  loadLastVisit,
  saveLastVisit,
} from '@/features/projects/last-project';
import { cookieResetUrls, type ResetScope } from '@/features/projects/login-reset';
import { resetLogin } from '@/features/projects/login-reset-native';
import { isRememberableUrl, resolveResume, resolveShareUrl } from '@/features/projects/resume';
import { isExternalOpenable, isInternalUrl } from '@/features/projects/url-policy';
import { createVisitSaver } from '@/features/projects/visit-saver';
import { WebToolbar } from '@/features/projects/web-toolbar';
import { useTheme } from '@/theme/theme';

const SAVE_DELAY_MS = 800;
const ACTION_ICON_SIZE = 24;

export default function ProjectWebViewScreen() {
  const { id, resume } = useLocalSearchParams<{ id: string; resume?: string }>();
  const { find } = useCatalog();
  const project = find(id);
  const t = useTheme();
  const webRef = useRef<WebView<object>>(null);
  // 값을 바꾸면 WebView를 새로 만들어 메모리 캐시와 열려 있던 페이지를 버린다(로그인 초기화용).
  const [session, setSession] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();

  // "이어서 보기"로 들어오면 저장된 페이지에서 시작한다. 저장값은 다시 검증하고, 실패하면 첫 주소를 쓴다.
  // 목록에서 직접 연 경우(resume 없음)와 알림으로 연 경우는 항상 첫 주소다.
  const [startUrl, setStartUrl] = useState<string | undefined>(
    resume === '1' ? undefined : project?.url,
  );
  const { projects } = useCatalog();
  // 시작 주소는 한 번만 정한다. 카탈로그가 캐시→원격으로 갱신돼도 다시 계산하면 보던 페이지가 다시 로드된다.
  const resolved = useRef(false);
  useEffect(() => {
    if (resume !== '1' || !project || resolved.current) return;
    resolved.current = true;
    void loadLastVisit().then((visit) => {
      const r = resolveResume(projects, visit);
      setStartUrl(r && r.project.id === project.id ? r.url : project.url);
    });
  }, [resume, project, projects]);
  // 잦은 페이지 이동(SPA)마다 저장하지 않도록 잠시 멈췄을 때 한 번만 쓴다. 화면을 떠날 때는 남은 값을 바로 저장한다.
  const [saver] = useState(() => createVisitSaver(saveLastVisit, SAVE_DELAY_MS));
  useEffect(() => saver.flush, [saver]);

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

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      setCanGoBack(nav.canGoBack);
      setCanGoForward(nav.canGoForward);
      setCurrentUrl(nav.url);
      // 마지막으로 본 페이지를 기억한다. 로그인·콜백·토큰이 든 주소는 저장하지 않는다.
      if (project && !nav.loading && isRememberableUrl(project, nav.url)) {
        saver.schedule({ projectId: project.id, url: nav.url });
      }
    },
    [project, saver],
  );

  const reload = useCallback(() => {
    setFailed(false);
    webRef.current?.reload();
  }, []);

  const runReset = useCallback(
    async (scope: ResetScope) => {
      if (!project) return;
      // 대기 중인 저장이 초기화 뒤에 옛 주소를 다시 쓰지 않도록 먼저 버린다.
      saver.forget();
      webRef.current?.clearCache?.(true);
      const result = await resetLogin(project, scope);
      await clearLastVisitFor(project.id);
      setFailed(false);
      setCurrentUrl(undefined);
      setStartUrl(project.url);
      setSession((n) => n + 1);
      if (result.failed > 0) {
        Alert.alert(
          '일부 항목을 지우지 못했습니다',
          '다시 시도해도 로그인이 풀리지 않으면 앱을 다시 설치해 주세요.',
        );
      }
    },
    [project, saver],
  );

  const confirmResetLogin = useCallback(() => {
    if (!project) return;
    const serviceHost = new URL(project.url).hostname;
    const loginHosts = cookieResetUrls(project, 'login')
      .map((u) => new URL(u).hostname)
      .filter((h) => h !== serviceHost);
    const hasLoginHosts = loginHosts.length > 0;
    Alert.alert(
      '로그인 초기화',
      `${project.name}의 로그인 정보(쿠키)를 지우고 처음 화면으로 돌아갑니다.\n\n` +
        `• 서비스만: ${serviceHost}\n` +
        (hasLoginHosts
          ? `• 로그인 호스트까지: ${loginHosts.join(', ')} 도 지웁니다. 같은 호스트를 쓰는 다른 프로젝트의 로그인도 풀릴 수 있습니다.`
          : ''),
      [
        { text: '취소', style: 'cancel' },
        { text: '서비스만', onPress: () => void runReset('service') },
        ...(hasLoginHosts
          ? [
              {
                text: '로그인 호스트까지',
                style: 'destructive' as const,
                onPress: () => void runReset('login'),
              },
            ]
          : []),
      ],
    );
  }, [project, runReset]);

  const share = useCallback(() => {
    if (!project) return;
    const url = resolveShareUrl(project, currentUrl);
    // Android는 message, iOS는 url 필드를 쓴다. 둘 다 같은 주소를 넣는다.
    void Share.share({ message: url, url, title: project.name }).catch(() => undefined);
  }, [project, currentUrl]);

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

  // 이어서 보기 주소를 읽는 동안은 WebView를 만들지 않는다(첫 주소가 먼저 열리는 깜빡임 방지).
  if (!startUrl) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator />
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
                accessibilityLabel="로그인 초기화"
                hitSlop={8}
                onPress={confirmResetLogin}>
                <Ionicons name="log-out-outline" size={ACTION_ICON_SIZE} color={t.accent} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="브라우저로 열기"
                hitSlop={8}
                onPress={openInBrowser}>
                <Ionicons name="open-outline" size={ACTION_ICON_SIZE} color={t.accent} />
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
        key={session}
        ref={webRef}
        style={[failed ? styles.hidden : styles.screen, { backgroundColor: t.background }]}
        source={{ uri: startUrl }}
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
      <WebToolbar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => webRef.current?.goBack()}
        onForward={() => webRef.current?.goForward()}
        onReload={reload}
        onShare={share}
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
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1 },
  progressBar: { height: 2 },
});

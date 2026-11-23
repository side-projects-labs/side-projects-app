import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { MIN_TOUCH_TARGET, verticalHitSlop } from '@/theme/touch';

import { shouldShowUpdatePrompt } from './update-prompt';
import { useForegroundUpdateCheck } from './use-foreground-update-check';

/**
 * OTA 업데이트를 내려받으면 다시 시작을 안내한다. 내려받기 자체는 expo-updates가 실행 시 알아서 한다.
 * 개발 모드(업데이트 꺼짐)에서는 보이지 않고, 재시작 실패는 조용히 무시해 앱을 계속 쓸 수 있게 한다.
 */
export function UpdatePrompt() {
  useForegroundUpdateCheck();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  const pendingId = downloadedUpdate?.updateId ?? null;
  if (
    !shouldShowUpdatePrompt({
      isEnabled: Updates.isEnabled,
      isUpdatePending,
      pendingUpdateId: pendingId,
      dismissedUpdateId: dismissedId,
    })
  ) {
    return null;
  }

  const restart = async () => {
    setRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setRestarting(false);
    }
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: t.background, paddingBottom: insets.bottom + 12 }]}
      accessibilityRole="alert">
      <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.text, { color: t.text }]}>새 버전이 준비됐어요</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={verticalHitSlop(DISMISS_TEXT_HEIGHT)}
          onPress={() => setDismissedId(pendingId ?? 'unknown')}>
          <Text style={{ color: t.subtext }}>나중에</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={restarting}
          onPress={() => void restart()}
          style={[styles.button, { backgroundColor: t.accent }, restarting && styles.disabled]}>
          <Text style={[styles.buttonText, { color: t.onAccent }]}>{restarting ? '다시 시작 중…' : '다시 시작'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** '나중에' 글자(14px)의 대략적인 높이. */
const DISMISS_TEXT_HEIGHT = 18;

const styles = StyleSheet.create({
  // 화면 위에 덮지 않고 Stack 아래에 자리를 차지해, 하단 입력 요소가 있는 화면도 가리지 않는다.
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600' },
  button: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { fontWeight: '600', fontSize: 13 },
});

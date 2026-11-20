import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme';

import { useAppLock } from './app-lock-context';

/** 잠겨 있는 동안 앱 내용을 완전히 가리는 화면. 설정을 읽는 동안에도 내용이 보이지 않게 한다. */
export function LockScreen() {
  const t = useTheme();
  const { locked, ready, unlock } = useAppLock();
  if (!locked) return null;
  return (
    <View style={[styles.cover, { backgroundColor: t.background }]} accessibilityViewIsModal>
      <Text style={styles.icon} accessible={false}>
        🔒
      </Text>
      <Text style={[styles.title, { color: t.text }]}>잠겨 있습니다</Text>
      {ready ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void unlock()}
          style={[styles.button, { backgroundColor: t.accent }]}>
          <Text style={styles.buttonText}>잠금 해제</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 100,
    elevation: 100,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '600' },
  button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

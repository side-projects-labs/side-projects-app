import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { registerForDeploymentPush, type RegistrationResult } from '@/features/notifications/setup';
import { getUpdateInfoRows } from '@/features/updates/current-update';
import { useTheme } from '@/theme/theme';

const REASONS: Record<Exclude<RegistrationResult, { ok: true }>['reason'], string> = {
  'not-device': '실제 기기에서만 푸시 토큰을 받을 수 있어요. (에뮬레이터/시뮬레이터 불가)',
  denied: '알림 권한이 꺼져 있어요. 시스템 설정에서 알림을 허용해 주세요.',
  'no-project-id': 'EAS projectId가 없어 토큰을 발급할 수 없어요.',
  error:
    '토큰 발급에 실패했어요. FCM 설정(google-services.json)이 포함된 빌드인지, 네트워크가 연결돼 있는지 확인해 주세요.',
};

export default function NotificationSettingsScreen() {
  const t = useTheme();
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // 업데이트 정보는 앱 시작 시 정해져 화면이 다시 그려져도 바뀌지 않는다.
  const [updateRows] = useState(getUpdateInfoRows);

  const load = useCallback(async () => {
    setLoading(true);
    setCopied(false);
    try {
      setResult(await registerForDeploymentPush());
    } catch {
      setResult({ ok: false, reason: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    registerForDeploymentPush()
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult({ ok: false, reason: 'error' }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const copy = async () => {
    if (result?.ok) {
      await Clipboard.setStringAsync(result.token);
      setCopied(true);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.background }]} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: t.text }]}>배포 알림</Text>
        <Text style={[styles.desc, { color: t.subtext }]}>
          이 기기의 푸시 토큰을 GitHub Secret(EXPO_PUSH_TOKENS)에 등록하면 배포 시작·완료·실패 알림을 받아요.
        </Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {loading ? <Text style={{ color: t.subtext }}>확인 중…</Text> : null}
          {!loading && result?.ok ? (
            <>
              <Text style={[styles.label, { color: t.subtext }]}>푸시 토큰</Text>
              <Text selectable style={[styles.token, { color: t.text }]}>
                {result.token}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={copy}
                style={[styles.button, { backgroundColor: t.accent }]}>
                <Text style={styles.buttonText}>{copied ? '복사했어요' : '토큰 복사'}</Text>
              </Pressable>
              <Text style={[styles.warn, { color: t.subtext }]}>
                이 토큰을 아는 사람은 이 기기로 알림을 보낼 수 있어요. 공개 채널에 붙여 넣지 마세요.
              </Text>
            </>
          ) : null}
          {!loading && result && !result.ok ? (
            <Text style={{ color: t.text }}>{REASONS[result.reason]}</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={load}
          style={[styles.secondary, { borderColor: t.border }]}>
          <Text style={{ color: t.text }}>다시 확인</Text>
        </Pressable>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>앱 업데이트 정보</Text>
          {updateRows.map((row) => (
            <View key={row.label} style={styles.infoRow}>
              <Text style={[styles.label, { color: t.subtext }]}>{row.label}</Text>
              <Text selectable style={{ color: t.text, fontSize: 13 }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  desc: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  label: { fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  token: { fontSize: 13, fontFamily: 'Courier' },
  button: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  warn: { fontSize: 12, lineHeight: 18 },
  secondary: { paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
});

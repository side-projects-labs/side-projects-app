import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppLock } from '@/features/app-lock/app-lock-context';
import { getUpdateInfoRows } from '@/features/updates/current-update';
import { useTheme } from '@/theme/theme';

export default function AboutScreen() {
  const t = useTheme();
  // 업데이트 정보는 앱 시작 시 정해져 화면이 다시 그려져도 바뀌지 않는다.
  const rows = getUpdateInfoRows();
  const { enabled, setEnabled } = useAppLock();

  const toggleLock = async (next: boolean) => {
    const message = await setEnabled(next);
    if (message) Alert.alert('앱 잠금', message);
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.background }]}
      edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: t.text }]}>앱 업데이트 정보</Text>
        <Text style={[styles.desc, { color: t.subtext }]}>
          지금 실행 중인 코드가 빌드에 포함된 것인지, OTA로 받은 것인지 확인할 수 있어요.
        </Text>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={[styles.label, { color: t.subtext }]}>{row.label}</Text>
              <Text selectable style={[styles.value, { color: t.text }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.row}>
            <View style={styles.lockText}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>앱 잠금</Text>
              <Text style={[styles.desc, { color: t.subtext }]}>
                앱을 열 때와 30초 넘게 다른 앱을 쓰다 돌아올 때 지문·얼굴·기기 비밀번호로 확인합니다.
              </Text>
            </View>
            <Switch
              accessibilityLabel="앱 잠금"
              value={enabled}
              onValueChange={(v) => void toggleLock(v)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  lockText: { flex: 1, gap: 4 },
  desc: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 12 },
  value: { fontSize: 13, flexShrink: 1, textAlign: 'right' },
});

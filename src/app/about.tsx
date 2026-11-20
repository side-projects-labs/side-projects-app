import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getUpdateInfoRows } from '@/features/updates/current-update';
import { useTheme } from '@/theme/theme';

export default function AboutScreen() {
  const t = useTheme();
  // 업데이트 정보는 앱 시작 시 정해져 화면이 다시 그려져도 바뀌지 않는다.
  const rows = getUpdateInfoRows();

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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 12 },
  value: { fontSize: 13, flexShrink: 1, textAlign: 'right' },
});

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearHistory, loadHistory, type HistoryItem } from '@/features/notifications/history';
import { useCatalog } from '@/features/projects/catalog-context';
import { useTheme } from '@/theme/theme';

const STATUS_LABEL = { started: '🚀 배포 시작', succeeded: '✅ 배포 완료', failed: '❌ 배포 실패' } as const;

function formatTime(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export default function HistoryScreen() {
  const t = useTheme();
  const { find } = useCatalog();
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadHistory().then((list) => alive && setItems(list));
      return () => {
        alive = false;
      };
    }, []),
  );

  const clear = async () => {
    await clearHistory();
    setItems([]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.background }]} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => i.eventId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[styles.note, { color: t.subtext }]}>
            이 기기에서 받은 알림만 기록돼요(최근 50건). 알림 센터에서 미리 지운 알림은 남지 않을 수 있어요.
          </Text>
        }
        ListEmptyComponent={
          items === null ? undefined : (
            <Text style={[styles.empty, { color: t.subtext }]}>아직 받은 배포 알림이 없어요.</Text>
          )
        }
        renderItem={({ item }) => {
          const project = find(item.projectId);
          const row = (
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.status, { color: t.text }]}>{STATUS_LABEL[item.status]}</Text>
                <Text style={[styles.time, { color: t.subtext }]}>{formatTime(item.receivedAt)}</Text>
              </View>
              <Text style={[styles.name, { color: t.text }]}>{project?.name ?? item.projectId}</Text>
              {item.body ? <Text style={[styles.body, { color: t.subtext }]}>{item.body}</Text> : null}
            </View>
          );
          return project ? (
            <Link href={{ pathname: '/project/[id]', params: { id: project.id } }} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={`${project.name} 열기`}>
                {row}
              </Pressable>
            </Link>
          ) : (
            row
          );
        }}
        ListFooterComponent={
          items && items.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={clear} style={styles.clear}>
              <Text style={{ color: t.accent }}>기록 지우기</Text>
            </Pressable>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12 },
  note: { fontSize: 12, marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 48 },
  card: { padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 13 },
  clear: { alignSelf: 'center', padding: 16 },
});

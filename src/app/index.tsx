import { Link, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCatalog } from '@/features/projects/catalog-context';
import { useTheme } from '@/theme/theme';

export default function ProjectListScreen() {
  const { projects, source, refreshing, refresh } = useCatalog();
  const t = useTheme();

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.background }]}
      edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/notifications" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="배포 알림 설정" hitSlop={8}>
                <Text style={{ fontSize: 20, color: t.accent }}>🔔</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={<Text style={[styles.empty, { color: t.subtext }]}>프로젝트가 없어요.</Text>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/project/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 열기`}
              accessibilityHint={item.description}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: t.card, borderColor: t.border },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.icon} accessible={false}>
                {item.icon}
              </Text>
              <View style={styles.body}>
                <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
                <Text style={[styles.desc, { color: t.subtext }]}>{item.description}</Text>
              </View>
            </Pressable>
          </Link>
        )}
        ListFooterComponent={
          source === 'bundled' ? (
            <Text style={[styles.footer, { color: t.subtext }]}>
              저장된 목록을 표시 중이에요. 아래로 당겨 새로고침할 수 있어요.
            </Text>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  icon: { fontSize: 28 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  desc: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 48 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});

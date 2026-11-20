import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCatalog } from '@/features/projects/catalog-context';
import type { HealthStatus } from '@/features/projects/health';
import { loadLastVisit } from '@/features/projects/last-project';
import { describeVisit, resolveResume, type LastVisit } from '@/features/projects/resume';
import { useHealth } from '@/features/projects/use-health';
import { useTheme } from '@/theme/theme';

export default function ProjectListScreen() {
  const { projects, source, refreshing, refresh } = useCatalog();
  const t = useTheme();
  const { status, refresh: refreshHealth } = useHealth(projects);
  const [visit, setVisit] = useState<LastVisit | null>(null);
  const resume = resolveResume(projects, visit);

  // 프로젝트 화면에서 돌아올 때마다 마지막으로 본 페이지를 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      void loadLastVisit().then(setVisit);
    }, []),
  );

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshHealth()]);
  }, [refresh, refreshHealth]);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.background }]}
      edges={['bottom', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Link href="/about" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="앱 정보" hitSlop={8}>
                  <Text style={{ fontSize: 20, color: t.accent }}>ℹ️</Text>
                </Pressable>
              </Link>
              <Link href="/history" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="배포 이력" hitSlop={8}>
                  <Text style={{ fontSize: 20, color: t.accent }}>🕘</Text>
                </Pressable>
              </Link>
              <Link href="/notifications" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="배포 알림 설정" hitSlop={8}>
                  <Text style={{ fontSize: 20, color: t.accent }}>🔔</Text>
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          resume ? (
            <Link
              href={{ pathname: '/project/[id]', params: { id: resume.project.id, resume: '1' } }}
              asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${resume.project.name} 이어서 보기, ${describeVisit(resume.url)}`}
                style={({ pressed }) => [
                  styles.resume,
                  { borderColor: t.accent },
                  pressed && styles.pressed,
                ]}>
                <Text style={{ color: t.accent, fontWeight: '600' }}>
                  {resume.project.icon} {resume.project.name} 이어서 보기 ›
                </Text>
                <Text style={[styles.resumePath, { color: t.subtext }]} numberOfLines={1}>
                  {describeVisit(resume.url)}
                </Text>
              </Pressable>
            </Link>
          ) : undefined
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: t.subtext }]}>프로젝트가 없어요.</Text>}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/project/[id]', params: { id: item.id } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 열기, 서비스 상태 ${HEALTH_LABEL[status[item.id] ?? 'checking']}`}
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
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <HealthChip status={status[item.id]} />
                </View>
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

const HEALTH_LABEL: Record<HealthStatus, string> = {
  checking: '확인 중',
  up: '정상',
  down: '응답 없음',
};
const HEALTH_COLOR: Record<HealthStatus, string> = {
  checking: '#9AA3AF',
  up: '#2DA44E',
  down: '#D1242F',
};

/** 카드 안에 포함되는 상태 칩. 카드 전체 접근성 라벨에 상태가 들어가므로 따로 읽히지 않게 한다. */
function HealthChip({ status }: { status: HealthStatus | undefined }) {
  const t = useTheme();
  const s = status ?? 'checking';
  return (
    <View
      style={[styles.chip, { backgroundColor: `${HEALTH_COLOR[s]}26` }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.dot, { backgroundColor: HEALTH_COLOR[s] }]} />
      <Text style={[styles.chipText, { color: t.text }]}>{HEALTH_LABEL[s]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resume: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12, gap: 2 },
  resumePath: { fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: '500' },
  screen: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 16 },
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
  name: { flexShrink: 1, fontSize: 17, fontWeight: '600' },
  desc: { fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 48 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});

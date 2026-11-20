import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCatalog } from '@/features/projects/catalog-context';
import type { HealthStatus } from '@/features/projects/health';
import { loadLastVisit } from '@/features/projects/last-project';
import { sanitizePinned, sortProjects } from '@/features/projects/pins';
import { describeVisit, resolveResume, type LastVisit } from '@/features/projects/resume';
import { useHealth } from '@/features/projects/use-health';
import { usePins } from '@/features/projects/use-pins';
import { useTheme } from '@/theme/theme';

export default function ProjectListScreen() {
  const { projects, source, refreshing, refresh } = useCatalog();
  const t = useTheme();
  const { status, refresh: refreshHealth } = useHealth(projects);
  const [visit, setVisit] = useState<LastVisit | null>(null);
  const resume = resolveResume(projects, visit);
  const { pinned, toggle, move } = usePins();
  const [editing, setEditing] = useState(false);
  // 카탈로그에서 사라진 고정 id는 무시한다. 고정한 프로젝트가 위에, 나머지는 원래 순서로 온다.
  const pinnedIds = useMemo(() => sanitizePinned(pinned, projects), [pinned, projects]);
  const sorted = useMemo(() => sortProjects(projects, pinnedIds), [projects, pinnedIds]);

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
              {pinnedIds.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={editing ? '순서 변경 완료' : '고정한 프로젝트 순서 변경'}
                  hitSlop={8}
                  onPress={() => setEditing((v) => !v)}>
                  <Text style={{ fontSize: 15, color: t.accent }}>{editing ? '완료' : '순서'}</Text>
                </Pressable>
              ) : null}
              <Link href="/about" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="앱 정보" hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={HEADER_ICON_SIZE} color={t.accent} />
                </Pressable>
              </Link>
              <Link href="/history" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="배포 이력" hitSlop={8}>
                  <Ionicons name="time-outline" size={HEADER_ICON_SIZE} color={t.accent} />
                </Pressable>
              </Link>
              <Link href="/notifications" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="배포 알림 설정" hitSlop={8}>
                  <Ionicons name="notifications-outline" size={HEADER_ICON_SIZE} color={t.accent} />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
        data={sorted}
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
                  <PinStar
                    name={item.name}
                    pinned={pinnedIds.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <HealthChip status={status[item.id]} />
                </View>
                <Text style={[styles.desc, { color: t.subtext }]}>{item.description}</Text>
              </View>
              {editing && pinnedIds.includes(item.id) ? (
                <ReorderControls
                  name={item.name}
                  canUp={pinnedIds.indexOf(item.id) > 0}
                  canDown={pinnedIds.indexOf(item.id) < pinnedIds.length - 1}
                  onMove={(dir) => move(item.id, dir)}
                />
              ) : null}
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

const PIN_COLOR = '#F5B301';
const HEADER_ICON_SIZE = 24;

/** 제목 왼쪽의 고정(즐겨찾기) 별. 고정 전에도 눈에 띄도록 윤곽선을 보조 글자색으로 그린다. */
function PinStar({
  name,
  pinned,
  onToggle,
}: {
  name: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${pinned ? '고정 해제' : '고정'}`}
      accessibilityState={{ selected: pinned }}
      hitSlop={10}
      onPress={onToggle}>
      <Ionicons
        name={pinned ? 'star' : 'star-outline'}
        size={24}
        color={pinned ? PIN_COLOR : t.subtext}
      />
    </Pressable>
  );
}

/** 순서 편집 중 고정한 카드의 위·아래 이동 버튼. */
function ReorderControls({
  name,
  canUp,
  canDown,
  onMove,
}: {
  name: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.pinCol}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} 위로 이동`}
        disabled={!canUp}
        hitSlop={8}
        onPress={() => onMove('up')}>
        <Ionicons name="chevron-up" size={24} color={canUp ? t.accent : t.border} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} 아래로 이동`}
        disabled={!canDown}
        hitSlop={8}
        onPress={() => onMove('down')}>
        <Ionicons name="chevron-down" size={24} color={canDown ? t.accent : t.border} />
      </Pressable>
    </View>
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
  pinCol: { gap: 8, alignItems: 'center' },
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

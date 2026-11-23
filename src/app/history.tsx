import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DeploymentStatus } from '@/features/notifications/contract';
import { syncedEventIds } from '@/features/notifications/deployment-sync-runner';
import { createLatestGuard } from '@/features/notifications/latest-guard';
import {
  clearHistory,
  loadHistory,
  removeHistory,
  subscribeHistory,
  toHistoryItem,
  type HistoryItem,
} from '@/features/notifications/history';
import {
  filterHistory,
  projectsInHistory,
  type HistoryFilter,
} from '@/features/notifications/history-filter';
import { useCatalog } from '@/features/projects/catalog-context';
import { useTheme } from '@/theme/theme';
import { hitSlopFor, minGapFor, verticalHitSlop } from '@/theme/touch';

const STATUS_FILTERS: { value: DeploymentStatus | undefined; label: string }[] = [
  { value: undefined, label: '전체' },
  { value: 'started', label: '시작' },
  { value: 'succeeded', label: '완료' },
  { value: 'failed', label: '실패' },
];

const STATUS_LABEL = { started: '🚀 배포 시작', succeeded: '✅ 배포 완료', failed: '❌ 배포 실패' } as const;

function formatTime(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={verticalHitSlop(CHIP_HEIGHT)}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent : 'transparent' },
      ]}>
      <Text style={{ color: selected ? t.onAccent : t.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const t = useTheme();
  const { find } = useCatalog();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>({});

  const all = useMemo(() => items ?? [], [items]);
  const projectIds = useMemo(() => projectsInHistory(all), [all]);
  // 선택한 프로젝트가 이력에서 사라지면(삭제 등) 필터를 풀어 빈 화면에 갇히지 않게 한다.
  const activeFilter = useMemo<HistoryFilter>(
    () =>
      filter.projectId && !projectIds.includes(filter.projectId)
        ? { ...filter, projectId: undefined }
        : filter,
    [filter, projectIds],
  );
  const visible = useMemo(() => filterHistory(all, activeFilter), [all, activeFilter]);

  // 읽기가 겹치면(화면 진입, 알림 수신, 배포 기록 보충) 가장 최근에 시작한 읽기의 결과만 반영한다.
  const [guard] = useState(createLatestGuard);

  useFocusEffect(
    useCallback(() => {
      const isCurrent = guard.begin();
      void loadHistory().then((list) => isCurrent() && setItems(list));
      return () => guard.cancel();
    }, [guard]),
  );

  // 화면이 열려 있는 동안 알림 수신·배포 기록 보충·삭제로 이력이 바뀌면 다시 읽는다.
  useEffect(() => {
    const unsubscribe = subscribeHistory(() => {
      const isCurrent = guard.begin();
      void loadHistory().then((list) => isCurrent() && setItems(list));
    });
    return () => {
      guard.cancel();
      unsubscribe();
    };
  }, [guard]);

  const clear = async () => {
    // 알림 센터에 남아 있지만 아직 이력에 없는 알림도 함께 기억해, 지운 뒤 앱을 열어도 되살아나지 않게 한다.
    const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
    const ids = presented.map(toHistoryItem).flatMap((i) => (i ? [i.eventId] : []));
    // 동기화로 알게 된 배포도 함께 기억해, 이력에 저장되지 못했던 항목이 다음 동기화에서 되살아나지 않게 한다.
    const synced = await syncedEventIds().catch(() => []);
    await clearHistory([...ids, ...synced]);
    setItems([]);
  };

  const remove = async (eventId: string) => {
    await removeHistory(eventId);
    setItems((prev) => (prev ? prev.filter((i) => i.eventId !== eventId) : prev));
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.background }]} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={visible}
        keyExtractor={(i) => i.eventId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.note, { color: t.subtext }]}>
              이 기기에서 받은 알림만 기록돼요(최근 50건). 알림 센터에서 미리 지운 알림은 남지 않을 수 있어요.
            </Text>
            {all.length > 0 ? (
              <>
                <View style={styles.chips}>
                  {STATUS_FILTERS.map((f) => (
                    <FilterChip
                      key={f.label}
                      label={f.label}
                      selected={activeFilter.status === f.value}
                      onPress={() => setFilter({ ...activeFilter, status: f.value })}
                    />
                  ))}
                </View>
                {projectIds.length > 1 ? (
                  <View style={styles.chips}>
                    <FilterChip
                      label="모든 프로젝트"
                      selected={!activeFilter.projectId}
                      onPress={() => setFilter({ ...activeFilter, projectId: undefined })}
                    />
                    {projectIds.map((id) => (
                      <FilterChip
                        key={id}
                        label={find(id)?.name ?? id}
                        selected={activeFilter.projectId === id}
                        onPress={() => setFilter({ ...activeFilter, projectId: id })}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          items === null ? undefined : (
            <Text style={[styles.empty, { color: t.subtext }]}>
              {all.length === 0 ? '아직 받은 배포 알림이 없어요.' : '조건에 맞는 알림이 없어요.'}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const project = find(item.projectId);
          const row = (
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.status, { color: t.text }]}>{STATUS_LABEL[item.status]}</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.time, { color: t.subtext }]}>{formatTime(item.receivedAt)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${project?.name ?? item.projectId} 알림 기록 삭제`}
                    hitSlop={hitSlopFor(CLOSE_ICON_SIZE)}
                    onPress={() => void remove(item.eventId)}>
                    <Ionicons name="close" size={CLOSE_ICON_SIZE} color={t.subtext} />
                  </Pressable>
                </View>
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

const CLOSE_ICON_SIZE = 18;
/** 필터 칩(글자 13px, 세로 패딩 6×2)의 대략적인 높이. */
const CHIP_HEIGHT = 28;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12 },
  header: { gap: 10, marginBottom: 4 },
  note: { fontSize: 12 },
  // 칩 모양은 그대로 두고 위아래 터치 영역만 늘리므로, 줄 사이 간격은 그 영역이 겹치지 않게 둔다.
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: minGapFor(CHIP_HEIGHT) },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { textAlign: 'center', marginTop: 48 },
  card: { padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 13 },
  clear: { alignSelf: 'center', padding: 16 },
});

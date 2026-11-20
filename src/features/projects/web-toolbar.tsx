import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';

type Props = {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onShare: () => void;
};

const ICON_SIZE = 26;

/**
 * 프로젝트(WebView) 화면 하단 툴바. 같은 아이콘 세트·크기로 통일하고 네 칸을 같은 너비로 나눈다.
 * 이동할 수 없는 방향은 흐리게 비활성으로 보여 준다.
 */
export function WebToolbar({ canGoBack, canGoForward, onBack, onForward, onReload, onShare }: Props) {
  const t = useTheme();
  const items: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    enabled: boolean;
    onPress: () => void;
  }[] = [
    { label: '뒤로', icon: 'chevron-back', enabled: canGoBack, onPress: onBack },
    { label: '앞으로', icon: 'chevron-forward', enabled: canGoForward, onPress: onForward },
    { label: '새로고침', icon: 'refresh', enabled: true, onPress: onReload },
    { label: '공유', icon: 'share-social-outline', enabled: true, onPress: onShare },
  ];
  return (
    <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          accessibilityState={{ disabled: !it.enabled }}
          disabled={!it.enabled}
          hitSlop={6}
          onPress={it.onPress}
          style={styles.item}>
          <Ionicons name={it.icon} size={ICON_SIZE} color={it.enabled ? t.accent : t.border} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});

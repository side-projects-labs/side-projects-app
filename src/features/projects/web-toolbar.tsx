import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme';

type Props = {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onShare: () => void;
};

/** 프로젝트(WebView) 화면 하단 툴바. 이동할 수 없는 방향은 비활성으로 보여 준다. */
export function WebToolbar({ canGoBack, canGoForward, onBack, onForward, onReload, onShare }: Props) {
  const t = useTheme();
  const items = [
    { label: '뒤로', glyph: '‹', enabled: canGoBack, onPress: onBack },
    { label: '앞으로', glyph: '›', enabled: canGoForward, onPress: onForward },
    { label: '새로고침', glyph: '↻', enabled: true, onPress: onReload },
    { label: '공유', glyph: '⤴', enabled: true, onPress: onShare },
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
          <Text style={[styles.glyph, { color: it.enabled ? t.accent : t.border }]}>{it.glyph}</Text>
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
  item: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  glyph: { fontSize: 26, lineHeight: 30 },
});

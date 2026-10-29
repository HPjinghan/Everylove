/**
 * 选项 primitive（D-100 纸面）：
 * - Chip：白底 r6 8×14、13/500 muted；选中 = primary 底白字 600。onboarding / 创造 / 身份 / 交友口味都用它。
 * - Segmented：分段控件——白底 r6 内距 3（或 paper 底，tone='paper'），选中块 r4 primary 白字；无描边。
 */

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '@/components/palette';
import { CONTROL_FONT_SCALE, Elevation, Shape, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  // 选中色跟所在的配色作用域走（D-258）
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && { backgroundColor: p.accent }, style]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'card',
  style,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  /** 底色：白（默认）或 paper（设置页语言分段） */
  tone?: 'card' | 'paper';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.seg, tone === 'paper' && styles.segPaper, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segItem, on && styles.segItemOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // 胶囊 chip：浅底黑字，选中 = 强调色底白字（白卡上、灰底上都看得见）
    chip: { backgroundColor: Romance.line, borderRadius: Shape.radiusPill, paddingVertical: 8, paddingHorizontal: 14 },
    chipText: { fontSize: Type.scale.label.size, fontWeight: '500', color: Romance.ink },
    chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
    // 分段控件：浅灰轨道里一块白色选中块（带一点浮起）
    seg: { flexDirection: 'row', backgroundColor: Romance.line, borderRadius: Shape.radius, padding: 2 },
    segPaper: { backgroundColor: Romance.line },
    segItem: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: Shape.radiusInner },
    segItemOn: { backgroundColor: Romance.card, ...Elevation.low },
    segText: { fontSize: Type.scale.label.size, fontWeight: '500', color: Romance.sub },
    segTextOn: { color: Romance.ink, fontWeight: '600' },
  })
);

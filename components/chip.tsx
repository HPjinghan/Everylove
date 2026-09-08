/**
 * 选项 primitive（D-100 纸面）：
 * - Chip：白底 r6 8×14、13/500 muted；选中 = primary 底白字 600。onboarding / 创造 / 身份 / 交友口味都用它。
 * - Segmented：分段控件——白底 r6 内距 3（或 paper 底，tone='paper'），选中块 r4 primary 白字；无描边。
 */

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Shape } from '@/constants/design';
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
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn, style]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
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
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.segItem, on && styles.segItemOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    chip: { backgroundColor: Romance.card, borderRadius: Shape.radius, paddingVertical: 8, paddingHorizontal: 14 },
    chipOn: { backgroundColor: Romance.accent },
    chipText: { fontSize: 13, fontWeight: '500', color: Romance.sub },
    chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
    seg: { flexDirection: 'row', backgroundColor: Romance.card, borderRadius: Shape.radius, padding: 3 },
    segPaper: { backgroundColor: Romance.bg },
    segItem: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: Shape.radiusInner },
    segItemOn: { backgroundColor: Romance.accent },
    segText: { fontSize: 13, fontWeight: '500', color: Romance.sub },
    segTextOn: { color: '#FFFFFF', fontWeight: '600' },
  })
);

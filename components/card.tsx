/**
 * 内容卡片 primitive（D-231）：浅灰底上的白卡、圆角 10、不描边不投影——手机 App 里的分组卡片。
 * 新界面的卡片一律用它；卡片内分区用细分隔线（Divider）。
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

/** 分区线（细线）；soft = 更浅一档，给同一组里行与行之间 */
export function Divider({ style, soft }: { style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[styles.divider, soft && styles.dividerSoft, style]} />;
}

const styles = themed(() =>
  StyleSheet.create({
    card: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
    },
    padded: { paddingVertical: Space.cardY, paddingHorizontal: Space.cardX },
    divider: { height: Shape.stroke, backgroundColor: Romance.stroke, alignSelf: 'stretch' },
    dividerSoft: { backgroundColor: Romance.line },
  })
);

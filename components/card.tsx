/**
 * 内容卡片 primitive（D-084，设计系统）：白色表面、圆角 6、1.5px 墨色描边、无阴影。
 * 新界面的卡片一律用它；卡片内分区用同样的描边线分隔（Divider），不用阴影或灰底。
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

/** 分区线；soft = 同一组里行与行之间的浅线（D-229：长列表行行都是墨线会显得格子很密），卡片边框照旧是墨线 */
export function Divider({ style, soft }: { style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[styles.divider, soft && styles.dividerSoft, style]} />;
}

const styles = themed(() =>
  StyleSheet.create({
    card: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
    },
    padded: { paddingVertical: Space.cardY, paddingHorizontal: Space.cardX },
    divider: { height: Shape.stroke, backgroundColor: Romance.stroke, alignSelf: 'stretch' },
    dividerSoft: { backgroundColor: Romance.line },
  })
);

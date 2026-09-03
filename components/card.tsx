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

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
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
  })
);

/**
 * 表单 primitive（D-100 纸面）：
 * - Field：字段标签 14/600 + 说明 11 muted，包住控件
 * - Input：白底 r6 内距 11×14、15 ink、无描边；占位符 muted。多行时顶部对齐。
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export function Field({
  label,
  hint,
  required,
  children,
  style,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.control}>{children}</View>
    </View>
  );
}

export function Input({ style, multiline, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={Romance.sub}
      {...props}
      multiline={multiline}
      style={[styles.input, multiline && styles.inputMulti, style]}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    field: { marginTop: 20 },
    label: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    hint: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    control: { marginTop: 8 },
    input: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingVertical: 11,
      paddingHorizontal: 14,
      fontSize: 15,
      color: Romance.ink,
    },
    inputMulti: { minHeight: 120, textAlignVertical: 'top', lineHeight: 22 },
  })
);

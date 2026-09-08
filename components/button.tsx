/**
 * 按钮 primitive（D-100 纸面）：
 * - primary：primary 底 + 1.5px ink 描边、白字 600（主按钮）
 * - secondary：白底、无描边、ink 600（次按钮）
 * - paper：paper 底、无描边、ink 600（取消 / 次要）
 * - outline：白底 + 1.5px 描边、primary 字 600（「编辑」这类文字动作按钮）
 * size：lg 15 字 · 13×20 内距 / md 14 字 · 11×18 / sm 13 字 · 8×14。禁用 opacity .4。
 */

import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'paper' | 'outline';
export type ButtonSize = 'lg' | 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    base: { borderRadius: Shape.radius, alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: Romance.accent, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    secondary: { backgroundColor: Romance.card },
    paper: { backgroundColor: Romance.bg },
    outline: { backgroundColor: Romance.card, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    size_lg: { paddingVertical: 13, paddingHorizontal: 20 },
    size_md: { paddingVertical: 11, paddingHorizontal: 18 },
    size_sm: { paddingVertical: 8, paddingHorizontal: 14 },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.8 },
    text: { fontWeight: '600' },
    text_primary: { color: '#FFFFFF' },
    text_secondary: { color: Romance.ink },
    text_paper: { color: Romance.ink },
    text_outline: { color: Romance.accent },
    textSize_lg: { fontSize: 15 },
    textSize_md: { fontSize: 14 },
    textSize_sm: { fontSize: 13 },
  })
);

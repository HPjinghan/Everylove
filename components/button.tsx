/**
 * 按钮 primitive（D-100 纸面）：
 * - primary：primary 底 + 1.5px ink 描边、白字 600（主按钮）
 * - secondary：白底、无描边、ink 600（次按钮）
 * - paper：paper 底、无描边、ink 600（取消 / 次要）
 * - outline：白底 + 1.5px 描边、primary 字 600（「编辑」这类文字动作按钮）
 * size：lg 15 字 · 13×20 内距 / md 14 字 · 11×18 / sm 13 字 · 8×14。禁用 opacity .4。
 * 连点冷却 600 ms（D-121，`cooldownMs`，0 关闭）：异步动作按钮不会在 disabled 生效前被点第二次。
 */

import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { MingCute, type MingCuteName } from '@/components/mingcute';
import { useGuardedPress } from '@/components/press-guard';
import { CONTROL_FONT_SCALE, Shape, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'paper' | 'outline' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  style,
  textStyle,
  cooldownMs,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** 连点冷却毫秒数，默认 600；0 = 不冷却 */
  cooldownMs?: number;
  /** 文字前的一枚小图标（D-229：按钮里不放 emoji） */
  icon?: MingCuteName;
}) {
  const press = useGuardedPress(onPress, cooldownMs);
  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon ? <MingCute name={icon} size={ICON_SIZE[size]} color={iconColor(variant)} /> : null}
      <Text
        style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const ICON_SIZE: Record<ButtonSize, number> = { lg: 20, md: 18, sm: 16 };

function iconColor(variant: ButtonVariant): string {
  if (variant === 'primary' || variant === 'danger') return '#FFFFFF';
  return variant === 'outline' ? Romance.accent : Romance.ink;
}

const styles = themed(() =>
  StyleSheet.create({
    base: { borderRadius: Shape.radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    primary: { backgroundColor: Romance.accent, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    // 破坏性动作（删除）：底色 danger（D-198）
    danger: { backgroundColor: Romance.danger, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    secondary: { backgroundColor: Romance.card },
    paper: { backgroundColor: Romance.bg },
    outline: { backgroundColor: Romance.card, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    size_lg: { paddingVertical: 13, paddingHorizontal: 20 },
    size_md: { paddingVertical: 11, paddingHorizontal: 18 },
    size_sm: { paddingVertical: 8, paddingHorizontal: 14 },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.8 },
    // 横排（图标 + 字）时字要能收：长标签照旧尾部省略，不撑出按钮
    text: { fontWeight: '600', flexShrink: 1 },
    text_primary: { color: '#FFFFFF' },
    text_danger: { color: '#FFFFFF' },
    text_secondary: { color: Romance.ink },
    text_paper: { color: Romance.ink },
    text_outline: { color: Romance.accent },
    textSize_lg: { fontSize: Type.scale.body.size },
    textSize_md: { fontSize: Type.scale.sub.size },
    textSize_sm: { fontSize: Type.scale.label.size },
  })
);

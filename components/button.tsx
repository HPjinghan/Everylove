/**
 * 按钮 primitive（D-231 小手机）：都不描边、不投影，圆角 12
 * - primary：强调色实底、白字（主按钮）
 * - secondary：强调色浅底、强调色字（次按钮）
 * - paper：浅灰底、黑字（取消 / 次要）
 * - outline：白底 + 细边、强调色字（「编辑」这类文字动作按钮）
 * - danger：红底白字（删除）
 * size：lg / md / sm 三档字号与内距。禁用 opacity .4。
 * 连点冷却 600 ms（D-121，`cooldownMs`，0 关闭）：异步动作按钮不会在 disabled 生效前被点第二次。
 */

import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { MingCute, type MingCuteName } from '@/components/mingcute';
import { usePalette } from '@/components/palette';
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
  // 强调色跟所在的配色作用域走（D-258：第三方 App 里不跟主题）
  const p = usePalette();
  const fill = variant === 'primary' ? { backgroundColor: p.accent } : variant === 'secondary' ? { backgroundColor: p.accentSoft } : null;
  const ink = variant === 'secondary' || variant === 'outline' ? { color: p.accent } : null;
  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fill,
        styles[`size_${size}`],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon ? <MingCute name={icon} size={ICON_SIZE[size]} color={ink?.color ?? iconColor(variant)} /> : null}
      <Text
        style={[styles.text, styles[`text_${variant}`], ink, styles[`textSize_${size}`], textStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const ICON_SIZE: Record<ButtonSize, number> = { lg: 20, md: 18, sm: 16 };

/** 实底按钮上的白图标；有色字的（secondary / outline）在组件里按作用域取 */
function iconColor(variant: ButtonVariant): string {
  return variant === 'primary' || variant === 'danger' ? '#FFFFFF' : Romance.ink;
}

const styles = themed(() =>
  StyleSheet.create({
    base: { borderRadius: Shape.radiusButton, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    primary: {},
    // 破坏性动作（删除）：底色 danger（D-198）
    danger: { backgroundColor: Romance.danger },
    secondary: {},
    paper: { backgroundColor: Romance.line },
    outline: { backgroundColor: Romance.card, borderWidth: Shape.border, borderColor: Romance.stroke },
    size_lg: { paddingVertical: 13, paddingHorizontal: 20 },
    size_md: { paddingVertical: 11, paddingHorizontal: 18 },
    size_sm: { paddingVertical: 8, paddingHorizontal: 14 },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.8 },
    // 横排（图标 + 字）时字要能收：长标签照旧尾部省略，不撑出按钮
    text: { fontWeight: '600', flexShrink: 1 },
    text_primary: { color: '#FFFFFF' },
    text_danger: { color: '#FFFFFF' },
    text_secondary: {},
    text_paper: { color: Romance.ink },
    text_outline: {},
    textSize_lg: { fontSize: Type.scale.body.size },
    textSize_md: { fontSize: Type.scale.sub.size },
    textSize_sm: { fontSize: Type.scale.label.size },
  })
);

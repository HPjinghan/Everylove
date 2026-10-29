import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixedPalette, usePalette } from '@/components/palette';
import { useGuardedPress } from '@/components/press-guard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CONTROL_FONT_SCALE, Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

/** 纯拉丁的 App 名（Message / X）走 Fredoka——设计系统「数字与拉丁标签」那一档（D-206） */
const LATIN = /^[A-Za-z0-9 .]+$/;

/**
 * 手机壳内 App 的通用外框（D-021；D-231 小手机）：白色顶栏、居中标题、左「‹ 桌面」强调色、
 * 右动作槽（用 HeaderAction，强调色）、下沿一根细线；内容区浅灰底。桌面制导航深度 +1，返回必须处处可达。
 */
export function AppScreen({
  title,
  children,
  right,
  onBack,
  fixedPalette,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  /** 覆盖返回行为（新手流逃生门等场景，D-058） */
  onBack?: () => void;
  /** 第三方类 App 不跟主题（D-258）：整页用 BASE_PALETTE */
  fixedPalette?: boolean;
}) {
  const screen = (
    <Frame title={title} right={right} onBack={onBack}>
      {children}
    </Frame>
  );
  return fixedPalette ? <FixedPalette>{screen}</FixedPalette> : screen;
}

function Frame({ title, children, right, onBack }: { title: string; children: ReactNode; right?: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = usePalette();
  return (
    <View style={[styles.screen, { backgroundColor: p.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() =>
            onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/')
          }
          hitSlop={10}
          accessibilityLabel={t('返回')}
          style={styles.back}>
          <IconSymbol name="chevron.left" size={18} color={p.accent} />
          <Text style={[styles.backText, { color: p.accent }]} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>{t('桌面')}</Text>
        </Pressable>
        <Text style={[styles.title, LATIN.test(title) && styles.titleLatin]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** 顶栏右侧的文字动作：14/600 primary（禁用 muted） */
export function HeaderAction({
  label,
  onPress,
  disabled,
  cooldownMs,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** 连点冷却毫秒数（D-121），默认 600；0 = 不冷却 */
  cooldownMs?: number;
}) {
  const press = useGuardedPress(onPress, cooldownMs);
  const p = usePalette();
  return (
    <Pressable onPress={press} disabled={disabled} hitSlop={10}>
      <Text style={[styles.action, { color: p.accent }, disabled && styles.actionDisabled]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Space.screen,
      paddingBottom: 10,
      // 顶栏白底、一条细分隔线下沿（D-231）
      backgroundColor: Romance.card,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    back: { flexDirection: 'row', alignItems: 'center', width: Space.topBarSlot, gap: 2 },
    backText: { fontSize: Type.scale.nav.size, fontWeight: '400' },
    title: { flex: 1, textAlign: 'center', fontSize: Type.scale.screenTitle.size, fontWeight: '600', color: Romance.ink },
    titleLatin: { fontFamily: Fonts.labelBold, fontWeight: '400', fontSize: Type.scale.lg.size },
    right: { width: Space.topBarSlot, alignItems: 'flex-end' },
    action: { fontSize: Type.scale.nav.size, fontWeight: '600' },
    actionDisabled: { color: Romance.sub },
    body: { flex: 1 },
  })
);

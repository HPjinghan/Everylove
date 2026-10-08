import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiamondBackground } from '@/components/paper-bg';
import { useGuardedPress } from '@/components/press-guard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

/** 纯拉丁的 App 名（Message / X）走 Fredoka——设计系统「数字与拉丁标签」那一档（D-206） */
const LATIN = /^[A-Za-z0-9 .]+$/;

/**
 * 手机壳内 App 的通用外框（D-021；D-100 纸面）：顶栏透底、居中中文标题 17/600、左「‹ 桌面」14/500、
 * 右动作槽（用 HeaderAction：14/600 primary）、下沿 1.5px ink；左右槽位各 70。
 * pattern：paper 底上铺菱格暗纹（交友 / 缔结这类浅内容页）。桌面制导航深度 +1，返回必须处处可达。
 */
export function AppScreen({
  title,
  children,
  right,
  onBack,
  pattern,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  /** 覆盖返回行为（新手流逃生门等场景，D-058） */
  onBack?: () => void;
  /** 底上铺菱格暗纹（Pattern.diamond） */
  pattern?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.screen}>
      {pattern ? <DiamondBackground /> : null}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Pressable
          onPress={() =>
            onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/')
          }
          hitSlop={10}
          accessibilityLabel={t('返回')}
          style={styles.back}>
          <IconSymbol name="chevron.left" size={16} color={Romance.ink} />
          <Text style={styles.backText}>{t('桌面')}</Text>
        </Pressable>
        <Text style={[styles.title, LATIN.test(title) && styles.titleLatin]} numberOfLines={1}>
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
  return (
    <Pressable onPress={press} disabled={disabled} hitSlop={10}>
      <Text style={[styles.action, disabled && styles.actionDisabled]} numberOfLines={1}>
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
      paddingTop: 8,
      paddingBottom: 10,
      // 顶栏透底、只有一条 1.5px 墨色下沿
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    back: { flexDirection: 'row', alignItems: 'center', width: Space.topBarSlot, gap: 2 },
    backText: { fontSize: Type.scale.sub.size, fontWeight: '500', color: Romance.ink },
    title: { flex: 1, textAlign: 'center', fontSize: Type.scale.screenTitle.size, fontWeight: '600', color: Romance.ink },
    titleLatin: { fontFamily: Fonts.labelBold, fontWeight: '400', fontSize: Type.scale.lg.size },
    right: { width: Space.topBarSlot, alignItems: 'flex-end' },
    action: { fontSize: Type.scale.sub.size, fontWeight: '600', color: Romance.accent },
    actionDisabled: { color: Romance.sub },
    body: { flex: 1 },
  })
);

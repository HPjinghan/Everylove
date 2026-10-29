/**
 * 桌面的外出小组件（D-262）：占 2×2 格，网格里和图标一样能拖。
 * 放一个此刻值得去的地点（lib/presence.ts featuredPlace）：她正在的那场 / TA 在等她 / 今天晚些有约 / 有认识的 TA 在、人多的 / 广场；
 * 像素小场景跟着昼夜与营业换样子，下面一行地点名 + 和地点卡同一句状态。只数人不报名字。点一下直接进那个地点（桌面那边接）。
 * 每分钟看一眼钟（谁在按小时变、营业按分钟变）——钟在组件自己里面走，不带动整个桌面重绘（同 D-197 的时钟）。
 */

import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PixelArt } from '@/components/pixel-art';
import { WIDGET_TINT } from '@/constants/apps';
import { CONTROL_FONT_SCALE, Elevation, Shape, Type } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { clockTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { sessionExpired } from '@/lib/outing';
import { dayPartOf, featuredPlace, isOpen, presenceAt, type Featured } from '@/lib/presence';
import { useAppStore } from '@/store/app-store';

const TICK_MS = 60_000;
/** 地点名 + 状态两行的高度带（字号 label + timestamp 加上下留白） */
const FOOTER_H = 44;

/** 此刻放哪个地点：订阅约定、会话、羁绊，再每分钟重算一次 */
export type FeaturedNow = Featured & { name?: string; night: boolean };

export function useFeaturedPlace(): FeaturedNow {
  const bonds = useAppStore((s) => s.bonds);
  const plans = useAppStore((s) => s.outingPlans);
  const session = useAppStore((s) => s.outingSession);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const nameOf = (characterId: string) => bonds.find((b) => b.characterId === characterId)?.name;
  const live = session && !session.ended && !sessionExpired(session, now) ? session.placeId : null;
  const f = featuredPlace({
    now,
    presence: presenceAt(new Date(now)),
    plans: plans.filter((p) => nameOf(p.characterId)),
    sessionPlaceId: live,
  });
  const d = new Date(now);
  // 夜里或打烊了换夜色（同外出页）
  const night = dayPartOf(d) === 'night' || !isOpen(f.place, d);
  return 'characterId' in f ? { ...f, name: nameOf(f.characterId), night } : { ...f, night };
}

function statusOf(f: FeaturedNow): { text: string; clock?: string } {
  switch (f.kind) {
    case 'here':
      return { text: t('你在这儿') };
    case 'waiting':
      return { text: t('{name} 在等你', { name: f.name ?? '' }) };
    case 'planned':
      return {
        text: t('和{name}有约', { name: f.name ?? '' }),
        clock: f.at ? clockTime(f.at) : undefined,
      };
    case 'people':
      return { text: t('这里有 {n} 个人', { n: f.n }) };
    case 'closed':
      return { text: t('打烊了') };
    default:
      return { text: t('这会儿没人') };
  }
}

export function OutingWidget({
  pressFor,
  width,
  height,
  wiggle,
  onPhoto = false,
}: {
  /** 桌面给的按压行为（点一下进地点、长按 / 编辑模式拖动）；拖拽浮层里不给 */
  pressFor?: (route: string) => PressableProps;
  /** 方块的宽高（不含下面的名字） */
  width: number;
  height: number;
  wiggle: Animated.Value;
  /** 壁纸是照片：下面的名字换白字（同图标名，D-258） */
  onPhoto?: boolean;
}) {
  // 抖动幅度比图标小：方块大，同样的角度看着晃得厉害
  const rotate = wiggle.interpolate({
    inputRange: [0, 1],
    outputRange: ['-1deg', '1deg'],
  });
  const featured = useFeaturedPlace();
  const { place, night } = featured;
  const status = statusOf(featured);
  const art = Math.round(Math.min(width * 0.6, (height - FOOTER_H) * 0.9));
  return (
    <Pressable style={styles.cell} {...pressFor?.(`/outing/${place.id}`)}>
      <Animated.View
        style={[styles.wrap, { transform: [{ rotate }] }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('外出')}，${t(place.name)}，${status.text}`}>
        <View
          style={[
            styles.box,
            {
              width,
              height,
              backgroundColor: night ? WIDGET_TINT.outingNight : WIDGET_TINT.outing,
            },
          ]}>
          <View style={styles.art}>
            <PixelArt id={place.id} size={art} night={night} />
          </View>
          <View style={styles.footer}>
            <Text style={[styles.place, night && styles.onDark]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
              {t(place.name)}
            </Text>
            <Text style={[styles.status, night && styles.onDarkSub]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
              {status.text}
              {status.clock ? <Text style={styles.clock}> · {status.clock}</Text> : null}
            </Text>
          </View>
        </View>
        <Text style={[styles.label, onPhoto && styles.labelOnPhoto]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
          {t('外出')}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    wrap: { alignItems: 'center' },
    box: {
      borderRadius: Shape.radiusWidget,
      overflow: 'hidden',
      ...Elevation.low,
    },
    art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    footer: {
      height: FOOTER_H,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },
    place: {
      fontSize: Type.scale.label.size,
      fontWeight: '600',
      color: Romance.ink,
    },
    status: {
      fontSize: Type.scale.timestamp.size,
      fontWeight: '500',
      color: withAlpha(Romance.ink, 0.6),
      marginTop: 1,
    },
    clock: { fontFamily: Fonts.label },
    onDark: { color: '#FFFFFF' },
    onDarkSub: { color: withAlpha('#FFFFFF', 0.8) },
    // 同桌面图标名（app/index.tsx iconLabel / onPhoto）
    label: {
      fontSize: Type.scale.caption.size,
      fontWeight: '500',
      color: Romance.ink,
      marginTop: 6,
    },
    labelOnPhoto: {
      color: '#FFFFFF',
      textShadowColor: withAlpha(Romance.ink, 0.45),
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  })
);

/**
 * 升级时刻（D-208）：羁绊在会话里升了一级——不只是一条系统条，屏幕暗下来、TA 的立绘和新的等级一起浮上来，
 * success 震动；点一下或 4 秒后自己退。系统条照旧留在会话里（store appendBond 写的「羁绊升级 · LVn · 阶段」）。
 * 只在她正看着这段会话时升级才演（打开那一刻的等级记为已看过）；离开时升的，回来只看到系统条。
 * 纸面：遮罩 ink 60%（withAlpha），白卡 1.5px 描边 r6，等级 Fredoka 大字、阶段名系统字体；无阴影无渐变。
 */

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { CharAvatar } from '@/components/char-avatar';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { LEVEL_NAMES, levelOf, MAX_LEVEL } from '@/lib/bond';
import { haptic } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/** 自己退场前停多久 */
const HOLD_MS = 4000;

export function LevelUpMoment({ bondId, name, color, characterId }: { bondId: string; name: string; color: string; characterId?: string }) {
  const level = useAppStore((s) => {
    const b = s.bonds.find((x) => x.id === bondId);
    return b ? (b.levelShown ?? levelOf(b)) : 0;
  });
  // 打开会话那一刻的等级算「看过了」；之后涨上去的才演
  const [seen, setSeen] = useState(level);
  const visible = level > seen;

  useEffect(() => {
    if (!visible) return;
    haptic.success();
    const timer = setTimeout(() => setSeen(level), HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible, level]);

  const stage = LEVEL_NAMES[Math.min(MAX_LEVEL, Math.max(1, level)) - 1];
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => setSeen(level)}>
      <Pressable style={styles.fill} onPress={() => setSeen(level)} accessibilityLabel={t('关闭')}>
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.scrim} />
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.card}>
          <CharAvatar name={name} color={color} size={112} characterId={characterId} />
          <Text style={styles.eyebrow}>{t('羁绊升级')}</Text>
          <Text style={styles.level}>LV{level}</Text>
          <Text style={styles.stage}>{t(stage)}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(Romance.ink, 0.6) },
    card: {
      width: 240,
      alignItems: 'center',
      paddingVertical: 26,
      paddingHorizontal: Space.cardX,
      backgroundColor: Romance.card,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radius,
    },
    eyebrow: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.sub, marginTop: 18 },
    level: { fontFamily: Fonts.labelBold, fontSize: 56, lineHeight: 60, color: Romance.accentStrong, marginTop: 2 },
    stage: { fontSize: Type.scale.xl.size, fontWeight: '600', color: Romance.ink },
  })
);

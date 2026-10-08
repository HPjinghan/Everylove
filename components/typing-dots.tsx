/**
 * 「正在输入」三个点（D-207）：TA 气泡里三颗 6px 小方块依次轻跳，代替「正在输入…」字样；读屏仍念「正在输入…」。
 * 纸面：muted 色、r2（同气泡尾角），无阴影；Reanimated 跑在 UI 线程，回合再长也不卡。
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

const DOT = 6;
/** 一颗点起落一次的时长；三颗之间错开 STAGGER */
const BEAT_MS = 280;
const STAGGER_MS = 140;
const LIFT = 4;

function Dot({ v }: { v: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -LIFT * v.get() }],
    opacity: 0.45 + 0.55 * v.get(),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function TypingDots() {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const c = useSharedValue(0);
  useEffect(() => {
    const vals = [a, b, c];
    vals.forEach((v, i) => {
      v.set(
        withDelay(
          i * STAGGER_MS,
          withRepeat(
            withSequence(
              withTiming(1, { duration: BEAT_MS }),
              withTiming(0, { duration: BEAT_MS }),
              // 三颗都落下后停一拍再来
              withTiming(0, { duration: STAGGER_MS * 2 })
            ),
            -1
          )
        )
      );
    });
    return () => vals.forEach((v) => cancelAnimation(v));
  }, [a, b, c]);
  return (
    <View style={styles.row} accessible accessibilityLabel={t('正在输入…')}>
      <Dot v={a} />
      <Dot v={b} />
      <Dot v={c} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 2 },
    dot: { width: DOT, height: DOT, borderRadius: Shape.radiusTail, backgroundColor: Romance.sub },
  })
);

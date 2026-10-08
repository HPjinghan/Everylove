/**
 * 等待态 = 戏里的状态（D-209）：生图要等的地方不转圈，画成一张正在显影的相纸——
 * 墨色底慢慢一明一暗（拍立得刚吐出来那几十秒的样子），下面一行字随时间往下走（「相纸在慢慢显影…」→「快好了…」），走到最后一句停住不循环。
 * DevelopingFilm = 只有那块正在显影的底（会话里 TA 发来的照片、立绘位）；DevelopingPolaroid = 带白框相纸（外出拍照）。
 * 纸面：ink 底 + 白框描边同拍立得，无阴影无渐变；Reanimated 跑 UI 线程。
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { tiltFor } from '@/components/polaroid';
import { Shape, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

/** 一明一暗一次的时长 */
const PULSE_MS = 1400;

/** 一组字按时间往下走，走到最后一句停住 */
export function useStepLine(lines: string[], stepMs: number): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lines.length < 2) return;
    const timer = setInterval(() => setI((n) => Math.min(lines.length - 1, n + 1)), stepMs);
    return () => clearInterval(timer);
  }, [lines.length, stepMs]);
  return lines[Math.min(i, lines.length - 1)] ?? '';
}

/** 正在显影的一块底：ink 色，透明度在 0.55 ↔ 0.9 之间慢慢呼吸 */
export function DevelopingFilm({ width, height, style }: { width: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(v);
  }, [v]);
  const breathe = useAnimatedStyle(() => ({ opacity: 0.9 - 0.35 * v.get() }));
  return <Animated.View style={[styles.film, { width, height: height ?? width }, style, breathe]} />;
}

/** 带白框的显影相纸（同 Polaroid 的框：白底 1.5px 描边 r6、内距 6/6/16、按 key 微微歪着） */
export function DevelopingPolaroid({
  width = 210,
  lines,
  stepMs = 8000,
  tiltKey,
}: {
  width?: number;
  lines: string[];
  stepMs?: number;
  tiltKey?: string;
}) {
  const line = useStepLine(lines, stepMs);
  const pad = 6;
  const img = width - pad * 2 - Shape.stroke * 2;
  const rotate = tiltKey ? `${tiltFor(tiltKey)}deg` : '0deg';
  return (
    <View style={[styles.frame, { width, transform: [{ rotate }] }]} accessible accessibilityLabel={line}>
      <DevelopingFilm width={img} style={styles.filmInFrame} />
      <Text style={styles.caption} numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    film: { backgroundColor: Romance.ink, borderRadius: Shape.radiusInner },
    filmInFrame: { borderRadius: Shape.radiusInner },
    frame: {
      backgroundColor: Romance.card,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radius,
      paddingTop: 6,
      paddingHorizontal: 6,
      paddingBottom: 16,
      alignItems: 'center',
    },
    caption: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 8, textAlign: 'center' },
  })
);

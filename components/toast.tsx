/**
 * 轻提示（D-079；D-100 纸面：ink 底白字 r6、无阴影）：全局一条，顶部淡入、两秒多后淡出（可指定停留时长，D-110 模型失败只停 1 秒）；任何地方 showToast() 即可。
 * 宿主 <ToastHost /> 挂在根布局；不在树上时 showToast 静默。
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useAnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Shape, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

let emit: ((text: string, durationMs: number) => void) | null = null;

export const TOAST_DEFAULT_MS = 2600;

export function showToast(text: string, opts: { durationMs?: number } = {}): void {
  emit?.(text, opts.durationMs ?? TOAST_DEFAULT_MS);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const opacity = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 排队（D-198）：一条在显示时来了下一条，等它淡出再显示，不互相覆盖（与 showAlert 的排队口径一致）
  const queue = useRef<{ text: string; durationMs: number }[]>([]);
  const showing = useRef(false);
  useEffect(() => {
    const show = (next: string, durationMs: number) => {
      showing.current = true;
      setText(next);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
          setText(null);
          showing.current = false;
          const q = queue.current.shift();
          if (q) show(q.text, q.durationMs);
        });
      }, durationMs);
    };
    emit = (next, durationMs) => {
      if (showing.current) {
        // 同一句连着来只留一条
        if (queue.current.some((q) => q.text === next)) return;
        queue.current.push({ text: next, durationMs });
        return;
      }
      show(next, durationMs);
    };
    return () => {
      emit = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!text) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10, opacity }]}>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      alignSelf: 'center',
      maxWidth: '82%',
      backgroundColor: Romance.ink,
      borderRadius: Shape.radius,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    text: { color: '#FFFFFF', fontSize: Type.scale.label.size, fontWeight: '500', textAlign: 'center' },
  })
);

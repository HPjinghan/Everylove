/**
 * 轻提示（D-079；D-100 纸面：ink 底白字 r6、无阴影）：全局一条，顶部淡入、两秒多后淡出；任何地方 showToast() 即可。
 * 宿主 <ToastHost /> 挂在根布局；不在树上时 showToast 静默。
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useAnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

let emit: ((text: string) => void) | null = null;

export function showToast(text: string): void {
  emit?.(text);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const opacity = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    emit = (next) => {
      setText(next);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() =>
          setText(null)
        );
      }, 2600);
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
    text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  })
);

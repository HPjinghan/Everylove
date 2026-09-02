/**
 * 轻提示（D-079）：全局一条，顶部淡入、两秒多后淡出；任何地方 showToast() 即可（照片洗好了……）。
 * 宿主 <ToastHost /> 挂在根布局；不在树上时 showToast 静默。
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themed } from '@/constants/theme';

let emit: ((text: string) => void) | null = null;

export function showToast(text: string): void {
  emit?.(text);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
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
      backgroundColor: 'rgba(58,33,38,0.88)',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  })
);

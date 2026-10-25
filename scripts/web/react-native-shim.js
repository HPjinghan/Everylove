/**
 * 网页预览用的 react-native 补丁（metro.config.js 只在 web 平台把 'react-native' 指到这里）：
 * react-native-web 没有 useAnimatedValue / useAnimatedValueXY，这里照 RN 的语义补上，其余原样转出。
 * 只为开发时在浏览器里看界面；App 本身（iOS）不经过这个文件。
 */
import { useState } from 'react';
import { Animated } from 'react-native-web/dist/index';

export * from 'react-native-web/dist/index';

export function useAnimatedValue(initialValue, config) {
  const [value] = useState(() => new Animated.Value(initialValue, config));
  return value;
}

export function useAnimatedValueXY(initialValue, config) {
  const [value] = useState(() => new Animated.ValueXY(initialValue, config));
  return value;
}

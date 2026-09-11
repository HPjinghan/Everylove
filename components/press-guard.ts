/**
 * 点击冷却（D-121）：连点只认第一下。
 * 异步动作按钮的 `disabled` 要等一次渲染才生效，快速连点会在这个空档里跑两次——
 * 这里用 ref 同步记下上一次放行的时间，冷却期内的按压直接吞掉，不依赖渲染。
 * Button / HeaderAction 默认开启；确实需要连点的按钮传 cooldownMs={0}。
 */

import { useRef } from 'react';

export const DEFAULT_PRESS_COOLDOWN_MS = 600;

export function useGuardedPress(onPress: (() => void) | undefined, cooldownMs = DEFAULT_PRESS_COOLDOWN_MS) {
  const lastRef = useRef(0);
  if (!onPress || cooldownMs <= 0) return onPress;
  return () => {
    const now = Date.now();
    if (now - lastRef.current < cooldownMs) return;
    lastRef.current = now;
    onPress();
  };
}

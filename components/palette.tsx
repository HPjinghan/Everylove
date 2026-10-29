/**
 * 配色作用域（D-258）：主题只管系统向 App；第三方类 App（X / 交友 / 外卖 / 幸运签）不跟主题。
 * `<AppScreen fixedPalette>` 把整页圈进 FixedPalette，里面的 primitive（AppScreen / Button / Chip）
 * 经 usePalette() 拿 BASE_PALETTE 的强调色；圈外拿 Romance（当前主题）。中性色两边一样，不用经这里。
 */

import { createContext, useContext, type ReactNode } from 'react';

import { BASE_PALETTE, Romance, type RomancePalette } from '@/constants/theme';

const FixedContext = createContext(false);

export function FixedPalette({ children }: { children: ReactNode }) {
  return <FixedContext.Provider value>{children}</FixedContext.Provider>;
}

/** 当前作用域的配色：第三方 App 里是不跟主题的那套，别处是当前主题 */
export function usePalette(): RomancePalette {
  return useContext(FixedContext) ? BASE_PALETTE : Romance;
}

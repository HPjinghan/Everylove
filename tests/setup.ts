/**
 * 测试环境（node，无 React Native）：把带原生依赖的模块换成最小桩。
 * - AsyncStorage → 内存实现（zustand persist 与天气缓存用）
 * - react-native → 只提供用到的几个静态对象
 * - constants/theme → 只提供 applyThemeColors（store 调）
 * - lib/weather → 固定的天气句（prompt 快照要确定性）
 */
import { vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
    removeItem: async (k: string) => void mem.delete(k),
    clear: async () => mem.clear(),
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  AppState: { addEventListener: () => ({ remove() {} }) },
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
}));

vi.mock('react-native-url-polyfill/auto', () => ({}));

vi.mock('@/constants/theme', () => ({
  applyThemeColors: () => {},
  Romance: {},
  Fonts: {},
  themed: (f: () => unknown) => f(),
}));

vi.mock('@/lib/weather', () => ({
  weatherLine: () => '今天多云，22°C',
  todayWeather: () => ({}),
  weatherFor: () => ({}),
  initWeather: async () => {},
  refreshWeather: async () => false,
}));

vi.mock('@/components/toast', () => ({ showToast: () => {} }));

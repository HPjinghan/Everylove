/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * 主题系统（D-030）：设置 → 主题可切换配色，真正全局生效。
 * 机制：Romance 是可变对象（applyThemeColors 时被整体覆写）；各文件的模块级
 * StyleSheet.create 都包在 themed(() => ...) 里——themed 返回按 themeVersion 缓存的
 * Proxy，切主题后根布局以 key 重挂载全树，样式在访问时按新配色重建。
 */

export interface RomancePalette {
  bg: string;
  card: string;
  ink: string;
  sub: string;
  faint: string;
  accent: string;
  accentSoft: string;
  line: string;
  gold: string;
  night: string;
  bubbleHim: string;
  bubbleMe: string;
  danger: string;
}

export const THEMES: Record<string, { label: string; colors: RomancePalette }> = {
  peach: {
    label: '蜜桃',
    colors: {
      bg: '#FFF0F4', card: '#FFFFFF', ink: '#4A2B36', sub: '#A97F8D', faint: '#D0AEBB',
      accent: '#F5749B', accentSoft: '#FFE1EA', line: '#F9DBE4', gold: '#E0B98A',
      night: '#3A2A3E', bubbleHim: '#FFFFFF', bubbleMe: '#F5749B', danger: '#E0607A',
    },
  },
  soda: {
    label: '苏打',
    colors: {
      bg: '#EFF5FF', card: '#FFFFFF', ink: '#2B3A55', sub: '#7F90A9', faint: '#AEBDD0',
      accent: '#6E9BF0', accentSoft: '#E0EAFF', line: '#DBE6F9', gold: '#E0C08A',
      night: '#2A2F3E', bubbleHim: '#FFFFFF', bubbleMe: '#6E9BF0', danger: '#E0607A',
    },
  },
  matcha: {
    label: '抹茶',
    colors: {
      bg: '#F0F7EF', card: '#FFFFFF', ink: '#2F4A35', sub: '#84A98C', faint: '#AECFB4',
      accent: '#5FB878', accentSoft: '#DFF2E3', line: '#DDEDDF', gold: '#D9BE8A',
      night: '#2A3E2E', bubbleHim: '#FFFFFF', bubbleMe: '#5FB878', danger: '#E0607A',
    },
  },
  grape: {
    label: '葡萄',
    colors: {
      bg: '#F6F0FB', card: '#FFFFFF', ink: '#43305A', sub: '#9B87B3', faint: '#C4B3D6',
      accent: '#A879DE', accentSoft: '#EFE2FC', line: '#E9DDF6', gold: '#E0B98A',
      night: '#32283E', bubbleHim: '#FFFFFF', bubbleMe: '#A879DE', danger: '#E0607A',
    },
  },
};

export const DEFAULT_THEME_ID = 'peach';

/** 全局可变配色对象：applyThemeColors 覆写；界面里 Romance.x 的内联引用在重挂载后取到新值 */
export const Romance: RomancePalette = { ...THEMES[DEFAULT_THEME_ID].colors };

let themeVersion = 0;

export function applyThemeColors(id: string): void {
  const theme = THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
  Object.assign(Romance, theme.colors);
  themeVersion++;
}

/**
 * 包住模块级 StyleSheet.create：返回按 themeVersion 缓存重建的样式代理。
 * 切主题 → 根布局 key 重挂载 → 组件重新访问 styles.x → 工厂按新 Romance 重跑。
 */
export function themed<T extends object>(factory: () => T): T {
  let cachedVersion = -1;
  let cached: T | null = null;
  return new Proxy({} as T, {
    get(_target, prop) {
      if (cachedVersion !== themeVersion || cached === null) {
        cached = factory();
        cachedVersion = themeVersion;
      }
      return (cached as Record<PropertyKey, unknown>)[prop];
    },
  });
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

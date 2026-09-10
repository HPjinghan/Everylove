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
 * 主题系统（D-030；D-083 接入设计系统）：设置 → 主题可切换配色，真正全局生效。
 * 「纸面」= Claude Design 设计系统的色彩 token（design/design-system.page.html）；非色彩规格在 constants/design.ts。
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
  /** 浅色分隔线 / 占位底：hairline 与浅底都用它 */
  line: string;
  /** 结构性描边（D-083 设计系统：1.5px ink——内容卡片、主按钮、顶栏下沿、输入栏上沿） */
  stroke: string;
  /** 唯一强调色（D-083：数据高亮、暗纹与壁纸线条） */
  accentStrong: string;
  gold: string;
  night: string;
  bubbleHim: string;
  bubbleMe: string;
  danger: string;
}

/**
 * 主题只有一套（D-110）：「纸面」= Claude Design「Everylove - Design System」的色彩 token 原样映射——
 * paper #FFD6E7 / primary #E8578A / accent #C2185B / ink #4A2B36 / muted #A97F8D / surface #FFFFFF / chat paper #FBE4EC。
 * faint 与 line 设计稿没给（它只用 muted 一档），按 paper→muted 之间取的浅色。
 * 换主题 = 换壁纸（设置 → 主题只剩壁纸一排）：壁纸给纸面换一块底色 + 配套的两档浅色（accentSoft / line），
 * ink / primary / accent 不动——主页与里面的每一屏跟着同一块纸走（constants/apps.ts WALLPAPERS）。
 * 蜜桃 / 苏打 / 抹茶 / 葡萄四套配色已下线。
 */
export const THEMES: Record<'paper', { label: string; colors: RomancePalette }> = {
  paper: {
    label: '纸面',
    colors: {
      bg: '#FFD6E7', card: '#FFFFFF', ink: '#4A2B36', sub: '#A97F8D', faint: '#C9A9B6',
      accent: '#E8578A', accentSoft: '#FBE4EC', line: '#F3C4D5', stroke: '#4A2B36', accentStrong: '#C2185B',
      gold: '#E0B98A', night: '#3A2A3E', bubbleHim: '#FFFFFF', bubbleMe: '#E8578A', danger: '#C2185B',
    },
  },
};

/** 唯一主题 id（D-083 / D-110）：store.themeId 只作旧存档兼容，代码不再读 */
export const DEFAULT_THEME_ID = 'paper';

/** 壁纸给纸面换的色（D-110）：底色 + 聊天纸 / 分隔线两档浅色；三者留空 = 纸面原色 */
export interface PaperTint {
  bg?: string;
  accentSoft?: string;
  line?: string;
}

/** token 色的半透明版（D-100）：遮罩 / 暗场用它，不手写 rgba；只接受 #RRGGBB */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 全局可变配色对象：applyThemeColors 覆写；界面里 Romance.x 的内联引用在重挂载后取到新值 */
export const Romance: RomancePalette = { ...THEMES[DEFAULT_THEME_ID].colors };

let themeVersion = 0;

/**
 * 应用壁纸（D-110）：纸面配色 + 壁纸的色。传空 = 纸面原色。
 * 桌面、Dock 图块、每个 App 的底、聊天纸都读 Romance，所以主页换了色，里面跟着换。
 */
export function applyPaperTint(tint: PaperTint = {}): void {
  Object.assign(Romance, THEMES.paper.colors, {
    bg: tint.bg ?? THEMES.paper.colors.bg,
    accentSoft: tint.accentSoft ?? THEMES.paper.colors.accentSoft,
    line: tint.line ?? THEMES.paper.colors.line,
  });
  themeVersion++;
}

/** 旧名兼容：主题只剩纸面，参数忽略 */
export function applyThemeColors(_id?: string): void {
  applyPaperTint();
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

/** 设计系统字体（D-084）：label = Fredoka 500（数字、标签、导航、时间戳）、labelBold = Fredoka 600（时钟、标题、按钮）；正文用系统字体。字体在 app/_layout.tsx 用 useFonts 加载 */
const FREDOKA = { label: 'Fredoka_500Medium', labelBold: 'Fredoka_600SemiBold' };
/** 头像单字（D-100）：设计稿用 Noto Serif SC；iOS 不带它，用系统自带的宋体（Songti SC）代替，不另装 CJK 字体 */
const INITIAL_IOS = 'Songti SC';

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
    initial: INITIAL_IOS,
    ...FREDOKA,
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    initial: 'serif',
    ...FREDOKA,
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    label: "'Fredoka', 'SF Pro Rounded', sans-serif",
    labelBold: "'Fredoka', 'SF Pro Rounded', sans-serif",
    initial: "'Noto Serif SC', 'Songti SC', serif",
  },
});

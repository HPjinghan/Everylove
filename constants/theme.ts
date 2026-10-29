import { Platform } from 'react-native';

/**
 * 主题（D-258）：设置 → 主题换的是**系统向 App 的强调色一族**（Messages / 通讯录 / 记事本 / 日历 / 设置 / 外出……的按钮、
 * 选中、她的气泡、聊天纸、底色里那一点点色）和主题自带的那块壁纸纸；字色、卡片、分隔线、危险红是中性的，不跟主题。
 * 第三方类 App（X / 交友 / 外卖 / 幸运签）不跟主题：它们用 `<AppScreen fixedPalette>` 圈起来，里面的
 * primitive 经 usePalette() 取 BASE_PALETTE，文件里直接引 BASE_PALETTE。
 * 壁纸是另一件事（D-258）：默认铺主题自带的纸，也可以换成照片（store.wallpaper，components/wallpaper.tsx）。
 * 机制：Romance 是可变对象（applyTheme 整体覆写）；模块级 StyleSheet.create 都包在 themed(() => ...) 里——
 * 按主题版本缓存的 Proxy，切主题后根布局以 key 重挂载全树，样式在访问时按新配色重建。非色彩规格在 constants/design.ts。
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
  /** 结构性分隔线 */
  stroke: string;
  /** 深一档的强调色：强调字、聊天纸的涂鸦、暗纹 */
  accentStrong: string;
  gold: string;
  night: string;
  bubbleHim: string;
  bubbleMe: string;
  danger: string;
}

/** 跟主题走的那几个键；其余是中性的 */
type ThemeKeys = 'bg' | 'accent' | 'accentSoft' | 'accentStrong' | 'bubbleMe';

/**
 * 中性底（D-231 一部有自己特色的小手机）：浅灰底、白卡片、近黑的字、细分隔线；强调色是我们自己的品牌粉。
 * 也是第三方类 App 用的那一套（不跟主题）。
 */
export const BASE_PALETTE: RomancePalette = {
  bg: '#F6F3F5', card: '#FFFFFF', ink: '#211B1F', sub: '#8C8389', faint: '#C8C1C6',
  accent: '#E8578A', accentSoft: '#FDECF2', line: '#EEE8EB', stroke: '#DED6DA',
  accentStrong: '#C2185B', gold: '#E0B98A', night: '#1E1A1D',
  bubbleHim: '#FFFFFF', bubbleMe: '#E8578A', danger: '#E5484D',
};

export type ThemeId = 'paper' | 'dawn' | 'eight' | 'sea' | 'matcha' | 'milk';

export interface Theme {
  label: string;
  /** 跟主题走的那几个色 */
  colors: Pick<RomancePalette, ThemeKeys>;
  /** 主题自带的壁纸纸：底色 + 菱格暗纹的线色（暗纹与强调色同一族，不再全是粉线） */
  paper: { bg: string; pattern: string };
}

/** 六个主题（D-258）：纸面 = 设计系统原色（默认）；其余各一族颜色，白字压在强调色上要读得清 */
export const THEMES: Record<ThemeId, Theme> = {
  paper: {
    label: '纸面',
    colors: { bg: BASE_PALETTE.bg, accent: '#E8578A', accentSoft: '#FDECF2', accentStrong: '#C2185B', bubbleMe: '#E8578A' },
    paper: { bg: '#FFD6E7', pattern: '#C2185B' },
  },
  dawn: {
    label: '拂晓',
    colors: { bg: '#F7F3F1', accent: '#E8693F', accentSoft: '#FFF0E8', accentStrong: '#B8481F', bubbleMe: '#E8693F' },
    paper: { bg: '#FFDCC8', pattern: '#C2562B' },
  },
  eight: {
    label: '晚八点',
    colors: { bg: '#F5F3F8', accent: '#7E5FD0', accentSoft: '#F1ECFA', accentStrong: '#5C3FAE', bubbleMe: '#7E5FD0' },
    paper: { bg: '#D9CEF0', pattern: '#5C3FAE' },
  },
  sea: {
    label: '归墟',
    colors: { bg: '#F2F5F7', accent: '#2F86BE', accentSoft: '#E6F2F9', accentStrong: '#1F6593', bubbleMe: '#2F86BE' },
    paper: { bg: '#C9E3F2', pattern: '#1F6593' },
  },
  matcha: {
    label: '抹茶',
    colors: { bg: '#F3F6F1', accent: '#4F9142', accentSoft: '#EAF4E5', accentStrong: '#356E2A', bubbleMe: '#4F9142' },
    paper: { bg: '#D5E8C9', pattern: '#356E2A' },
  },
  milk: {
    label: '奶白',
    colors: { bg: '#F7F5F1', accent: '#A87B4F', accentSoft: '#F7EFE4', accentStrong: '#7E5833', bubbleMe: '#A87B4F' },
    paper: { bg: '#F0E3D0', pattern: '#7E5833' },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'paper';

export function isThemeId(id: unknown): id is ThemeId {
  return typeof id === 'string' && id in THEMES;
}

/** 某个主题下的整套配色 */
export function paletteOf(id: ThemeId): RomancePalette {
  return { ...BASE_PALETTE, ...THEMES[id].colors };
}

/** token 色的半透明版（D-100）：遮罩 / 暗场用它，不手写 rgba；只接受 #RRGGBB */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 全局可变配色对象：applyTheme 覆写；界面里 Romance.x 的内联引用在重挂载后取到新值 */
export const Romance: RomancePalette = paletteOf(DEFAULT_THEME);

let themeVersion = 0;
let currentTheme: ThemeId = DEFAULT_THEME;

/** 应用主题：覆写 Romance、版本 +1（themed 样式按新配色重建）；同一个主题不重复 */
export function applyTheme(id: ThemeId): void {
  if (id === currentTheme) return;
  currentTheme = id;
  Object.assign(Romance, paletteOf(id));
  themeVersion++;
}

/**
 * 包住模块级 StyleSheet.create：返回按主题版本缓存重建的样式代理。
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

/** 设计系统字体（D-084）：label = Fredoka 500（数字、标签、时间戳）、labelBold = Fredoka 600（时钟、大数字）；正文用系统字体——Fredoka 是这部小手机自己的字。字体在 app/_layout.tsx 用 useFonts 加载 */
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

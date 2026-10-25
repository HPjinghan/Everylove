import { Platform } from 'react-native';

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
 * 界面配色（D-231：一部有自己特色的小手机）：App 里面像真手机里的 App——浅灰底、白卡片、近黑的字、细分隔线，
 * 强调色是我们自己的粉（不照搬任何一款手机的系统色）。甜的地方是桌面壁纸（WallpaperTint，见下），壁纸不再给 App 里面换色。
 * 键名沿用纸面时期的（bg / card / ink / sub / accent…），界面里的引用不用改。
 * 第三方类 App（X / 交友 / 外卖 / 幸运签）各自的品牌色在 constants/apps.ts 的 APP_TINT。
 */
export const THEMES: Record<'paper', { label: string; colors: RomancePalette }> = {
  paper: {
    label: '纸面',
    colors: {
      // 底 / 卡片 / 正文 / 次要字 / 占位字：中性、带一点点暖粉
      bg: '#F6F3F5', card: '#FFFFFF', ink: '#211B1F', sub: '#8C8389', faint: '#C8C1C6',
      // 强调色 = 品牌粉；浅底；浅线 / 占位底；结构性分隔线
      accent: '#E8578A', accentSoft: '#FDECF2', line: '#EEE8EB', stroke: '#DED6DA',
      accentStrong: '#C2185B', gold: '#E0B98A', night: '#1E1A1D',
      // 聊天气泡：对方白底黑字（落在涂鸦聊天纸上）、自己粉底白字
      bubbleHim: '#FFFFFF', bubbleMe: '#E8578A', danger: '#E5484D',
    },
  },
};

/** 唯一主题 id（D-083 / D-110）：store.themeId 只作旧存档兼容，代码不再读 */
export const DEFAULT_THEME_ID = 'paper';

/** 壁纸（D-231）：只铺在桌面（与锁屏这类「手机本身」的地方）——底色 + 菱格暗纹的线色 */
export interface PaperTint {
  bg?: string;
  accentSoft?: string;
  line?: string;
}

/** 纸面壁纸的原色（D-083 设计系统：paper #FFD6E7、暗纹 accent #C2185B）——「纸面」现在是壁纸之一 */
export const PAPER_WALLPAPER = { bg: '#FFD6E7', pattern: '#C2185B' } as const;

/** 当前壁纸：桌面读它；applyPaperTint 覆写 */
export const WallpaperTint = { bg: PAPER_WALLPAPER.bg as string, pattern: PAPER_WALLPAPER.pattern as string };

/** token 色的半透明版（D-100）：遮罩 / 暗场用它，不手写 rgba；只接受 #RRGGBB */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 全局可变配色对象：applyThemeColors 覆写；界面里 Romance.x 的内联引用在重挂载后取到新值 */
export const Romance: RomancePalette = { ...THEMES[DEFAULT_THEME_ID].colors };

let themeVersion = 0;

/**
 * 应用壁纸（D-231）：只换桌面那块纸的颜色（纸面 = 原色）；App 里面是界面配色，不跟着壁纸变。
 * 版本号照旧 +1：桌面的 themed 样式按新壁纸重建。
 */
export function applyPaperTint(tint: PaperTint = {}): void {
  WallpaperTint.bg = tint.bg ?? PAPER_WALLPAPER.bg;
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

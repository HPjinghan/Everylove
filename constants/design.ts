/**
 * 设计 token · 非色彩（D-231：一部有自己特色的小手机）——颜色在 constants/theme.ts；这里是形状 / 字号 / 间距 / 图案。
 *
 * 一句话：尽可能像一部手机，但不像任何一个具体型号——手机里的 App 该有的版式（列表、分组卡片、细分隔线、彩色 App 图块、
 * 小组件、通知横幅），细节是我们自己的：品牌粉、Fredoka 写数字、圆润的圆角。不用毛玻璃。
 * 甜的地方是桌面壁纸：纸面（粉底 + 菱格暗纹，原 D-083 设计系统）是壁纸之一，其余是同一套暗纹的浅底。
 * 界面只引这里与 Romance token，不手写圆角 / 字号 / hex；阴影只用 Elevation 两档。
 * 背景图案的实现在 components/paper-bg.tsx（DiamondBackground 只给壁纸用）。
 */

import { StyleSheet } from 'react-native';

/** 形状 · 描边 · 阴影 */
export const Shape = {
  /** 默认圆角：卡片、分组列表、输入框 */
  radius: 10,
  /** 嵌套内层（分段选中块、小缩略图） */
  radiusInner: 7,
  /** 聊天气泡与尾角 */
  radiusBubble: 18,
  radiusTail: 5,
  /** 按钮 */
  radiusButton: 12,
  /** 胶囊（chip、角标、小标签） */
  radiusPill: 999,
  /** 桌面 App 图块：圆润的方块（边长 60 → 16） */
  radiusIcon: 16,
  /** 桌面小组件、通知横幅 */
  radiusWidget: 22,
  /** Dock 托盘 */
  radiusDock: 30,
  /** 手机外壳 */
  radiusShell: 44,
  /** 结构性分隔线：一根细线（颜色 = Romance.stroke）——顶栏下沿、输入栏上沿、列表行间 */
  stroke: StyleSheet.hairlineWidth,
  /** 看得见的细边：outline 按钮、选中描边 */
  border: 1,
  /** 卡片不描边、不投影：层级靠 白卡 / 浅灰底；浮起的东西用 Elevation */
  shadow: 'none',
} as const;

/** 字体：Fredoka（数字、时钟、标题、导航、标签、按钮文字、时间戳）/ 系统字体（正文与中文）/ Noto Serif SC（仅头像单字） */
export const Type = {
  /** Fredoka 需装 @expo-google-fonts/fredoka（500 / 600）后填入；未装时回落系统圆体 */
  label: 'Fredoka',
  body: 'system-ui',
  /** 角色头像单字 */
  initial: 'Noto Serif SC',
  scale: {
    // 设计稿 line-height 0.9；RN iOS 按行高裁字形，小于 1 会把 Fredoka 的顶切掉，故落地取 1（D-104）
    clock: { size: 84, lineHeight: 1, letterSpacing: -2, weight: '600' },
    display: { size: 30, lineHeight: 1, weight: '600' },
    // 手机 App 的常用字号：标题 17 / 正文 17 / 次要 15 / 注脚 13 / 说明 12 / 时间 11
    screenTitle: { size: 17, weight: '600' },
    cardTitle: { size: 17, weight: '600' },
    nav: { size: 17, weight: '400' },
    body: { size: 17, lineHeight: 22, weight: '400' },
    label: { size: 13, weight: '500' },
    eyebrow: { size: 13, letterSpacing: 0, weight: '400', color: 'muted' },
    caption: { size: 12, weight: '400', color: 'muted' },
    timestamp: { size: 11, weight: '500', color: 'muted' },
    // 下面是字号阶梯（D-199）：界面里的 fontSize 只从这里取，不手写数字；≥ 28 的展示型数字（时钟 / 计时 / 金额）各屏自定
    // xs 只给角标 / 键盘字母这种贴在图形上的小标签；说明、提示、手写字至少 caption 12（D-229）
    xs: { size: 10, weight: '400' },
    sub: { size: 15, weight: '400' },
    md: { size: 16, weight: '400' },
    lg: { size: 18, weight: '500' },
    xl: { size: 20, weight: '600' },
    xxl: { size: 22, weight: '600' },
    h2: { size: 24, weight: '600' },
    h1: { size: 26, weight: '600' },
  },
} as const;

/**
 * 系统字号放大的上限（D-229）：开了「更大字体」时，正文跟着放大不设限；
 * 尺寸固定的控件（按钮 / 分段 / chip / 顶栏 / 桌面图块标签 / 角标）最多放大到 CONTROL，
 * 展示型大数字（桌面时钟、天气温度）最多到 DISPLAY——再大就撑破版式。
 */
export const CONTROL_FONT_SCALE = 1.3;
export const DISPLAY_FONT_SCALE = 1.1;

/** 间距 */
export const Space = {
  /** 屏幕左右留白；块之间的垂直间距 */
  screen: 16,
  /** 行内元素间距（头像 · 文字 · 时间戳） */
  inline: 8,
  inlineLoose: 10,
  /** 卡片 / 列表行内距 11 × 16（列表行约 44pt 高） */
  cardY: 11,
  cardX: 16,
  /** 大按钮 / Dock 图块之间 */
  tileGap: 22,
  tileGapLoose: 26,
  /** 桌面图标网格：4 列，行高 104，图块 60 + 标签 */
  desktopCols: 4,
  desktopRow: 104,
  appTile: 60,
  /** Match 卡片：宽 342、3:4；后层卡 scale .94 下移 14 */
  matchCardWidth: 342,
  matchCardRatio: 3 / 4,
  matchBehindScale: 0.94,
  matchBehindOffset: 14,
  /** 气泡：内距 8 × 13、最大宽 75% */
  bubbleY: 8,
  bubbleX: 13,
  bubbleMaxWidth: '75%',
  /** 输入框高 36；状态栏 54；顶栏左右槽位 84 */
  inputHeight: 36,
  statusBar: 54,
  topBarSlot: 84,
  /** 图标：图块内 30，栏内 22–24 */
  iconTile: 30,
  iconBar: 24,
  /** 桌面页码点（D-100）：Dock 上方 14、直径 6 */
  pageDot: 6,
  pageDotGap: 14,
  /** Dock（D-100）：高 102、距底 26 */
  dockHeight: 102,
  dockBottom: 26,
  avatar: { card: 54, row: 36, bubble: 32 },
} as const;

/**
 * 浮起（D-231）：只给浮在内容上的东西一点影子——low = 分段选中块 / 拍立得 / 桌面图块与小组件，high = 底部动作卡与通知横幅。
 * 普通卡片、按钮、列表都不用。
 */
export const Elevation = {
  low: { shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  high: { shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
} as const;

/** 表面与图案（只做背景暗纹，透明度 ≤ 16%；不在内容区放图案） */
export const Pattern = {
  /** 桌面、Match 等浅内容页底：paper + 菱格 14px、线 1px、accent 7% */
  diamond: { cell: 14, line: 1, alpha: 0.07 },
  /** 仅聊天流：120px 平铺 SVG（心、环、钻石、十字），accent 线 1.4px、16%，底 chat paper（= accentSoft） */
  chatWallpaper: { tile: 120, line: 1.4, alpha: 0.16 },
} as const;

/** TA 的手机里的记事本卡（D-100）：唯一的米色纸面，只用在这一处 */
export const NOTE_PAPER = { bg: '#FFFBEA', ink: '#5B4A2E' } as const;

/** 拍立得倾角（D-100）：±0.6–1.8°，按 key 稳定取一个 */
export const POLAROID_TILTS = [-1.8, -1.5, -1.2, -1, -0.6, 0.6, 0.8, 1.2, 1.4, 1.8] as const;

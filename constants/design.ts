/**
 * Everylove 设计系统 · 非色彩 token（D-083）——来源：Claude Design「Everylove - Design System」（基于方向 3a · Pink · calm geometric），
 * 原文见 design/design-system.page.html。颜色在 constants/theme.ts 的 THEMES.paper；这里是形状 / 字号 / 间距 / 图案 / 原则。
 *
 * 一句话：粉色纸面、菱形暗纹、墨色细描边、无阴影、4–6px 小圆角。结构性元素（顶栏、聊天流）通底不加框，
 * 只有内容卡片和主按钮保留 1.5px 描边。Fredoka 负责数字与标签，系统字体负责正文，保证中文可读。
 *
 * D-100：全部 27 屏已按 design/Everylove Paper UI.html 重做——界面只引这里与 Romance token，不手写圆角 / 阴影 / 字号 / hex。
 * 背景图案的实现在 components/paper-bg.tsx（DiamondBackground / ChatWallpaper）。
 */

/** 形状 · 描边 · 阴影 */
export const Shape = {
  /** 默认圆角：卡片、图块、按钮、气泡、角标 */
  radius: 6,
  /** 嵌套内层（分段选中块） */
  radiusInner: 4,
  /** 气泡尾角 */
  radiusTail: 2,
  /** 手机外壳 */
  radiusShell: 44,
  /** 唯一描边：内容卡片、主按钮、顶栏下沿、输入栏上沿（颜色 = Romance.stroke = ink）。图标图块、次按钮、分段控件、气泡、角标一律无描边 */
  stroke: 1.5,
  /** 无任何投影：层级靠 白色表面 / 粉色底色 / 墨色描边 三者对比 */
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
    clock: { size: 84, lineHeight: 0.9, letterSpacing: -2, weight: '600' },
    display: { size: 30, lineHeight: 1, weight: '600' },
    screenTitle: { size: 17, weight: '600' },
    cardTitle: { size: 15, weight: '600' },
    nav: { size: 15, weight: '500' },
    body: { size: 15, lineHeight: 22, weight: '400' },
    label: { size: 13, weight: '500' },
    eyebrow: { size: 12, letterSpacing: 0.5, weight: '500', color: 'muted' },
    caption: { size: 12, weight: '400', color: 'muted' },
    timestamp: { size: 11, weight: '500', color: 'muted' },
  },
} as const;

/** 间距 */
export const Space = {
  /** 屏幕左右留白；块之间的垂直间距 */
  screen: 14,
  /** 行内元素间距（头像 · 文字 · 时间戳） */
  inline: 8,
  inlineLoose: 10,
  /** 卡片内距 10 × 12 */
  cardY: 10,
  cardX: 12,
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
  /** 气泡：内距 9 × 13、最大宽 72% */
  bubbleY: 9,
  bubbleX: 13,
  bubbleMaxWidth: '72%',
  /** 输入框高 38；状态栏 54；顶栏左右槽位 70 */
  inputHeight: 38,
  statusBar: 54,
  topBarSlot: 70,
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

/** 表面与图案（只做背景暗纹，透明度 ≤ 16%；不在内容区放图案） */
export const Pattern = {
  /** 桌面、Match 等浅内容页底：paper + 菱格 14px、线 1px、accent 7% */
  diamond: { cell: 14, line: 1, alpha: 0.07 },
  /** 仅聊天流：120px 平铺 SVG（心、环、钻石、十字），accent 线 1.4px、16%，底 chat paper（= accentSoft） */
  chatWallpaper: { tile: 120, line: 1.4, alpha: 0.16 },
} as const;

/** 组件规格摘要 */
export const Component = {
  buttonPrimary: { height: 66, stroke: true },
  buttonSecondary: { height: 54, stroke: false },
  bubbleHim: { radius: [6, 6, 6, 2], stroke: false },
  bubbleMe: { radius: [6, 6, 2, 6], stroke: false },
  /** 卡片内分区用同样的 1.5px 描边线分隔，不用阴影或灰底；图块内的插图区用 paper 色圆 / 块做底 */
  card: { stroke: true, radius: 6 },
} as const;

/** 原则 DO / DON'T（改界面前先过一遍） */
export const PRINCIPLES = {
  do: [
    '层级靠三层表面：paper 底 → 白色图块 → 描边卡片',
    '彩色只用 primary 与 accent；其余全是 ink / muted / white',
    '图案只做背景暗纹，透明度 ≤ 16%',
    '数字和标签统一 Fredoka，中文正文统一系统字体',
    '圆角统一 6，嵌套内层降到 4',
  ],
  dont: [
    '不加任何投影或硬偏移阴影',
    '不给顶栏、分段控件、图标图块、气泡加描边',
    '不用棋盘格 / 点阵作装饰，不在内容区放图案',
    '不用渐变（仅允许卡片内 paper 色的纯色圆形底）',
    '不引入第三种彩色；角色头像色只出现在头像上',
  ],
} as const;

/** 角色头像色：每个角色固定的低饱和深色，配 Noto Serif SC 姓氏单字（设计稿给了三位种子角色） */
export const AVATAR_COLORS: Record<string, string> = {
  沈: '#3E5C6B',
  胡: '#A8354D',
  苏: '#7A4257',
  // 纸面全屏设计稿新增（D-100）
  江: '#2F6B5E',
  烛: '#8A4B2B',
  洛: '#6B5B8E',
};

/** TA 的手机里的记事本卡（D-100）：唯一的米色纸面，只用在这一处 */
export const NOTE_PAPER = { bg: '#FFFBEA', ink: '#5B4A2E' } as const;

/** 拍立得倾角（D-100）：±0.6–1.8°，按 key 稳定取一个 */
export const POLAROID_TILTS = [-1.8, -1.5, -1.2, -1, -0.6, 0.6, 0.8, 1.2, 1.4, 1.8] as const;

import type { MingCuteName } from '@/components/mingcute';

/**
 * 手机壳桌面的 App 注册表（D-020/D-021/D-026：MingCute 图标；D-100 纸面起图块白底 + ink 图标，糖果双色下线）。
 * 纪律：模块必须有内容供给才上架，无供给不摆图标——
 * 闹钟（morning call）需要 TTS 供给（OPEN_QUESTIONS #6），试装不上架；音乐 v1.5。
 * 捏＋暂以桌面图标承载（最终入口形态待拍板，OPEN_QUESTIONS #16）。
 */

export interface DesktopApp {
  id: string;
  label: string;
  /** MingCute 图标名（components/mingcute.tsx，D-026） */
  icon: MingCuteName;
  /** 图块底色（D-231：像手机里一个个真 App，各有各的颜色）；图标默认白色 */
  tile: string;
  /** 图标颜色（浅色图块上用深色图标） */
  glyphColor?: string;
  /** 字标（D-229）：有它就在图块上写这几个字母，不画图标 */
  glyph?: string;
  route: string;
  /** 角标：unread = Message 的未读；x = 上次打开 X 之后的新帖与她帖子底下新来的评论（D-252） */
  badge?: 'unread' | 'x';
}

// 日历图块（D-231）：白底，上面一行红色星期、下面大大的今天几号——跟真手机的日历图标一样每天变
export const DESKTOP_APPS: DesktopApp[] = [
  { id: 'messages', label: 'Messages', icon: 'chat', tile: '#4CD07D', route: '/apps/messages', badge: 'unread' },
  { id: 'phone', label: '电话', icon: 'phone', tile: '#4CD07D', route: '/apps/phone' },
  // X（D-053）：黑底白字的字标 X（D-229：✕ 读起来是「关闭」）
  { id: 'moments', label: 'X', icon: 'close', tile: '#16181C', glyph: 'X', route: '/apps/moments', badge: 'x' },
  { id: 'dating', label: '交友', icon: 'heart', tile: '#FF5A79', route: '/apps/dating' },
  { id: 'contacts', label: '通讯录', icon: 'contacts', tile: '#A3A8AE', route: '/apps/contacts' },
  { id: 'album', label: '相册', icon: 'album', tile: '#FFFFFF', glyphColor: '#FF7A59', route: '/apps/album' },
  { id: 'calendar', label: '日历', icon: 'calendar', tile: '#FFFFFF', glyphColor: '#E5484D', route: '/apps/calendar' },
  { id: 'outing', label: '外出', icon: 'location', tile: '#3BB6F5', route: '/apps/outing' },
  { id: 'create', label: '创造', icon: 'magicHat', tile: '#9B6BF2', route: '/apps/create' },
  // 记事本（D-085）：她自己的本子，私密——只有她让 TA 看手机时 TA 才看得到
  { id: 'notes', label: '记事本', icon: 'notebook', tile: '#FFC93C', route: '/apps/notes' },
  // 查手机（D-085）：所有缔结的 TA 各一部手机；也能让 TA 看我的手机
  { id: 'phones', label: '查手机', icon: 'phoneEye', tile: '#2E2A33', route: '/apps/phones' },
  // 钱包（D-138）：她的零钱余额与 Coin 流水（红包 / 外卖 / 日签 / 转盘）
  { id: 'wallet', label: '钱包', icon: 'wallet', tile: '#1F1F24', route: '/apps/wallet' },
  // 幸运签（D-128 / D-138）：日签每天一次水晶球抽签给零钱；转盘投零钱赌倍数
  { id: 'fortune', label: '幸运签', icon: 'sparkles', tile: '#6F5CE6', route: '/apps/fortune' },
  // 外卖（D-129）：像一个外卖平台——给自己或给 TA 点、骑手进度、订单记录
  { id: 'delivery', label: '外卖', icon: 'takeout', tile: '#FFC21A', glyphColor: '#211B1F', route: '/apps/delivery' },
  // 传记（D-149）：已缔结 TA 的故事，创作者按章写、每章设开放的羁绊等级；只看，编辑在创造里
  { id: 'biography', label: '传记', icon: 'book', tile: '#FF9F2E', route: '/apps/biography' },
  { id: 'settings', label: '设置', icon: 'settings', tile: '#8E8E93', route: '/apps/settings' },
];

/**
 * 第三方类 App 的品牌色（D-231）：App 里面的强调色跟它桌面图块一个颜色——交友珊瑚粉、X 黑、外卖黄、幸运签紫。
 * 系统类 App（Messages / 设置 / 日历 / 记事本…）跟主题（D-258）。
 */
export function appTint(id: string): string | undefined {
  return DESKTOP_APPS.find((a) => a.id === id)?.tile;
}

/** 桌面小组件的底色（D-231）：天气晴空蓝；外出（D-262）白天浅天蓝、夜里深蓝，像素画的夜色版放在深底上 */
export const WIDGET_TINT = { weather: '#5AAEEB', outing: '#DDF1FD', outingNight: '#22304D' } as const;

/** 桌面小组件（D-263）：设置 → 小组件里一个个开关；天气是时钟下的长条，外出在网格里占 2×2（D-262） */
export type DesktopWidgetId = 'weather' | 'outing';
export const DESKTOP_WIDGETS: { id: DesktopWidgetId; label: string }[] = [
  { id: 'weather', label: '天气' },
  { id: 'outing', label: '外出' },
];

export const DEFAULT_DESKTOP_ORDER = DESKTOP_APPS.map((a) => a.id);

/** 底部 Dock 默认（D-229）：最常用的四个——Messages 带未读角标、像 iPhone 的 Dock 一样放在拇指底下；编辑模式可拖入拖出，上限 4 个 */
export const DEFAULT_DOCK = ['messages', 'outing', 'dating', 'settings'];

export function appById(id: string): DesktopApp | undefined {
  return DESKTOP_APPS.find((a) => a.id === id);
}

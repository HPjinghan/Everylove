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
  /** MingCute 图标名（components/mingcute.tsx，D-026）；D-100 纸面：图块一律白底 r6、图标 ink，不再配色 */
  icon: MingCuteName;
  route: string;
  /** 显示未读角标（目前只有 Message） */
  badge?: 'unread';
}

export const DESKTOP_APPS: DesktopApp[] = [
  { id: 'messages', label: 'Message', icon: 'chat', route: '/apps/messages', badge: 'unread' },
  { id: 'phone', label: '电话', icon: 'phone', route: '/apps/phone' },
  // X（D-053）：拟真彩蛋 ✕（D-100 起与其它图块同为白底 ink）
  { id: 'moments', label: 'X', icon: 'close', route: '/apps/moments' },
  { id: 'dating', label: '交友', icon: 'heart', route: '/apps/dating' },
  { id: 'contacts', label: '通讯录', icon: 'contacts', route: '/apps/contacts' },
  { id: 'album', label: '相册', icon: 'album', route: '/apps/album' },
  { id: 'calendar', label: '日历', icon: 'calendar', route: '/apps/calendar' },
  { id: 'outing', label: '外出', icon: 'location', route: '/apps/outing' },
  { id: 'create', label: '创造', icon: 'magicHat', route: '/apps/create' },
  // 记事本（D-085）：她自己的本子，私密——只有她让 TA 看手机时 TA 才看得到
  { id: 'notes', label: '记事本', icon: 'notebook', route: '/apps/notes' },
  // 查手机（D-085）：所有缔结的 TA 各一部手机；也能让 TA 看我的手机
  { id: 'phones', label: '查手机', icon: 'phoneEye', route: '/apps/phones' },
  { id: 'settings', label: '设置', icon: 'settings', route: '/apps/settings' },
];

export const DEFAULT_DESKTOP_ORDER = DESKTOP_APPS.map((a) => a.id);

/** 底部 Dock 默认（D-044/D-064 收窄为两个）：编辑模式可拖入拖出，上限仍是 4 个 */
export const DEFAULT_DOCK = ['contacts', 'settings'];

export function appById(id: string): DesktopApp | undefined {
  return DESKTOP_APPS.find((a) => a.id === id);
}

/**
 * 壁纸（设置 → 主题，D-104）：壁纸只换纸的颜色，不换纸——每款都是「一块纯色底 + 同一套菱格暗纹（DiamondBackground）」，
 * 不渐变、不分段。「纸面」（新装机默认）底色跟随当前配色的 Romance.bg（color 留空）；其余五款各一块浅底，
 * 保证 ink 字与白卡在上面照样清楚。设置页缩略图同样画法。
 */
export interface Wallpaper {
  id: string;
  label: string;
  /** 底色；留空 = 当前配色的 Romance.bg */
  color?: string;
}

export const DEFAULT_WALLPAPER = 'paper';

export const WALLPAPERS: Wallpaper[] = [
  { id: 'paper', label: '纸面' },
  { id: 'dawn', label: '拂晓', color: '#FFEDF3' },
  { id: 'eight', label: '晚八点', color: '#E4DDF0' },
  { id: 'sea', label: '归墟', color: '#DCEFF5' },
  { id: 'matcha', label: '抹茶', color: '#EEF5EA' },
  { id: 'milk', label: '奶白', color: '#FBF8F3' },
];

export function wallpaperById(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

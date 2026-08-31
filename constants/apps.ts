import type { MingCuteName } from '@/components/mingcute';

/**
 * 手机壳桌面的 App 注册表（D-020/D-021/D-026：MingCute 图标 + 糖果双色）。
 * 纪律：模块必须有内容供给才上架，无供给不摆图标——
 * 闹钟（morning call）需要 TTS 供给（OPEN_QUESTIONS #6），试装不上架；音乐 v1.5。
 * 捏＋暂以桌面图标承载（最终入口形态待拍板，OPEN_QUESTIONS #16）。
 */

export interface DesktopApp {
  id: string;
  label: string;
  /** MingCute 图标名（components/mingcute.tsx，D-026） */
  icon: MingCuteName;
  /** 图标瓷砖底色（浅糖色） */
  bg: string;
  /** 图标本体色（同色系深一档，tone-on-tone） */
  fg: string;
  route: string;
  /** 显示未读角标（目前只有 Message） */
  badge?: 'unread';
}

export const DESKTOP_APPS: DesktopApp[] = [
  { id: 'messages', label: 'Message', icon: 'chat', bg: '#D9F5E1', fg: '#4BBF87', route: '/apps/messages', badge: 'unread' },
  { id: 'phone', label: '电话', icon: 'phone', bg: '#D5F2E3', fg: '#3EB489', route: '/apps/phone' },
  // X（D-053）：拟真彩蛋——黑底白 ✕，与 LINE 绿同一「世界内真 App」逻辑
  { id: 'moments', label: 'X', icon: 'close', bg: '#0F1419', fg: '#FFFFFF', route: '/apps/moments' },
  { id: 'dating', label: '交友', icon: 'heart', bg: '#FFDBE6', fg: '#F5749B', route: '/apps/dating' },
  { id: 'contacts', label: '通讯录', icon: 'contacts', bg: '#FFEDD6', fg: '#F2A65A', route: '/apps/contacts' },
  { id: 'album', label: '相册', icon: 'album', bg: '#F0E4FB', fg: '#B287E0', route: '/apps/album' },
  { id: 'calendar', label: '日历', icon: 'calendar', bg: '#FFE0E0', fg: '#EF8080', route: '/apps/calendar' },
  { id: 'outing', label: '外出', icon: 'location', bg: '#FFF3D6', fg: '#E8B44A', route: '/apps/outing' },
  { id: 'create', label: '创造', icon: 'magicHat', bg: '#DFF5F2', fg: '#56C4B4', route: '/apps/create' },
  { id: 'settings', label: '设置', icon: 'settings', bg: '#E8ECF2', fg: '#93A3B8', route: '/apps/settings' },
];

export const DEFAULT_DESKTOP_ORDER = DESKTOP_APPS.map((a) => a.id);

/** 底部 Dock 默认（D-044/D-064 收窄为两个）：编辑模式可拖入拖出，上限仍是 4 个 */
export const DEFAULT_DOCK = ['contacts', 'settings'];

export function appById(id: string): DesktopApp | undefined {
  return DESKTOP_APPS.find((a) => a.id === id);
}

/** 壁纸（设置 → 主题；渐变双色） */
export interface Wallpaper {
  id: string;
  label: string;
  colors: [string, string];
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'dawn', label: '拂晓', colors: ['#FFEDF3', '#FFD3E0'] },
  { id: 'eight', label: '晚八点', colors: ['#2B2D42', '#6D6875'] },
  { id: 'sea', label: '归墟', colors: ['#DCEFF5', '#B8D8E8'] },
  { id: 'matcha', label: '抹茶', colors: ['#EEF5EA', '#CDE3C8'] },
  { id: 'milk', label: '奶白', colors: ['#FBF8F3', '#EFE8DE'] },
];

export function wallpaperById(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

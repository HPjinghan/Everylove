/**
 * 手机壳桌面的 App 注册表（D-020/D-021）。
 * 纪律：模块必须有内容供给才上架，无供给不摆图标——
 * 闹钟（morning call）需要 TTS 供给（OPEN_QUESTIONS #6），试装不上架；音乐 v1.5。
 * 捏＋暂以桌面图标承载（最终入口形态待拍板，OPEN_QUESTIONS #16）。
 */

export interface DesktopApp {
  id: string;
  label: string;
  /** 图标字形（试装用 emoji，正式版换图标资源） */
  glyph: string;
  /** 图标底色 */
  tint: string;
  route: string;
  /** 显示未读角标（目前只有 Message） */
  badge?: 'unread';
}

export const DESKTOP_APPS: DesktopApp[] = [
  { id: 'messages', label: 'Message', glyph: '💌', tint: '#A8E6C3', route: '/apps/messages', badge: 'unread' },
  { id: 'moments', label: '朋友圈', glyph: '🌸', tint: '#B5C9F7', route: '/apps/moments' },
  { id: 'dating', label: '缘分', glyph: '💘', tint: '#FFB3C6', route: '/apps/dating' },
  { id: 'contacts', label: '通讯录', glyph: '🧸', tint: '#FFD8A8', route: '/apps/contacts' },
  { id: 'album', label: '相册', glyph: '📷', tint: '#DCC5F0', route: '/apps/album' },
  { id: 'calendar', label: '日历', glyph: '📅', tint: '#FFA8B8', route: '/apps/calendar' },
  { id: 'create', label: '捏＋', glyph: '🍡', tint: '#AEE5DE', route: '/apps/create' },
  { id: 'settings', label: '设置', glyph: '⚙️', tint: '#D3DCE8', route: '/apps/settings' },
];

export const DEFAULT_DESKTOP_ORDER = DESKTOP_APPS.map((a) => a.id);

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

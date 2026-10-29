/**
 * 主题与壁纸（D-258）：每个主题的强调色压白字读得清、中性色不跟主题；老存档的壁纸色块 id 迁成主题、壁纸回到主题自带的纸。
 */
import { describe, expect, it, vi } from 'vitest';

import { useAppStore } from '@/store/app-store';

type ThemeModule = typeof import('@/constants/theme');
const actual = () => vi.importActual<ThemeModule>('@/constants/theme');

/** WCAG 相对亮度 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('主题', () => {
  it('六个主题：白字压在强调色 / 她的气泡上至少 3:1，深一档的强调色当字色压在白底上至少 4.5:1', async () => {
    const { THEMES, THEME_IDS } = await actual();
    expect(THEME_IDS).toHaveLength(6);
    for (const id of THEME_IDS) {
      const c = THEMES[id].colors;
      expect(contrast(c.accent, '#FFFFFF'), id).toBeGreaterThanOrEqual(3);
      expect(contrast(c.bubbleMe, '#FFFFFF'), id).toBeGreaterThanOrEqual(3);
      expect(contrast(c.accentStrong, '#FFFFFF'), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('中性色（字、卡片、分隔线、危险红）不跟主题', async () => {
    const { BASE_PALETTE, paletteOf, THEME_IDS } = await actual();
    for (const id of THEME_IDS) {
      const p = paletteOf(id);
      for (const k of ['ink', 'sub', 'faint', 'card', 'line', 'stroke', 'danger'] as const) expect(p[k]).toBe(BASE_PALETTE[k]);
    }
  });
});

describe('老存档迁移（v13）', () => {
  const migrate = (state: Record<string, unknown>) =>
    useAppStore.persist.getOptions().migrate!(state, 12) as Record<string, unknown>;

  it('旧的壁纸色块 id 就是新的主题；壁纸回到主题自带的纸', () => {
    expect(migrate({ wallpaper: 'sea' })).toMatchObject({ theme: 'sea', wallpaper: null });
    expect(migrate({ wallpaper: 'gone' })).toMatchObject({ theme: 'paper', wallpaper: null });
    expect(migrate({})).toMatchObject({ theme: 'paper', wallpaper: null });
  });
});

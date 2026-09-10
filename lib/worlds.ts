/**
 * 世界书的取用（D-110）：角色 → 所在的世界；创造表单的可选世界 = 现实世界 + 收藏的。
 * 找不到的 worldId（别人共享来的角色、已删除的世界）一律回落现实世界。
 */

import { REAL_WORLD, REAL_WORLD_ID } from '@/content/worlds';
import type { Character, WorldBook } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export function worldById(id?: string): WorldBook {
  if (!id || id === REAL_WORLD_ID) return REAL_WORLD;
  return useAppStore.getState().worldBooks.find((w) => w.id === id) ?? REAL_WORLD;
}

/** 角色所在的世界；现实世界返回 REAL_WORLD */
export function worldOf(c: Pick<Character, 'worldId'>): WorldBook {
  return worldById(c.worldId);
}

export function isRealWorld(w: WorldBook): boolean {
  return w.id === REAL_WORLD_ID;
}

/** 创造角色时可选的世界：现实世界永远在第一个，之后是收藏的（按收藏顺序）——纯函数，界面把 store 切片传进来 */
export function selectableFrom(worldBooks: WorldBook[], worldFavorites: string[]): WorldBook[] {
  const favs = worldFavorites.map((id) => worldBooks.find((w) => w.id === id)).filter((w): w is WorldBook => !!w);
  return [REAL_WORLD, ...favs];
}

export function selectableWorlds(): WorldBook[] {
  const { worldBooks, worldFavorites } = useAppStore.getState();
  return selectableFrom(worldBooks, worldFavorites);
}

/** 世界设定拆成行（去空行） */
export function worldRuleLines(w: WorldBook): string[] {
  return (w.rules ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 世界书的取用（D-110 / D-111）：角色 → 所在的世界；创造表单的可选世界 = 现实世界 + 收藏的（自己的与来自其他玩家的）。
 * 世界也走共享池（lib/pool.ts）：公开的世界所有玩家都能在世界书里浏览、收藏、选给角色；
 * 绑定了别人看不见的世界（自己的私密世界）的角色不能公开（canPublishCharacter）。
 * 找不到的 worldId 依次回落：本机世界书 → 共享池缓存 → 角色自带的世界快照（发布时嵌入）→ 现实世界。
 */

import { REAL_WORLD, REAL_WORLD_ID } from '@/content/worlds';
import type { Character, WorldBook } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export function worldById(id?: string): WorldBook | undefined {
  if (!id || id === REAL_WORLD_ID) return REAL_WORLD;
  const s = useAppStore.getState();
  return s.worldBooks.find((w) => w.id === id) ?? s.sharedWorlds.find((w) => w.id === id);
}

/** 角色所在的世界；现实世界返回 REAL_WORLD */
export function worldOf(c: Pick<Character, 'worldId' | 'world'>): WorldBook {
  return worldById(c.worldId) ?? c.world ?? REAL_WORLD;
}

export function isRealWorld(w: WorldBook): boolean {
  return w.id === REAL_WORLD_ID;
}

/** 别人看得见这个世界吗：现实世界 / 公开的 / 来自其他玩家的都算 */
export function worldVisibleToOthers(w: WorldBook): boolean {
  return isRealWorld(w) || !!w.shared || w.visibility === 'public';
}

/** 绑定了别人看不见的世界的角色不能公开（D-111） */
export function canPublishCharacter(c: Pick<Character, 'worldId' | 'world'>): boolean {
  return worldVisibleToOthers(worldOf(c));
}

/** 绑定了这个世界、且已公开的自创角色 */
export function publicCharactersIn(worldId: string): Character[] {
  return useAppStore.getState().customCharacters.filter((c) => !c.shared && c.worldId === worldId && c.visibility === 'public');
}

/** 创造角色时可选的世界：现实世界永远在第一个，之后是收藏的（自己的 + 来自其他玩家的，按收藏顺序）——纯函数 */
export function selectableFrom(worldBooks: WorldBook[], sharedWorlds: WorldBook[], worldFavorites: string[]): WorldBook[] {
  const favs = worldFavorites
    .map((id) => worldBooks.find((w) => w.id === id) ?? sharedWorlds.find((w) => w.id === id))
    .filter((w): w is WorldBook => !!w);
  return [REAL_WORLD, ...favs];
}

export function selectableWorlds(): WorldBook[] {
  const { worldBooks, sharedWorlds, worldFavorites } = useAppStore.getState();
  return selectableFrom(worldBooks, sharedWorlds, worldFavorites);
}

/** 发布角色时嵌进去的世界快照（领养快照制：世界之后改了也不动已领养的实例） */
export function worldSnapshotFor(c: Pick<Character, 'worldId' | 'world'>): WorldBook | undefined {
  const w = worldOf(c);
  if (isRealWorld(w)) return undefined;
  return { id: w.id, name: w.name, summary: w.summary, rules: w.rules, createdAt: w.createdAt, updatedAt: w.updatedAt, visibility: 'public', lang: w.lang };
}

/** 世界设定拆成行（去空行） */
export function worldRuleLines(w: WorldBook): string[] {
  return (w.rules ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

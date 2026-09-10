/**
 * 世界书（D-110）：TA 所处的世界与 TA 对一切的认知。
 * 内置只有一本——现实世界（当前）：不进 prompt（模型默认就活在当下的现实里），也不占存储；
 * 其余世界由她在「世界书」App 里创建、收藏后才能选给角色（store.worldBooks / worldFavorites）。
 */

import type { WorldBook } from '@/lib/types';

export const REAL_WORLD_ID = 'real';

/** 现实世界（当前）：默认世界，永远可选 */
export const REAL_WORLD: WorldBook = {
  id: REAL_WORLD_ID,
  name: '现实世界（当前）',
  summary: '此时此刻的现实世界：真实的城市、天气、手机与社交软件，没有超自然设定。',
  createdAt: 0,
  updatedAt: 0,
};

/** 新建世界书时的示例设定（占位提示，不入库） */
export const WORLD_RULES_PLACEHOLDER =
  '一行一条，比如：\n时代：蒸汽朋克的 1890 年代\n地理：漂浮在云海上的城邦\n规则：魔法靠契约，人人都有一只灵兽\n常识：没有手机，靠传信鸟联络';

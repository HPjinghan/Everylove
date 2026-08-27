/**
 * 交友牌堆的推荐算法（D-041）：简单、可解释、给 UGC 供给留好接口——
 * 之后其他用户上传的角色进同一个池子，走同一套打分，不用改界面。
 *
 * 打分 = 口味匹配 + 热度（log 压缩）+ 新面孔 + 你的创作 + 每日轮换抖动 − 略过冷却。
 * 全部确定性（同一天同一个人顺序稳定）；正式版换服务端推荐时保持 rankDeck 接口不变。
 */

import type { Character, LovePref } from '@/lib/types';

export interface RankContext {
  /** onboarding 的口味（架构全性向，火力女频先行） */
  lovePref?: LovePref;
  /** 左滑略过记录：characterId → 最近一次略过的时间戳（略过不是拉黑，冷却后回流） */
  passes: Record<string, number>;
  /** 配过对/聊过的（已经认识，不算新面孔） */
  knownIds?: Set<string>;
  now?: number;
}

/** 略过冷却：3 天内重罚（基本沉底），之后轻罚回流（池子是有限的，Tinder 式再来一遍） */
export const PASS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * 供给是否充足（D-042）：池子里还有没被冷却压着的新牌。
 * 冷却是「供给充足时」才有的规则——全池都在冷却时，调用方应把 passes 传空（忽略冷却直接回流），
 * 免得用户对着空牌堆等 3 天。UGC 供给上来之后这个分支自然就很少触发了。
 */
export function hasFreshSupply(
  pool: Character[],
  passes: Record<string, number>,
  now: number = Date.now()
): boolean {
  return pool.some((c) => {
    const at = passes[c.id];
    return !at || now - at >= PASS_COOLDOWN_MS;
  });
}

/** 字符串 → 稳定正整数（FNV-1a 简化版；与 lib/weather.ts 同源，各自独立避免耦合） */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 单卡得分（导出便于调参与测试；分数只在同一次 rankDeck 内比较，无绝对含义） */
export function deckScore(c: Character, ctx: RankContext): number {
  const now = ctx.now ?? Date.now();
  let score = 0;

  // 口味匹配：onboarding 选过就置顶同类；「都可以」不加权
  if (ctx.lovePref && ctx.lovePref !== 'any' && c.loveTag === ctx.lovePref) score += 50;

  // 热度：log 压缩（1 万热度 ≈ +40），防止头部角色永远霸榜
  score += Math.log10(1 + Math.max(0, c.adoptedCount)) * 10;

  // 新面孔：没配过对、没聊过的 +20
  if (!ctx.knownIds?.has(c.id)) score += 20;

  // 你的创作：自己捏的略置顶（UGC 时代同理可换成「关注的创作者」加权）
  if (c.custom) score += 15;

  // 每日轮换抖动 0..25：同一天顺序稳定，隔天洗一次牌，池子不变也有新鲜感
  const day = Math.floor(now / 86400000);
  score += (hash(`${c.id}-${day}`) % 26);

  // 略过冷却：3 天内基本沉底，之后轻罚回流
  const passedAt = ctx.passes[c.id];
  if (passedAt) score -= now - passedAt < PASS_COOLDOWN_MS ? 200 : 30;

  return score;
}

/** 牌堆排序：得分降序；同分按 id 哈希稳定去重排 */
export function rankDeck(pool: Character[], ctx: RankContext): Character[] {
  return [...pool]
    .map((c) => ({ c, s: deckScore(c, ctx) }))
    .sort((a, b) => b.s - a.s || hash(a.c.id) - hash(b.c.id))
    .map((x) => x.c);
}

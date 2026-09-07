/**
 * 她在 TA 心里的分量（D-099）：一个 0～1 的数——TA 自己的本子 / 时间线里有多大比例是关于她的。
 * 恋爱脑（依恋型、病娇、小狗系年下…）满脑子是她；冷静理智的（冷静大人、高冷禁欲、INTJ…）她只是生活的一部分。
 * 全部由角色的结构化字段映射，不靠模型自己拿捏：
 *   基础 = 恋爱类型（创造表单 14 种，HER_SHARE_LOVE_STYLE）→ 没填按追法家族（HER_SHARE_ARCHETYPE，种子角色走这里）
 *   叠加 = MBTI（HER_SHARE_MBTI：F 加、T 减）+ 主动联系强度（HER_SHARE_INITIATIVE）
 *   夹在 0.1～0.9 之间；按阈值分三档（herShareTier）供 prompt 措辞。
 * 用处：记事本 / X 发帖每写一条前掷硬币决定「这一条写不写她」（lib/his-notes.ts / lib/posts.ts），
 * 以及【你自己的生活】/【发帖的写法】里她出现的频率措辞（content/prompts/his-notes.ts / social.ts）。
 * 试装数值，正式版另调。
 */

import type { ArchetypeId, Character } from '@/lib/types';

/** 恋爱类型 → 基础分量（content/characters LOVE_STYLES 的 14 个 label） */
export const HER_SHARE_LOVE_STYLE: Record<string, number> = {
  温柔年上: 0.45,
  小狗系年下: 0.75,
  姐姐系: 0.4,
  依恋型: 0.85,
  阳光直球: 0.65,
  天然治愈: 0.5,
  青梅竹马: 0.55,
  毒舌竹马: 0.45,
  傲娇: 0.5,
  腹黑: 0.5,
  '病娇（尺度内）': 0.9,
  高冷禁欲: 0.3,
  霸总: 0.35,
  冷静大人: 0.25,
};

/** 追法家族 → 基础分量（没填恋爱类型时用；种子角色走这里） */
export const HER_SHARE_ARCHETYPE: Record<ArchetypeId, number> = {
  gentle: 0.5,
  sharp: 0.45,
  ceo: 0.3,
  nonhuman: 0.35,
};

/** MBTI → 增减：F（情感）往她那边偏，T（思考）往自己的事偏；NF 最黏，NT / ST 最独立 */
export const HER_SHARE_MBTI: Record<string, number> = {
  INFP: 0.15, ENFP: 0.1, INFJ: 0.1, ENFJ: 0.1,
  ISFP: 0.1, ESFP: 0.05, ISFJ: 0.1, ESFJ: 0.1,
  INTP: -0.1, ENTP: -0.05, INTJ: -0.15, ENTJ: -0.15,
  ISTP: -0.1, ESTP: -0.05, ISTJ: -0.1, ESTJ: -0.15,
};

/** 主动联系强度 → 增减 */
export const HER_SHARE_INITIATIVE: Record<NonNullable<Character['initiative']>, number> = {
  high: 0.1,
  mid: 0,
  low: -0.1,
};

export const HER_SHARE_MIN = 0.1;
export const HER_SHARE_MAX = 0.9;

/** 三档阈值：≥ devoted 恋爱脑 / ≤ independent 冷静 / 中间 balanced */
export const HER_SHARE_TIERS = { devoted: 0.65, independent: 0.35 } as const;
export type HerShareTier = 'devoted' | 'balanced' | 'independent';

/** 她在 TA 心里的分量：0.1～0.9 */
export function herShare(c: Pick<Character, 'archetype' | 'loveStyle' | 'mbti' | 'initiative'>): number {
  const base = (c.loveStyle ? HER_SHARE_LOVE_STYLE[c.loveStyle] : undefined) ?? HER_SHARE_ARCHETYPE[c.archetype] ?? 0.45;
  const mbti = (c.mbti ? HER_SHARE_MBTI[c.mbti.toUpperCase()] : undefined) ?? 0;
  const initiative = (c.initiative ? HER_SHARE_INITIATIVE[c.initiative] : undefined) ?? 0;
  const v = base + mbti + initiative;
  return Math.round(Math.min(HER_SHARE_MAX, Math.max(HER_SHARE_MIN, v)) * 100) / 100;
}

export function herShareTier(c: Pick<Character, 'archetype' | 'loveStyle' | 'mbti' | 'initiative'>): HerShareTier {
  const v = herShare(c);
  if (v >= HER_SHARE_TIERS.devoted) return 'devoted';
  if (v <= HER_SHARE_TIERS.independent) return 'independent';
  return 'balanced';
}

/** 这一条写不写她：按分量掷硬币 */
export function rollAboutHer(c: Pick<Character, 'archetype' | 'loveStyle' | 'mbti' | 'initiative'>, rand = Math.random()): boolean {
  return rand < herShare(c);
}

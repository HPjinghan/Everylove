/**
 * TA 主动的「额外动作」（D-130，Harper：「所有这些额外的设定（发图 / 给 TA 花钱）都是概率触发的，而且最好有规则：10 条内不会连续触发，
 * 点外卖要三级好感度以上，发红包要二级好感度以上，主动发图要二级好感度以上」）。
 * 三种：发红包 / 点外卖（features/wallet.tsx）、发图（features/his-photo.tsx）。统一走这里的三道门：
 * 1. 等级门：红包 LV2+、外卖 LV3+、发图 LV2+（levelOf：XP × 天数）；
 * 2. 冷却：任何一种触发过之后，TA 再说满 10 条之前都不再触发（记在 Bond.extraFired 上，按 TA 的消息数算）；
 * 3. 概率：这一轮要不要把这个选项给模型——确定性伪随机（羁绊 + 种类 + TA 第几条），基础概率 × 主动联系强度 × 温度档。
 * 暗号落状态时只查前两道门（模型没被给选项也写了暗号 → 门没过就当没写）。
 */

import { levelOf, warmthBand, warmthNow, type LevelSubject, type WarmthSubject } from '@/lib/bond';
import type { Character, ChatMessage } from '@/lib/types';

export type ExtraKind = 'redpacket' | 'delivery' | 'photo';
export const EXTRA_KINDS: ExtraKind[] = ['redpacket', 'delivery', 'photo'];

/** 等级门 */
export const EXTRA_MIN_LEVEL: Record<ExtraKind, number> = { redpacket: 2, delivery: 3, photo: 2 };
/** 触发过之后 TA 再说满几条才能再触发 */
export const EXTRA_COOLDOWN_TURNS = 10;
/** 每一轮给模型这个选项的基础概率 */
export const EXTRA_BASE_PROB: Record<ExtraKind, number> = { redpacket: 0.05, delivery: 0.06, photo: 0.1 };
/** 主动联系强度 / 温度档的系数 */
export const EXTRA_INITIATIVE_MULT = { high: 1.5, mid: 1, low: 0.6 } as const;
export const EXTRA_WARMTH_MULT = { warm: 1.2, plain: 1, distant: 0.5, cold: 0 } as const;

export interface ExtraSubject extends LevelSubject, WarmthSubject {
  createdAt: number;
  /** 上一次触发时 TA 已说了几条 */
  extraFired?: { count: number; at: number };
}

/** TA 说过几条（非系统） */
export function himTurnCount(messages: Pick<ChatMessage, 'from'>[]): number {
  let n = 0;
  for (const m of messages) if (m.from === 'him') n++;
  return n;
}

/** 等级门 + 冷却：这一种现在能不能触发 */
export function extraEligible(b: ExtraSubject, kind: ExtraKind, history: Pick<ChatMessage, 'from'>[], now = Date.now()): boolean {
  if (levelOf(b, now) < EXTRA_MIN_LEVEL[kind]) return false;
  if (b.extraFired && himTurnCount(history) - b.extraFired.count < EXTRA_COOLDOWN_TURNS) return false;
  return true;
}

/** 确定性伪随机 [0, 1)：同一段羁绊、同一种、TA 第几条 → 同一个数（prompt 快照可测） */
export function extraRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** 这一轮的概率（基础 × 主动联系强度 × 温度） */
export function extraProb(b: WarmthSubject, c: Pick<Character, 'initiative'>, kind: ExtraKind, now = Date.now()): number {
  const init = EXTRA_INITIATIVE_MULT[c.initiative ?? 'mid'];
  const warm = EXTRA_WARMTH_MULT[warmthBand(warmthNow(b, now))];
  return Math.min(1, EXTRA_BASE_PROB[kind] * init * warm);
}

/** 三道门都过：这一轮把这个选项给模型 */
export function extraOffered(
  b: ExtraSubject,
  c: Pick<Character, 'initiative'>,
  kind: ExtraKind,
  history: Pick<ChatMessage, 'from'>[],
  now = Date.now()
): boolean {
  if (!extraEligible(b, kind, history, now)) return false;
  const r = extraRand(`${b.createdAt}:${kind}:${himTurnCount(history)}`);
  return r < extraProb(b, c, kind, now);
}

/**
 * 一两个字的回复（D-144，Harper：「真人说话会有很短一两个字的回复，你的这个总是会回句子」）。
 * 光在规则里写「有时一个字就行」模型不照做——每轮按两条触发给一句舞台提示（系统 prompt 末尾）：
 *   - 她这条本身很短且没问什么 → 同样短地回；
 *   - 其余轮次按确定性伪随机约 1/4 抽到 → 这轮如果不需要更多，就几个字。
 * 她问了问题、或发了一大段，不给提示。文本在这里，登记在 features/brevity.ts。
 */

import { extraRand } from '@/lib/extras';
import type { EngineContext } from '@/lib/types';

import { countUserTurns } from './shared';

/** 她这条算「短」的上限（去空白后的字符数）；CJK 一字一符，英文按词数另算 */
const SHORT_CHARS = 10;
const SHORT_WORDS = 3;
/** 超过这个长度的消息不抽随机提示 */
const LONG_CHARS = 60;
/** 随机提示的命中率 */
const RANDOM_RATE = 0.25;

export type BrevityReason = 'short' | 'random' | null;

export function brevityReason(ctx: Pick<EngineContext, 'userText' | 'history'>): BrevityReason {
  const t = ctx.userText.trim();
  if (!t) return null;
  // 舞台提示（括号起头）、问句、她要求什么 → 不提示
  if (/^[（(]/.test(t) || /[?？]/.test(t)) return null;
  const compact = t.replace(/\s+/g, '');
  const words = t.split(/\s+/).filter(Boolean).length;
  const isShort = compact.length <= SHORT_CHARS || (/\s/.test(t) && words <= SHORT_WORDS && compact.length <= SHORT_CHARS * 2);
  if (isShort) return 'short';
  if (compact.length > LONG_CHARS) return null;
  const n = countUserTurns(ctx.history) + 1;
  return extraRand(`brevity:${n}:${compact.slice(0, 12)}`) < RANDOM_RATE ? 'random' : null;
}

export function brevityLines(ctx: Pick<EngineContext, 'userText' | 'history'>): string[] {
  const reason = brevityReason(ctx);
  if (!reason) return [];
  if (reason === 'short') {
    return [
      '[This turn] Her message is a short one. Unless it asks you for something, answer at the same size: one to four words is a complete reply (a bare "嗯", "好", "哈哈哈", "真的假的", "？" or "在" in your language) — no sentence needed.',
    ];
  }
  return ['[This turn] Keep it to a few words if what she said doesn\'t need more — a one- or two-word reply is normal texting, not rudeness.'];
}

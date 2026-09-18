/**
 * 她的回复变短了（D-153，「核心行为框架」五.1：「user 回复变短了、语气不对了，你要敏锐地察觉并自然地问一句」）：
 * 光写在规则里模型看不出趋势——这里按她最近几条的长度算：最近 3 条明显比之前短、而且是刚变短（第 4 条还正常），
 * 就在系统 prompt 末尾给一句舞台提示；只在转折那一轮出，之后不再提（避免每轮都「你怎么了」）。
 * 她这条是问句 / 舞台提示时不提示。登记在 features/mood-shift.ts。
 */

import type { ChatMessage, EngineContext } from '@/lib/types';

/** 最近几条算「最近」 */
const RECENT = 3;
/** 之前至少要有几条、平均至少多长，才谈得上「变短」 */
const BASELINE_MIN = 5;
const BASELINE_MIN_CHARS = 12;
/** 最近平均 ≤ 之前平均的这个比例 = 明显变短 */
const DROP_RATIO = 0.45;
/** 转折判定：最近 3 条之前的那条还得是正常长度（≥ 之前平均的这个比例） */
const BEFORE_RATIO = 0.6;

function herTexts(history: ChatMessage[], userText: string): string[] {
  return [...history.filter((m) => m.from === 'me' && m.kind !== 'card' && m.text).map((m) => m.text), userText];
}

const compactLen = (s: string) => s.replace(/\s+/g, '').length;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 她刚变得话少了 → 'shorter'；否则 null */
export function moodShiftReason(ctx: Pick<EngineContext, 'userText' | 'history'>): 'shorter' | null {
  const t = ctx.userText.trim();
  if (!t || /^[（(]/.test(t) || /[?？]/.test(t)) return null;
  const lens = herTexts(ctx.history, t).map(compactLen);
  if (lens.length < RECENT + 1 + BASELINE_MIN) return null;
  const recent = lens.slice(-RECENT);
  const before = lens[lens.length - RECENT - 1];
  const baseline = lens.slice(0, lens.length - RECENT - 1).slice(-10);
  const base = avg(baseline);
  if (base < BASELINE_MIN_CHARS) return null;
  if (avg(recent) > base * DROP_RATIO) return null;
  if (before < base * BEFORE_RATIO) return null;
  return 'shorter';
}

export function moodShiftLines(ctx: Pick<EngineContext, 'userText' | 'history'>): string[] {
  if (!moodShiftReason(ctx)) return [];
  return [
    "[This turn] Her replies have just gotten noticeably shorter than before. Notice it the way a person would — one light question, or a line that leaves room; don't diagnose her, don't make a thing of it.",
  ];
}

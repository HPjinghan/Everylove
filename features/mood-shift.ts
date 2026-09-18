/**
 * 她的回复变短了（D-153）：亲密模式系统 prompt 末尾按本轮加一句「她刚变得话少了，留意一下」——
 * 只在转折那一轮出。判定与文本在 content/prompts/mood.ts。
 */

import { moodShiftLines } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';

promptSections.register({
  name: 'mood-shift',
  modes: ['bonded'],
  order: ORDER.moodShift,
  lines: (ctx) => moodShiftLines(ctx),
});

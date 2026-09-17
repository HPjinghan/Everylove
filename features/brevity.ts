/**
 * 一两个字的回复（D-144）：聊天两模式在系统 prompt 末尾按本轮情况加一句「这轮短一点」——
 * 她这条很短且没问什么 → 同样短地回；其余轮次约 1/4 抽到。文本与判定在 content/prompts/brevity.ts。
 */

import { brevityLines } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';

promptSections.register({
  name: 'brevity',
  modes: ['square', 'bonded'],
  order: ORDER.brevity,
  lines: (ctx) => brevityLines(ctx),
});

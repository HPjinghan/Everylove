/**
 * 暗面路由的历史窗口（D-167）：她最近几句里有危机内容，四种对话的系统 prompt 都带一句「放下一切认真陪着」，
 * 排在硬规则之后（热线那条已在硬规则里）。文本与判定在 content/prompts/dark-side.ts、lib/dark-side.ts。
 */

import { darkFollowupLines } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';

promptSections.register({
  name: 'dark-followup',
  modes: ['square', 'bonded', 'call', 'outing'],
  order: ORDER.crisis,
  lines: (ctx) => darkFollowupLines(ctx),
});

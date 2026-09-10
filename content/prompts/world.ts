/**
 * 世界书（D-110）：TA 所处的世界与 TA 对一切的认知。
 * 现实世界（默认）不出这一段——模型本来就活在当下的现实里；只有她创建的世界才注入，所有模式 / 用途（对话、外出、通话、记事本、发帖、身边的人）都带。
 */

import type { Character } from '@/lib/types';
import { isRealWorld, worldOf, worldRuleLines } from '@/lib/worlds';

export function worldBlock(c: Pick<Character, 'worldId'>): string[] {
  const w = worldOf(c);
  if (isRealWorld(w)) return [];
  return [
    `【你所在的世界】${w.name}：${w.summary}`,
    ...worldRuleLines(w).map((r) => `- ${r}`),
    '- 你生在这个世界、只知道这个世界里有的东西：这里没有的品牌、明星、新闻、科技、地名，你不认识也不会提；她说到你不认识的东西，按你的世界去理解，或直接问她。',
    '- 你身边的人、你的工作与日常都在这个世界里；「手机」「消息」「发帖」按这个世界里对应的东西理解，不出戏、不解释设定。',
  ];
}

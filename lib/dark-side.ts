/**
 * 情绪暗面路由的判定（系统层，红线 3；D-167）：
 * - 命中当前这句 → 引擎回固定的温柔回复、不进模型（lib/engine.darkSideCheck）；
 * - 命中最近几句 → 之后每轮系统 prompt 都带一句「她刚说过让人担心的话，放下一切认真陪着」（content/prompts/dark-side.ts），
 *   模型看得到历史里那句危机内容，但不会顺着人设入戏；
 * - 记忆提取跳过命中的那些消息（她的那句与固定回复都不进 facts / summary）——素材按最高敏感级处理。
 * 触发词与固定回复在 content/characters/index.ts（四语）。
 */

import { DARK_SIDE_PATTERN, isDarkSideReply } from '@/content/characters';
import type { ChatMessage } from '@/lib/types';

/** 「最近几句」= 她最近这么多条消息里有没有命中 */
export const RECENT_DARK_TURNS = 6;

/** 她的一条消息里模型会看到的文字（语音看转写、照片看描述） */
function herText(m: ChatMessage): string {
  return [m.text, m.transcript, m.caption].filter(Boolean).join('\n');
}

/** 这条消息是不是危机内容：她的命中触发词，TA 的是固定的温柔回复 */
export function isDarkMessage(m: ChatMessage): boolean {
  if (m.from === 'me') return DARK_SIDE_PATTERN.test(herText(m));
  if (m.from === 'him') return isDarkSideReply(m.text);
  return false;
}

/** 她最近 RECENT_DARK_TURNS 条里有没有命中（历史窗口，D-167） */
export function recentDarkHit(history: ChatMessage[], turns = RECENT_DARK_TURNS): boolean {
  let seen = 0;
  for (let i = history.length - 1; i >= 0 && seen < turns; i--) {
    const m = history[i];
    if (m.from !== 'me') continue;
    seen++;
    if (DARK_SIDE_PATTERN.test(herText(m))) return true;
  }
  return false;
}

/** 去掉危机内容的消息（记忆提取用） */
export function withoutDark(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.filter((m) => !isDarkMessage(m));
}

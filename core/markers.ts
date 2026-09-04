/**
 * 回复标记（D-086）：模型在回复末尾写的「系统暗号」——她看不到，落成状态。
 * 现有两枚：[解锁手机]（D-082）、[拆红包]（D-084）。加一枚 = 一个玩法注册一条：mark（暗号原文）+ key + apply（怎么落状态）。
 * 引擎在拆气泡后统一剥掉所有已注册的暗号并置位 reply.flags[key]；回合管线再按 flags 逐个 apply。
 */

import type { ConversationMode, TurnScope } from '@/core/modes';
import { createRegistry } from '@/core/registry';
import type { EngineContext, EngineReply } from '@/lib/types';

export interface MarkerInfo {
  scope: TurnScope;
  ctx: EngineContext;
  mode: ConversationMode;
}

export interface ReplyMarker {
  /** flags 里的键 */
  key: string;
  /** 模型写的暗号原文，如 '[解锁手机]' */
  mark: string;
  /** 暗号出现时怎么落状态（可读写 store、往会话里追加系统消息） */
  apply(info: MarkerInfo): void | Promise<void>;
}

export const replyMarkers = createRegistry<ReplyMarker>('replyMarkers', (m) => m.key);

/** 剥掉所有已注册的暗号并置位；全剥空则留一个省略号（TA 至少要回一声） */
export function stripReplyMarkers(reply: EngineReply): EngineReply {
  let texts = reply.texts;
  const flags: Record<string, boolean> = { ...(reply.flags ?? {}) };
  let hit = false;
  for (const m of replyMarkers.list()) {
    if (!texts.some((t) => t.includes(m.mark))) continue;
    texts = texts.map((t) => t.split(m.mark).join('').trim());
    flags[m.key] = true;
    hit = true;
  }
  if (!hit) return reply;
  const cleaned = texts.filter(Boolean);
  return { ...reply, flags, texts: cleaned.length ? cleaned : ['……'] };
}

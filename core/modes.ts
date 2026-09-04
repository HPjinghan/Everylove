/**
 * 会话模式（D-086）：初识 / 亲密 / 外出 / 通话——「她说一句、TA 回一句」这件事在不同场合的差别，全部收在这一个接口里：
 * 历史在哪、消息落到哪、她开口算什么账（心动 / XP）、组什么引擎上下文、回复拆几条气泡、要不要剥（）舞台提示。
 * 回合管线（core/turn.ts）只认这个接口；加一种模式（群聊、故事章节……）= 注册一个 ConversationMode。
 */

import { createRegistry } from '@/core/registry';
import type { ChatMessage, EngineContext } from '@/lib/types';

export type ModeId = EngineContext['mode'];

/** 一段会话的定位：模式 + 它挂在哪（羁绊 id / 角色 id） */
export interface TurnScope {
  mode: ModeId;
  bondId?: string;
  characterId?: string;
}

export interface ConversationMode {
  id: ModeId;
  /** 组引擎上下文（人设 / 关系 / 她的身份 / 历史）；找不到会话返回 null */
  context(scope: TurnScope, userText: string): EngineContext | null;
  /** 往会话里落消息（TA 的话、系统条） */
  append(scope: TurnScope, msgs: ChatMessage[], opts?: { unreadDelta?: number }): void;
  /** 她开口一次的账：心动值 / 羁绊 XP / 轮次（contextText = 这句在模型眼里的文字） */
  creditUserTurn(scope: TurnScope, contextText: string): void;
  /** 就地改一条消息（语音识别 / 看图结果回填） */
  patch(scope: TurnScope, msgId: string, patch: Partial<ChatMessage>): void;
  /** 回复最多拆几条气泡 */
  maxBubbles: number;
  /** 是否剥掉（）舞台提示（外出模式的现场描写是合法语法，不剥） */
  stripStage: boolean;
}

export const modes = createRegistry<ConversationMode>('modes', (m) => m.id);

export function modeOf(scope: TurnScope): ConversationMode {
  const m = modes.get(scope.mode);
  if (!m) throw new Error(`底座未启动：没有注册会话模式「${scope.mode}」（先 import "@/features"）`);
  return m;
}

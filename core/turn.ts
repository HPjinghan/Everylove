/**
 * 回合管线（D-086）——全 App 唯一的一条「她说一句、TA 回一句」：
 *   组上下文（模式）→ 暗面路由（系统层，不可拆）→ 供应商 → 拆气泡 / 剥标记 → 打字节奏 → 落气泡（bubble 钩子可改写）
 *   → 回复标记落状态（markers）→ 回合后钩子（after：记忆 / 约定识别 / 心动满的 offer……）
 * 会话页、外出页、通话、查手机、爽约提醒都走这里，只传不同的 scope 与 ui。
 * 借 dsh 的纪律：「新行为挂扩展点，不改 loop」——要加东西，注册钩子 / 标记 / 模式，不要在这里加分支。
 */

import { cardContextText } from '@/core/cards';
import { createEmitHook, createWaterfallHook } from '@/core/hooks';
import { replyMarkers } from '@/core/markers';
import { modeOf, type ConversationMode, type TurnScope } from '@/core/modes';
import { describeAiError, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ChatCard, ChatMessage, EngineContext, EngineReply } from '@/lib/types';

/** 界面侧的参与：打字指示、节奏、要不要计未读 */
export interface TurnUi {
  typing?(on: boolean): void;
  /** natural = 按字数等一会儿再回、多条气泡之间停半秒；none = 立刻（通话 / 后台） */
  pace?: 'natural' | 'none';
  /** TA 的话计未读（她不在这个会话页时） */
  unread?: boolean;
}

export interface TurnInfo {
  scope: TurnScope;
  ctx: EngineContext;
  mode: ConversationMode;
  reply: EngineReply;
  darkSide: boolean;
  ui: TurnUi;
}

export interface BubbleInfo extends TurnInfo {
  index: number;
  total: number;
}

export interface TurnResult {
  /** null = 这轮 TA 没回上（原因已作为系统消息落在会话里） */
  reply: EngineReply | null;
  error?: unknown;
}

/** 回合管线上的扩展点 */
export const turnHooks = {
  /** 气泡落屏前：可改写这条消息（例：最后一条改成语音） */
  bubble: createWaterfallHook<ChatMessage, [BubbleInfo]>('turn.bubble'),
  /** 回合结束（气泡已落、标记已生效）：记忆、约定识别、产品触发器…… */
  after: createEmitHook<[TurnInfo]>('turn.after'),
};

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 「TA 在打字」的时长：按她那句的长度 */
export function naturalDelay(text: string): number {
  return 700 + Math.min(1200, text.length * 40);
}

export function sysMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'system', kind: 'system', text, at: Date.now() };
}

export function himMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'him', kind: 'text', text, at: Date.now() };
}

export function meMsg(text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: uid('m'), from: 'me', kind: 'text', text, at: Date.now(), ...extra };
}

/**
 * TA 回一轮。userText 是模型视角的文字（语音 / 照片 / 卡片已经包装过；舞台提示也从这里进），
 * 调用前她的消息应已落会话并记账（sendText / sendCard 会做；respond 则只让 TA 说话）。
 */
export async function runTurn(scope: TurnScope, userText: string, ui: TurnUi = {}): Promise<TurnResult> {
  const mode = modeOf(scope);
  const ctx = mode.context(scope, userText);
  if (!ctx) return { reply: null };
  const pace = ui.pace ?? 'natural';

  ui.typing?.(true);
  let reply: EngineReply;
  try {
    reply = await generateReply(ctx);
  } catch (e) {
    // 模型调用失败：在会话里露出原因（D-069：没有脚本回落，错误要看得见）
    ui.typing?.(false);
    mode.append(scope, [sysMsg(t('模型调用失败，TA 这条没回上：{reason}', { reason: describeAiError(e) }))]);
    return { reply: null, error: e };
  }
  if (pace === 'natural') await wait(naturalDelay(userText));
  ui.typing?.(false);

  const info: TurnInfo = { scope, ctx, mode, reply, darkSide: !!reply.darkSide, ui };
  const total = reply.texts.length;
  for (const [i, text] of reply.texts.entries()) {
    if (i > 0 && pace === 'natural') await wait(500);
    const msg = await turnHooks.bubble.run(himMsg(text), { ...info, index: i, total });
    mode.append(scope, [msg], { unreadDelta: ui.unread ? 1 : 0 });
  }

  for (const m of replyMarkers.list()) {
    if (!reply.flags?.[m.key]) continue;
    try {
      await m.apply({ scope, ctx, mode });
    } catch (e) {
      console.warn(`[marker:${m.key}] 落状态失败：`, e);
    }
  }

  await turnHooks.after.emit(info);
  return { reply };
}

/** 她发一句文字：落会话 + 记账 → TA 回 */
export async function sendText(
  scope: TurnScope,
  text: string,
  opts: { replyTo?: ChatMessage['replyTo']; ui?: TurnUi } = {}
): Promise<TurnResult> {
  const mode = modeOf(scope);
  mode.append(scope, [meMsg(text, { replyTo: opts.replyTo })]);
  mode.creditUserTurn(scope, text);
  return runTurn(scope, text, opts.ui);
}

/**
 * 她发一张卡片：落会话（kind card）+ 记账 → TA 按提示语回。
 * prompt 是本轮给 TA 的舞台提示（不入会话）；卡片本身入会话，之后靠 cardContextText 重建上下文。
 */
export async function sendCard(
  scope: TurnScope,
  card: ChatCard,
  prompt: string,
  ui?: TurnUi
): Promise<TurnResult & { id: string }> {
  const mode = modeOf(scope);
  const msg: ChatMessage = { id: uid('m'), from: 'me', kind: 'card', text: card.title, card, at: Date.now() };
  mode.append(scope, [msg]);
  mode.creditUserTurn(scope, cardContextText(card));
  const r = await runTurn(scope, prompt, ui);
  return { id: msg.id, ...r };
}

/** 只让 TA 说话（她没开口）：舞台提示只作本轮 user 文本、不入会话——接电话第一句、爽约后主动说一句、看完她的手机 */
export const respond = runTurn;

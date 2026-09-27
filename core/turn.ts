/**
 * 回合管线（D-086）——全 App 唯一的一条「她说一句、TA 回一句」：
 *   组上下文（模式）→ 暗面路由（系统层，不可拆）→ 供应商 → 拆气泡 / 剥标记 → 打字节奏 → 落气泡（bubble 钩子可改写）
 *   → 回复标记落状态（markers）→ 回合后钩子（after：记忆 / 约定识别 / 心动满的 offer……）
 * 会话页、外出页、通话、查手机、爽约提醒都走这里，只传不同的 scope 与 ui。
 * TA 先开口的后台路（D-177）：draftReply 写好一条不落屏（TA 主动 / 召回 / 心跳到点前写好），landReply 到点把它落进会话——
 * 同一条管线的后半段（bubble 钩子 / 暗号落状态 / after 钩子），只是不等打字节奏。
 * 借 dsh 的纪律：「新行为挂扩展点，不改 loop」——要加东西，注册钩子 / 标记 / 模式，不要在这里加分支。
 */

import { showToast } from '@/components/toast';
import { cardContextText } from '@/core/cards';
import { createEmitHook, createWaterfallHook } from '@/core/hooks';
import { replyMarkers } from '@/core/markers';
import { modeOf, type ConversationMode, type TurnScope } from '@/core/modes';
import { createRegistry } from '@/core/registry';
import { describeAiError, generateReply, messageContextText } from '@/lib/engine';
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
  /** 模型失败时不弹轻提示（调用方自己兜底，例：外出开场白回落模板） */
  quiet?: boolean;
}

/** 模型失败的轻提示停留时长（D-169：只说「没回上」，原因记在她那条消息上；识别 / 看图失败的提示同样时长） */
export const TURN_ERROR_TOAST_MS = 2600;

export interface TurnInfo {
  scope: TurnScope;
  ctx: EngineContext;
  mode: ConversationMode;
  reply: EngineReply;
  darkSide: boolean;
  ui: TurnUi;
  /** 她发起的回合（sendText / sendCard / 语音 / 照片）；TA 先开口的 respond 不算——流量只扣她发起的（D-132） */
  her: boolean;
}

/** 回合闸门（D-132）：她要开口前逐个问一遍，返回一句原因 = 这回合发不出（顶部轻提示），null = 放行 */
export interface TurnGate {
  key: string;
  check(scope: TurnScope): string | null;
}
export const turnGates = createRegistry<TurnGate>('turnGates', (g) => g.key);

/** 过闸门：被拦下返回原因并已提示 */
export function gateBlocked(scope: TurnScope): string | null {
  for (const g of turnGates.list()) {
    const reason = g.check(scope);
    if (reason) {
      showToast(reason, { durationMs: TURN_ERROR_TOAST_MS });
      return reason;
    }
  }
  return null;
}

export interface BubbleInfo extends TurnInfo {
  index: number;
  total: number;
}

export interface TurnResult {
  /** null = 这轮 TA 没回上（原因已作轻提示露出，不进会话） */
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

/** TA 打这条要多久（D-146）：按 TA 这条气泡的长度——起步 0.6 s，每个字 60 ms，最长 3.2 s；第二条之前再停一下 */
export function typingDelay(text: string, index = 0): number {
  return (index > 0 ? 400 : 0) + 600 + Math.min(2600, text.length * 60);
}

/** 兼容旧名 */
export const naturalDelay = typingDelay;

export function sysMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'system', kind: 'system', text, at: Date.now() };
}

export function himMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'him', kind: 'text', text, at: Date.now() };
}

export function meMsg(text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: uid('m'), from: 'me', kind: 'text', text, at: Date.now(), ...extra };
}

export interface TurnMeta {
  /** 她发起的回合（流量只扣她发起的，D-132） */
  her?: boolean;
  /** 她这轮的那条消息（失败时标在它上面、可重发，D-169） */
  msgId?: string;
  /** 她这条已在会话里、又作为本轮的话送进去（重发 / 合成的一轮）：历史里去掉它免得重复 */
  exclude?: boolean;
}

/** 排队的一轮（D-169）：TA 在回的时候她又说的；land = 到点要落进会话的后台消息（D-177），等这轮落完再落 */
interface TurnJob {
  userText: string;
  ui: TurnUi;
  her: boolean;
  msgIds: string[];
  resolve(r: TurnResult): void;
  land?: () => Promise<void>;
}
/** 每段会话一条队列：正在回的那轮 + 期间攒下的 */
const running = new Map<string, TurnJob[]>();
const scopeKey = (s: TurnScope) => `${s.mode}:${s.bondId ?? s.characterId ?? ''}:${s.postId ?? ''}`;

/**
 * TA 回一轮。userText 是模型视角的文字（语音 / 照片 / 卡片已经包装过；舞台提示也从这里进），
 * 调用前她的消息应已落会话并记账（sendText / sendCard 会做；respond 则只让 TA 说话）。
 * 同一段会话不并行（D-169）：TA 在回的时候她又说了，等这轮落完再回——她连发的几条合成一轮一起回（像人一样），
 * 不是她说的（舞台提示）单独一轮；排队的调用在它那轮落完后才 resolve。
 */
export async function runTurn(scope: TurnScope, userText: string, ui: TurnUi = {}, meta: TurnMeta = {}): Promise<TurnResult> {
  const key = scopeKey(scope);
  const msgIds = meta.msgId ? [meta.msgId] : [];
  const queue = running.get(key);
  if (queue) {
    return new Promise<TurnResult>((resolve) => queue.push({ userText, ui, her: !!meta.her, msgIds, resolve }));
  }
  const pending: TurnJob[] = [];
  running.set(key, pending);
  try {
    const first = await runOne(scope, userText, ui, !!meta.her, msgIds, meta.exclude ? msgIds : []);
    await drainPending(scope, pending);
    return first;
  } finally {
    running.delete(key);
    for (const j of pending) j.resolve({ reply: null });
  }
}

/** 把这轮期间攒下的排队项跑完：她连发的合成一轮、后台落消息的单独落、舞台提示单独一轮 */
async function drainPending(scope: TurnScope, pending: TurnJob[]): Promise<void> {
  while (pending.length) {
    const head = pending.shift()!;
    if (head.land) {
      await head.land();
      head.resolve({ reply: null });
      continue;
    }
    const batch = [head];
    if (head.her) while (pending.length && pending[0].her && !pending[0].land) batch.push(pending.shift()!);
    const ids = batch.flatMap((j) => j.msgIds);
    const r = await runOne(scope, batch.map((j) => j.userText).join('\n'), batch[batch.length - 1].ui, head.her, ids, ids);
    for (const j of batch) j.resolve(r);
  }
}

/** 只让 TA 回上一轮（不排队；由 runTurn 调） */
async function runOne(scope: TurnScope, userText: string, ui: TurnUi, her: boolean, msgIds: string[], excludeIds: string[]): Promise<TurnResult> {
  const mode = modeOf(scope);
  const ctx = mode.context(scope, userText);
  if (!ctx) return { reply: null };
  if (excludeIds.length) ctx.history = ctx.history.filter((m) => !excludeIds.includes(m.id));
  const pace = ui.pace ?? 'natural';

  ui.typing?.(true);
  let reply: EngineReply;
  try {
    reply = await generateReply(ctx);
  } catch (e) {
    // 模型调用失败（D-169）：她那条标「没送到」可重发，轻提示只说没回上；原因记在消息上、开发者看 console（不写进会话，D-110）
    ui.typing?.(false);
    const reason = describeAiError(e);
    console.warn('[turn] TA 没回上：', reason);
    for (const id of msgIds) mode.patch(scope, id, { failed: reason });
    if (!ui.quiet) showToast(t('TA 这条没回上'), { durationMs: TURN_ERROR_TOAST_MS });
    return { reply: null, error: e };
  }

  const info: TurnInfo = { scope, ctx, mode, reply, darkSide: !!reply.darkSide, ui, her };
  await settle(info, { pace });
  return { reply };
}

/** 管线的后半段：落气泡（bubble 钩子可改写）→ 暗号落状态 → after 钩子；她开口的回合与后台落消息共用（D-177） */
async function settle(info: TurnInfo, opts: { pace: 'natural' | 'none'; at?: number; extra?: Partial<ChatMessage> }): Promise<void> {
  const { scope, mode, reply, ui, ctx } = info;
  const total = reply.texts.length;
  // 每条气泡：「正在输入」按这条的长度停一会儿再上屏（D-146）；模型已经花掉的时间不再另算
  for (const [i, text] of reply.texts.entries()) {
    if (opts.pace === 'natural') {
      ui.typing?.(true);
      await wait(typingDelay(text, i));
    }
    ui.typing?.(false);
    const base: ChatMessage = { ...himMsg(text), ...(opts.at !== undefined ? { at: opts.at + i } : {}), ...opts.extra };
    const msg = await turnHooks.bubble.run(base, { ...info, index: i, total });
    mode.append(scope, [msg], { unreadDelta: ui.unread ? 1 : 0 });
  }
  await applyMarkers(scope, reply, { ctx, unread: ui.unread });
  await turnHooks.after.emit(info);
}

/**
 * 后台写一条（D-177）：TA 主动 / 召回 / 心跳到点前写好、不落屏——走引擎（暗面路由 / 分段表 / 剥暗号，便宜供应商），
 * 不排队（写好的东西之后再落）。没写成返回 null（调用方自己决定回落模板还是跳过）。
 */
export async function draftReply(scope: TurnScope, userText: string): Promise<EngineReply | null> {
  const mode = modeOf(scope);
  const ctx = mode.context(scope, userText);
  if (!ctx) return null;
  const reply = await generateReply(ctx, undefined, { background: true });
  const texts = reply.texts.filter(Boolean);
  return texts.length ? { ...reply, texts } : null;
}

/**
 * 把写好的一条落进会话（D-177）：与她开口的回合同一条后半段——bubble 钩子（可能变语音）、暗号落状态、after 钩子（记忆 / 约定识别）；
 * 不等打字节奏。TA 正在回她的那轮还没落完时排在它后面，不插队。
 */
export async function landReply(scope: TurnScope, reply: EngineReply, opts: { at?: number; unread?: boolean; extra?: Partial<ChatMessage> } = {}): Promise<void> {
  const land = async () => {
    const mode = modeOf(scope);
    const ctx = mode.context(scope, '');
    if (!ctx) return;
    const ui: TurnUi = { pace: 'none', unread: opts.unread, quiet: true };
    const info: TurnInfo = { scope, ctx, mode, reply, darkSide: !!reply.darkSide, ui, her: false };
    await settle(info, { pace: 'none', at: opts.at, extra: opts.extra });
  };
  const key = scopeKey(scope);
  const queue = running.get(key);
  if (queue) {
    return new Promise<void>((resolve) => queue.push({ userText: '', ui: {}, her: false, msgIds: [], resolve: () => resolve(), land }));
  }
  const pending: TurnJob[] = [];
  running.set(key, pending);
  try {
    await land();
    await drainPending(scope, pending);
  } finally {
    running.delete(key);
    for (const j of pending) j.resolve({ reply: null });
  }
}

/** 按 flags 逐个落暗号；回合外（主动找她）也能用——ctx 不传就按 scope 现组 */
export async function applyMarkers(scope: TurnScope, reply: EngineReply, opts: { ctx?: EngineContext; unread?: boolean } = {}): Promise<void> {
  const mode = modeOf(scope);
  const ctx = opts.ctx ?? mode.context(scope, '');
  if (!ctx) return;
  for (const m of replyMarkers.list()) {
    if (!reply.flags?.[m.key]) continue;
    try {
      await m.apply({ scope, ctx, mode, value: reply.values?.[m.key], unread: opts.unread });
    } catch (e) {
      console.warn(`[marker:${m.key}] 落状态失败：`, e);
    }
  }
}

/** 她发一句文字：落会话 + 记账 → TA 回 */
export async function sendText(
  scope: TurnScope,
  text: string,
  opts: { replyTo?: ChatMessage['replyTo']; ui?: TurnUi } = {}
): Promise<TurnResult> {
  if (gateBlocked(scope)) return { reply: null };
  const mode = modeOf(scope);
  const msg = meMsg(text, { replyTo: opts.replyTo });
  mode.append(scope, [msg]);
  mode.creditUserTurn(scope, text, 'text');
  return runTurn(scope, text, opts.ui, { her: true, msgId: msg.id });
}

/** 重发（D-169）：TA 没回上的那条，她点一下再让 TA 回——不再落会话、不再记账 */
export async function resendTurn(scope: TurnScope, msgId: string, ui?: TurnUi): Promise<TurnResult> {
  if (gateBlocked(scope)) return { reply: null };
  const mode = modeOf(scope);
  const msg = mode.context(scope, '')?.history.find((m) => m.id === msgId);
  if (!msg || msg.from !== 'me') return { reply: null };
  mode.patch(scope, msgId, { failed: undefined });
  return runTurn(scope, messageContextText(msg), ui, { her: true, msgId, exclude: true });
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
  if (gateBlocked(scope)) return { id: '', reply: null };
  const mode = modeOf(scope);
  const msg: ChatMessage = { id: uid('m'), from: 'me', kind: 'card', text: card.title, card, at: Date.now() };
  mode.append(scope, [msg]);
  mode.creditUserTurn(scope, cardContextText(card), 'card');
  const r = await runTurn(scope, prompt, ui, { her: true, msgId: msg.id });
  return { id: msg.id, ...r };
}

/** 只让 TA 说话（她没开口）：舞台提示只作本轮 user 文本、不入会话——接电话第一句、爽约后主动说一句、看完她的手机 */
export const respond = runTurn;

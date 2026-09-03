/**
 * 羁绊会话的引擎回合（D-085）——从会话页抽出来、任何地方都能让 TA「回一句」的公共层：
 * - sendCardAndRespond：她发一张卡片（+XP）→ TA 按提示语回 → 落会话（unread +1）→ 标记副作用 → 记忆 / 约定识别
 * - applyReplyEffects：回复里的系统标记落成状态（[解锁手机] → 解锁；[拆红包] → 最近一个没拆的红包「已领取」）
 * - peekMyPhone：她让 TA 看自己的手机——TA 翻记事本与她和别人的聊天，然后给她发一条消息；记事本内容并进记忆
 * 会话页自己带打字指示与语音，所以仍用自己的 respond，只共用 applyReplyEffects。
 */

import { buildPeekMyPhoneUser, todayLine } from '@/content/prompts';
import { showToast } from '@/components/toast';
import { XP_PER_MESSAGE } from '@/lib/bond';
import { darkSideCheck, describeAiError, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { absorbNotesMemory, addMemoryFact, updateBondMemory } from '@/lib/memory';
import { detectAppointment } from '@/lib/outing';
import type { Bond, ChatCard, ChatMessage, EngineContext, EngineReply } from '@/lib/types';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

function sysMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'system', kind: 'system', text, at: Date.now() };
}

function bondNow(bondId: string): Bond | undefined {
  return useAppStore.getState().bonds.find((b) => b.id === bondId);
}

/** 亲密模式的引擎上下文（含手机密码：第一次需要时生成） */
export function bondedContext(bond: Bond, userText: string): EngineContext | null {
  const character = findCharacter(bond.characterId);
  if (!character) return null;
  const phoneCode = useAppStore.getState().ensurePhoneCode(bond.id);
  return {
    character,
    mode: 'bonded',
    bond: {
      name: bond.name,
      nickname: bond.nickname,
      affinity: bond.affinity,
      birthday: bond.birthday,
      createdAt: bond.createdAt,
      memory: bond.memory,
      phoneCode,
      phoneUnlocked: bond.phoneUnlocked,
    },
    me: meForCharacter(character.id),
    history: bond.messages,
    userText,
  };
}

/** 回复里的系统标记 → 状态（会话页与公共层共用） */
export function applyReplyEffects(bondId: string, reply: EngineReply): void {
  const store = useAppStore.getState();
  const bond = bondNow(bondId);
  if (!bond) return;
  if (reply.unlockPhone && !bond.phoneUnlocked) {
    store.setPhoneUnlocked(bondId);
    store.appendBond(bondId, [sysMsg(t('TA 同意让你看手机了'))]);
  }
  if (reply.openRedPacket) {
    const packet = [...bond.messages].reverse().find((m) => m.card?.type === 'redpacket' && !m.card.claimed);
    if (packet?.card) {
      store.patchMessage({ bondId }, packet.id, { card: { ...packet.card, claimed: true, declined: false } });
    }
  }
}

/** TA 回一轮（不在会话页时用：没有打字指示，直接落会话并计未读）。失败在会话里露出原因。 */
export async function respondAsHim(bondId: string, userText: string): Promise<EngineReply | null> {
  const bond = bondNow(bondId);
  const ctx = bond && bondedContext(bond, userText);
  if (!ctx) return null;
  let reply: EngineReply;
  try {
    reply = await generateReply(ctx);
  } catch (e) {
    useAppStore
      .getState()
      .appendBond(bondId, [sysMsg(t('模型调用失败，TA 这条没回上：{reason}', { reason: describeAiError(e) }))]);
    return null;
  }
  useAppStore.getState().appendBond(
    bondId,
    reply.texts.map((text, i) => ({ id: uid('m'), from: 'him' as const, kind: 'text' as const, text, at: Date.now() + i })),
    { unreadDelta: reply.texts.length }
  );
  applyReplyEffects(bondId, reply);
  void updateBondMemory(bondId);
  void detectAppointment(bondId);
  return reply;
}

/** 她发一张卡片并让 TA 回（任何地方可用） */
export async function sendCardAndRespond(bondId: string, card: ChatCard, prompt: string): Promise<string> {
  const msg: ChatMessage = { id: uid('m'), from: 'me', kind: 'card', text: card.title, card, at: Date.now() };
  useAppStore.getState().appendBond(bondId, [msg], { affinityDelta: XP_PER_MESSAGE });
  await respondAsHim(bondId, prompt);
  return msg.id;
}

/** 记事本最多给 TA 看几条 / 每条多长；她和别人的聊天：几个人、各几句 */
const PEEK_NOTES = 8;
const PEEK_NOTE_CHARS = 240;
const PEEK_OTHERS = 3;
const PEEK_LINES = 6;

/**
 * 让 TA 看我的手机（D-085）：TA 翻她的记事本、她和其他 TA 的近期聊天，然后给她发一条消息（进会话、计未读）。
 * 红线：记事本里出现痛苦 / 危机内容走暗面路由（温柔模式、不入戏）；记事本里的其他真人一个字不评论（他只看她）。
 */
export async function peekMyPhone(bondId: string): Promise<boolean> {
  const state = useAppStore.getState();
  const bond = bondNow(bondId);
  if (!bond) return false;
  const notes = [...state.notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PEEK_NOTES)
    .map((n) => ({ at: n.updatedAt, text: n.text.trim().slice(0, PEEK_NOTE_CHARS) }))
    .filter((n) => n.text);
  const chats = state.bonds
    .filter((b) => b.id !== bondId)
    .map((b) => ({
      name: b.name,
      messages: b.messages.filter((m) => m.from !== 'system' && !m.recalled).slice(-PEEK_LINES),
    }))
    .filter((c) => c.messages.length)
    .sort((a, b) => (b.messages[b.messages.length - 1]?.at ?? 0) - (a.messages[a.messages.length - 1]?.at ?? 0))
    .slice(0, PEEK_OTHERS);

  state.appendBond(bondId, [sysMsg(t('TA 看了你的手机'))]);
  showToast(t('TA 拿起了你的手机'));

  // 暗面路由前置（红线 3）：记事本里有危机内容 → 温柔模式，不入戏
  const dark = darkSideCheck(notes.map((n) => n.text).join('\n'));
  if (dark) {
    useAppStore.getState().appendBond(
      bondId,
      dark.texts.map((text, i) => ({ id: uid('m'), from: 'him' as const, kind: 'text' as const, text, at: Date.now() + i })),
      { unreadDelta: dark.texts.length }
    );
    return true;
  }

  const reply = await respondAsHim(bondId, buildPeekMyPhoneUser({ nickname: bond.nickname, notes, chats }));
  addMemoryFact(bondId, `[节点] ${todayLine()} 她把手机递给 ${bond.name} 看了——记事本和她与别人的聊天`);
  if (notes.length) void absorbNotesMemory(bondId, notes);
  return !!reply;
}

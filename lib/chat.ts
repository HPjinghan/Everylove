/**
 * 会话层 API（D-085 抽出、D-086 落到底座）：界面只 import 这里（和各玩法的 send 函数），不直接碰引擎 / 记忆 / 约定识别。
 * 回合本身在 core/turn（全 App 唯一的一条管线）；这里补上：
 * - 带媒体的两条路：她的语音 / 照片——先上屏，识别 / 看图后回填，再让 TA 回（D-073）；
 * - 让 TA 看我的手机（D-085）：TA 翻她的记事本与她和别人的聊天，然后发 1–2 句消息，记事本并进记忆。
 */

import { showToast } from '@/components/toast';
import { buildPeekMyPhoneUser, todayLine } from '@/content/prompts';
import { modeOf, type TurnScope } from '@/core/modes';
import { himMsg, respond, runTurn, sendCard, sendText, sysMsg, TURN_ERROR_TOAST_MS, type TurnResult, type TurnUi } from '@/core/turn';
import { darkSideCheck, describeAiError, messageContextText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { describeImage, transcribeVoice } from '@/lib/media';
import { absorbNotesMemory, addMemoryFact } from '@/lib/memory';
import type { Bond, ChatMessage, EngineContext } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export { respond, runTurn, sendCard, sendText };
export type { TurnResult, TurnScope, TurnUi };

/* ── 定位一段会话 ── */
export const bondScope = (bondId: string): TurnScope => ({ mode: 'bonded', bondId });
export const callScope = (bondId: string): TurnScope => ({ mode: 'call', bondId });
export const squareScope = (characterId: string): TurnScope => ({ mode: 'square', characterId });
export const outingScope = (characterId: string): TurnScope => ({ mode: 'outing', characterId });

/** 亲密模式的引擎上下文（TA 写记事本等后台用途；含手机密码，第一次需要时生成） */
export function bondedContext(bond: Bond, userText: string): EngineContext | null {
  const scope = bondScope(bond.id);
  return modeOf(scope).context(scope, userText);
}

/** 她的语音（D-073）：先上屏，识别成文字后回填、记账，再让 TA 回应识别出的内容 */
export async function sendVoice(scope: TurnScope, uri: string, durationMs: number, ui?: TurnUi): Promise<TurnResult> {
  const mode = modeOf(scope);
  const msg: ChatMessage = {
    id: uid('m'),
    from: 'me',
    kind: 'voice',
    text: '',
    audioUri: uri,
    durationMs,
    at: Date.now(),
    mediaStatus: 'pending',
  };
  mode.append(scope, [msg]);
  let transcript: string;
  try {
    transcript = await transcribeVoice(uri);
  } catch (e) {
    mode.patch(scope, msg.id, { mediaStatus: 'failed' });
    showToast(t('语音没识别出来，TA 没听到这条：{reason}', { reason: describeAiError(e) }), { durationMs: TURN_ERROR_TOAST_MS });
    return { reply: null, error: e };
  }
  mode.patch(scope, msg.id, { transcript, mediaStatus: undefined });
  const text = messageContextText({ ...msg, transcript, mediaStatus: undefined });
  mode.creditUserTurn(scope, text);
  return runTurn(scope, text, ui);
}

/** 她的照片（D-073）：先上屏，视觉模型描述后回填、记账，再让 TA 回应 */
export async function sendImage(scope: TurnScope, uri: string, ui?: TurnUi): Promise<TurnResult> {
  const mode = modeOf(scope);
  const msg: ChatMessage = {
    id: uid('m'),
    from: 'me',
    kind: 'image',
    text: '',
    imageUri: uri,
    at: Date.now(),
    mediaStatus: 'pending',
  };
  mode.append(scope, [msg]);
  let caption: string;
  try {
    caption = await describeImage(uri);
  } catch (e) {
    mode.patch(scope, msg.id, { mediaStatus: 'failed' });
    showToast(t('照片没看清，TA 没看到这条：{reason}', { reason: describeAiError(e) }), { durationMs: TURN_ERROR_TOAST_MS });
    return { reply: null, error: e };
  }
  mode.patch(scope, msg.id, { caption, mediaStatus: undefined });
  const text = messageContextText({ ...msg, caption, mediaStatus: undefined });
  mode.creditUserTurn(scope, text);
  return runTurn(scope, text, ui);
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
  const bond = state.bonds.find((b) => b.id === bondId);
  if (!bond) return false;
  const scope = bondScope(bondId);
  const mode = modeOf(scope);
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

  mode.append(scope, [sysMsg(t('TA 看了你的手机'))]);
  showToast(t('TA 拿起了你的手机'));

  // 暗面路由前置（红线 3）：记事本里有危机内容 → 温柔模式，不入戏
  const dark = darkSideCheck(notes.map((n) => n.text).join('\n'));
  if (dark) {
    mode.append(scope, dark.texts.map(himMsg), { unreadDelta: dark.texts.length });
    return true;
  }

  const { reply } = await respond(scope, buildPeekMyPhoneUser({ nickname: bond.nickname, notes, chats }), {
    pace: 'none',
    unread: true,
  });
  addMemoryFact(bondId, `[节点] ${todayLine()} 她把手机递给 ${bond.name} 看了——记事本和她与别人的聊天`);
  if (notes.length) void absorbNotesMemory(bondId, notes);
  return !!reply;
}

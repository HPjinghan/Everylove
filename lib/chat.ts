/**
 * 会话层 API（D-085 抽出、D-086 落到底座）：界面只 import 这里（和各玩法的 send 函数），不直接碰引擎 / 记忆 / 约定识别。
 * 回合本身在 core/turn（全 App 唯一的一条管线）；这里补上：
 * - 带媒体的两条路：她的语音 / 照片——先上屏，识别 / 看图后回填，再让 TA 回（D-073）；
 * - 让 TA 看我的手机在 features/phone-peek.tsx（D-194：玩法归位）。
 */

import { showToast } from '@/components/toast';
import { modeOf, type TurnScope } from '@/core/modes';
import { cardKinds } from '@/core/cards';
import { gateBlocked, himMsg, resendTurn, respond, runTurn, sendCard, sendText, sysMsg, TURN_ERROR_TOAST_MS, wait, type TurnResult, type TurnUi } from '@/core/turn';
import { aiRouteSync, describeAiError, messageContextText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { describeImage, transcribeVoice } from '@/lib/media';
import type { Bond, ChatMessage, EngineContext } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export { resendTurn, respond, runTurn, sendCard, sendText };
export type { TurnResult, TurnScope, TurnUi };
// 界面会用到的几个小件（D-187）：消息构造、节奏等待、错误一句话、卡片渲染注册、AI 有没有路——都从这里拿，不直接 import 引擎 / 底座
export { describeAiError, himMsg, sysMsg, wait };
/** 卡片种类（气泡颜色 / 渲染）：各玩法注册在 core/cards */
export const cardKindOf = (type: string) => cardKinds.get(type);
/** AI 现在有没有路（同步近似，界面按钮可用性用） */
export const aiReadySync = () => aiRouteSync() !== 'none';

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
  if (gateBlocked(scope)) return { reply: null };
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
  mode.creditUserTurn(scope, text, 'voice');
  return runTurn(scope, text, ui, { her: true, msgId: msg.id });
}

/** 她的照片（D-073）：先上屏，视觉模型描述后回填、记账，再让 TA 回应 */
export async function sendImage(scope: TurnScope, uri: string, ui?: TurnUi): Promise<TurnResult> {
  if (gateBlocked(scope)) return { reply: null };
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
  mode.creditUserTurn(scope, text, 'image');
  return runTurn(scope, text, ui, { her: true, msgId: msg.id });
}

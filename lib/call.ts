/**
 * 打电话（D-077）：管线式通话——
 *   她说话（录音，音量计自动断句）→ 语音识别（lib/media）→ 聊天引擎「通话模式」（core/turn，prompts §1-C′）→ 语音合成（lib/tts）→ 播放。
 * 全部复用已有模块、不新增模型；每轮延迟 = 识别 + 模型 + 合成，约 4~8 秒（电话里「他在想」的停顿感可以接受）。
 * 电话里说的话都进羁绊会话（viaCall，见 features/modes.ts 的 call 模式）并计 XP——TA 记得电话里说过什么；
 * 电话里答应让她看手机的暗号与聊天里同一套（features/phone-peek.tsx）；挂断后触发记忆提取与约定识别。
 *
 * 为什么不是端到端实时模型：百度已有「端到端语音语言大模型」（wss://aip.baidubce.com/ws/2.0/speech/v1/realtime，
 * audio-realtime-near/far 等，支持 instructions 人设与音色），OpenAI 也有 Realtime——但它们都要**实时 PCM 音频流**，
 * Expo Go 里 expo-audio 只能整段录音，拿不到流。等 dev build 再接（OPEN_QUESTIONS #26）；接口按 CallEngine 抽象预留。
 */

import { CALL_PICKUP_USER } from '@/content/prompts';
import { callScope, respond, sendText } from '@/lib/chat';
import { aiRouteSync } from '@/lib/engine';
import { uid } from '@/lib/format';
import { detectAppointment } from '@/lib/outing';
import { ttsReady } from '@/lib/tts';
import { useAppStore } from '@/store/app-store';

/** 自动断句（音量计）：说话阈值 / 说完后静音多久算一句 / 一句最长 / 一直没开口多久重开录音（免得文件无限长） */
export const VAD = {
  speechDb: -28,
  hangMs: 1300,
  maxTurnMs: 30_000,
  idleRestartMs: 25_000,
};

/** 能打电话 = 能合成语音 + 有聊天引擎取路（识别与合成同一把 key / 同一条代理） */
export function callReady(): boolean {
  return ttsReady() && aiRouteSync() !== 'none';
}

export function formatCallDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** TA 接起电话说的第一句（pickup 提示只作本轮 user 文本，不入会话）；没回上就抛错给界面 */
export async function callPickupLine(bondId: string): Promise<string> {
  const { reply, error } = await respond(callScope(bondId), CALL_PICKUP_USER, { pace: 'none' });
  if (!reply) throw error ?? new Error('call: no reply');
  return reply.texts.join(' ').trim();
}

/** 她说了一句（已转写）：入会话 + XP → TA 回一句（入会话）；返回 TA 的话 */
export async function callReply(bondId: string, herText: string): Promise<string> {
  const { reply, error } = await sendText(callScope(bondId), herText, { ui: { pace: 'none' } });
  if (!reply) throw error ?? new Error('call: no reply');
  return reply.texts.join(' ').trim();
}

/** 挂断：会话里留一条通话记录（像 LINE 的「通话时间」）；电话里约好的见面也记进日程（D-079） */
export function logCall(bondId: string, ms: number): void {
  useAppStore.getState().appendBond(bondId, [
    { id: uid('m'), from: 'system', kind: 'system', text: `📞 ${formatCallDuration(ms)}`, at: Date.now() },
  ]);
  void detectAppointment(bondId);
}

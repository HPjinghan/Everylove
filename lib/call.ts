/**
 * 打电话（D-077）：管线式通话——
 *   她说话（录音，音量计自动断句）→ 语音识别（lib/media）→ 聊天引擎「通话模式」（lib/engine + prompts §1-C′）→ 语音合成（lib/tts）→ 播放。
 * 全部复用已有模块、不新增模型；每轮延迟 = 识别 + 模型 + 合成，约 4~8 秒（电话里「他在想」的停顿感可以接受）。
 * 电话里说的话都进羁绊会话（viaCall）并计 XP——TA 记得电话里说过什么；挂断后触发记忆提取。
 *
 * 为什么不是端到端实时模型：百度已有「端到端语音语言大模型」（wss://aip.baidubce.com/ws/2.0/speech/v1/realtime，
 * audio-realtime-near/far 等，支持 instructions 人设与音色），OpenAI 也有 Realtime——但它们都要**实时 PCM 音频流**，
 * Expo Go 里 expo-audio 只能整段录音，拿不到流。等 dev build 再接（OPEN_QUESTIONS #26）；接口按 CallEngine 抽象预留。
 */

import { CALL_PICKUP_USER } from '@/content/prompts';
import { XP_PER_MESSAGE } from '@/lib/bond';
import { aiRouteSync, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { ttsReady } from '@/lib/tts';
import type { Bond, Character, ChatMessage, EngineContext } from '@/lib/types';
import { meForCharacter, useAppStore } from '@/store/app-store';

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

function bondNow(bondId: string): Bond | undefined {
  return useAppStore.getState().bonds.find((b) => b.id === bondId);
}

function ctxFor(character: Character, bond: Bond, userText: string): EngineContext {
  return {
    character,
    mode: 'call',
    bond: {
      name: bond.name,
      nickname: bond.nickname,
      affinity: bond.affinity,
      birthday: bond.birthday,
      createdAt: bond.createdAt,
      memory: bond.memory,
    },
    me: meForCharacter(character.id),
    history: bond.messages,
    userText,
  };
}

function himMsg(text: string): ChatMessage {
  return { id: uid('m'), from: 'him', kind: 'text', text, at: Date.now(), viaCall: true };
}

/** TA 接起电话说的第一句（pickup 提示只作本轮 user 文本，不入会话） */
export async function callPickupLine(character: Character, bondId: string): Promise<string> {
  const bond = bondNow(bondId);
  if (!bond) throw new Error('bond not found');
  const reply = await generateReply(ctxFor(character, bond, CALL_PICKUP_USER));
  const text = reply.texts.join(' ').trim();
  useAppStore.getState().appendBond(bondId, [himMsg(text)]);
  return text;
}

/** 她说了一句（已转写）：入会话 + XP → TA 回一句（入会话）；返回 TA 的话 */
export async function callReply(character: Character, bondId: string, herText: string): Promise<string> {
  const store = useAppStore.getState();
  store.appendBond(
    bondId,
    [{ id: uid('m'), from: 'me', kind: 'text', text: herText, at: Date.now(), viaCall: true }],
    { affinityDelta: XP_PER_MESSAGE }
  );
  const bond = bondNow(bondId);
  if (!bond) throw new Error('bond not found');
  const reply = await generateReply(ctxFor(character, bond, herText));
  const text = reply.texts.join(' ').trim();
  useAppStore.getState().appendBond(bondId, [himMsg(text)]);
  return text;
}

/** 挂断：会话里留一条通话记录（像 LINE 的「通话时间」） */
export function logCall(bondId: string, ms: number): void {
  useAppStore.getState().appendBond(bondId, [
    { id: uid('m'), from: 'system', kind: 'system', text: `📞 ${formatCallDuration(ms)}`, at: Date.now() },
  ]);
}

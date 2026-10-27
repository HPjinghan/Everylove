/**
 * 打电话（D-077）：管线式通话——
 *   她说话（录音，音量计自动断句）→ 语音识别（lib/media）→ 聊天引擎「通话模式」（core/turn，prompts §1-C′）→ 语音合成（lib/tts）→ 播放。
 * 全部复用已有模块、不新增模型；每轮延迟 = 识别 + 模型 + 合成，约 4~8 秒（电话里「他在想」的停顿感可以接受）。
 * 电话里说的话都进羁绊会话（viaCall，见 features/modes.ts 的 call 模式）并计 XP——TA 记得电话里说过什么；
 * 电话里答应让她看手机的暗号与聊天里同一套（features/phone-peek.tsx）；挂断后触发记忆提取与约定识别。
 *
 * 实时（D-232，0.3.0 起的包）：本机边听边认 + ElevenLabs PCM 边合成边播（lib/live-voice），回话不开思考；她能打断 TA（通话通道 D-238；老包只能点头像，D-237）。
 * 声音与脑子仍是同一个 TA（ElevenLabs 音色 + 同一套 Claude 人设与记忆），所以不接端到端语音模型。
 * 没有这两个原生模块的包（Expo Go / 网页 / 老包）照旧走上面的管线式。
 */

import { CALL_PICKUP_USER } from '@/content/prompts';
import { callScope, respond, sendText } from '@/lib/chat';
import { aiRouteSync } from '@/lib/engine';
import { uid } from '@/lib/format';
import { updateBondMemory } from '@/lib/memory';
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

/**
 * 实时通话的断句与打断（D-232）：
 * - 她说完 = 听到了字，且字不再变、也没声音，满 endMs；
 * - 打断 = TA 说话时她那边冒出来的字里，有够多是 TA 这句里没有的（免提时麦克风会把 TA 的声音也认出来，按字面滤掉）。
 *   通话通道有回声消除（D-238），这条是兜底；老包半双工、TA 说话时不听（D-237）。
 */
export const LIVE = {
  endMs: 750,
  /** 音量（-2～10）高于它算在出声 */
  loud: 1.5,
  /** 中 / 日按字、英 / 韩按词：新冒出来的够这么多才算打断 */
  bargeChars: 4,
  bargeWords: 2,
};

const PUNCT = /[\s\p{P}\p{S}]+/gu;

/** 听到的字里有多少不是 TA 这句里的（中 / 日按字，英 / 韩按词） */
export function novelSpeech(heard: string, said: string, lang: string): { novel: number; total: number } {
  if (lang === 'zh' || lang === 'ja') {
    const pool = new Set(said.replace(PUNCT, ''));
    const chars = [...heard.replace(PUNCT, '')];
    return { novel: chars.filter((c) => !pool.has(c)).length, total: chars.length };
  }
  const words = (x: string) => x.toLowerCase().split(PUNCT).filter(Boolean);
  const pool = new Set(words(said));
  const w = words(heard);
  return { novel: w.filter((x) => !pool.has(x)).length, total: w.length };
}

/** TA 说话时她这边听到的字算不算打断 */
export function isBargeIn(heard: string, said: string, lang: string): boolean {
  const { novel, total } = novelSpeech(heard, said, lang);
  const need = lang === 'zh' || lang === 'ja' ? LIVE.bargeChars : LIVE.bargeWords;
  return novel >= need && novel * 2 >= total;
}

/**
 * 边出字边合成（D-232）：模型吐出来的原文 → 能念的字（暗号 [..] 与（..）描写去掉；还没闭合的括号先扣着不念）。
 * 原文只会往后长，所以结果也只会往后长，已经念过的前缀不会变。
 */
export function speakableText(raw: string): string {
  let s = raw.replace(/\[[^\]]*\]/g, '').replace(/（[^）]*）|\([^)]*\)/g, '');
  const open = s.search(/[[（(]/);
  if (open >= 0) s = s.slice(0, open);
  return s;
}

const SENTENCE_END = /[。！？!?…~～\n]+|[.](?=\s)/g;

/** 从 from 往后取出已经说完整的句子（太短的并进下一句）；返回句子与新的游标 */
export function takeSentences(text: string, from: number): { sentences: string[]; next: number } {
  const sentences: string[] = [];
  let start = from;
  SENTENCE_END.lastIndex = from;
  for (let m = SENTENCE_END.exec(text); m; m = SENTENCE_END.exec(text)) {
    const end = m.index + m[0].length;
    const piece = text.slice(start, end).trim();
    if (piece.replace(/[\s\p{P}]/gu, '').length >= 2) {
      sentences.push(piece);
      start = end;
    }
  }
  return { sentences, next: start };
}

/** 她这句说完了没有 */
export function utteranceDone(o: { text: string; lastTextAt: number; lastLoudAt: number; now: number }): boolean {
  return Boolean(o.text.trim()) && o.now - Math.max(o.lastTextAt, o.lastLoudAt) >= LIVE.endMs;
}

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

/** 她说了一句（已转写）：入会话 + XP → TA 回一句（入会话）；返回 TA 的话。onPartial = 边出字边给（实时通道拿去分句合成） */
export async function callReply(bondId: string, herText: string, onPartial?: (soFar: string) => void): Promise<string> {
  const { reply, error } = await sendText(callScope(bondId), herText, { ui: { pace: 'none', ...(onPartial ? { partial: onPartial } : {}) } });
  if (!reply) throw error ?? new Error('call: no reply');
  return reply.texts.join(' ').trim();
}

/** 挂断：会话里留一条通话记录（像 LINE 的「通话时间」）；电话里约好的见面也记进日程（D-079） */
export function logCall(bondId: string, ms: number): void {
  useAppStore.getState().appendBond(bondId, [
    { id: uid('m'), from: 'system', kind: 'system', text: `📞 ${formatCallDuration(ms)}`, at: Date.now() },
  ]);
  // 电话每整分钟也记一笔（D-126）：通话是最贵的陪伴
  for (let i = 0; i < Math.floor(ms / 60_000); i++) useAppStore.getState().creditBond(bondId, 'callMinute');
  void detectAppointment(bondId);
  // 电话里说过的话也进记忆（挂断时统一提取，D-187 从界面挪进来）
  void updateBondMemory(bondId);
}

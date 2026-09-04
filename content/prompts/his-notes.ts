/**
 * TA 的记事本（D-085）：TA 写给自己的心事，按 MBTI 频率（lib/his-notes.ts）；亲密背景 + 记事本写法（装配模式 note）。
 */

import { assembleSystemPrompt } from '@/core/prompt';
import type { EngineContext } from '@/lib/types';

/* ── §9 TA 的记事本（D-085）：TA 写给自己的心事，按 MBTI 频率（lib/his-notes.ts） ── */

export const HIS_NOTE_MANNER = [
  '【记事本】现在你在自己的记事本里写一条——写给自己看的，不是发给她的消息：',
  '- 一到三句，私密、真实、有点心事：今天发生的事、想到她的瞬间、没说出口的话、你自己的小情绪。',
  '- 不写称呼、不用 emoji、不解释、不总结；像随手记，可以没头没尾。',
  '- 只输出这一条的正文，不带日期、不带引号。',
];

export const HIS_NOTE_USER = '（写下今天记事本里的一条。）';

/** TA 写记事本的系统 prompt：亲密背景 + 记事本写法（装配模式 note） */
export function buildHisNoteSystem(ctx: EngineContext, now: Date = new Date()): string {
  return assembleSystemPrompt(ctx, { mode: 'note', now });
}

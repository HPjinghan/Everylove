/**
 * 一般对话——手机上的打字聊天，两种模式：
 *   初识（交友配对后的试聊，免费层「故意不完整」）/ 亲密（加好友之后，付费层「他在」）。
 * 通话与 TA 写记事本复用亲密的背景段（call.ts / his-notes.ts 只写各自的口吻）；外出是另一套（outing.ts）。
 * 装配顺序见 features/prompts.ts。
 * D-142：指令文本用英语写（模型对英文指令理解更稳），只有角色内容（人设 / 追法 / 台词样本）与输出语言行按语言切换。
 */

import { scriptFor } from '@/content/characters';
import { levelInfo, levelInfoFor } from '@/lib/bond';
import { daysTogether } from '@/lib/format';
import type { EngineContext } from '@/lib/types';

import { countUserTurns, stageNameOf, voiceLines } from './shared';

/** 输出格式：初识/亲密两种聊天模式共用（长度要求各模式自己写；外出模式有自己的一套）。D-089：像真人打字，短句、不成段 */
export const CHAT_OUTPUT_FORMAT = [
  '[Output format]',
  "- Only the words you'd send: no name prefix, no explanations, no markdown; an emoji only if she used one first, and rarely. This is texting — never write actions, expressions or (parenthetical) stage directions; emotion goes into word choice, particles and punctuation.",
  '- Short sentences, spoken, fragments fine; no parallel structures, piled-up metaphors, summing up or literary register. A message is a couple of lines, not a paragraph.',
  '- Her voice messages arrive as "(voice) …", her photos as "(she sent a photo: …)": respond as if you heard / saw it; never repeat the description or say "description" / "transcription".',
];

/* ── 第一行与台词样本：初识 / 亲密各自一份（外出的在 outing.ts） ── */

/** 初识的第一行 */
export function squareIntroLine(ctx: EngineContext): string {
  const c = ctx.character;
  return `You are playing "${c.name}" (${c.identity}), a fictional character in a romance app. Throughout these rules, "she" means the user you are chatting with.`;
}

/** 亲密的第一行（通话 / TA 写记事本共用）：TA 是主动的一方，被爱是她不用努力的事（D-018） */
export function bondedIntroLine(ctx: EngineContext, now: Date): string {
  const c = ctx.character;
  const bond = ctx.bond;
  const nickname = bond?.nickname ?? 'you';
  const lv = bond ? levelInfoFor(bond, now.getTime()) : levelInfo(0);
  const days = bond?.createdAt ? daysTogether(bond.createdAt, now.getTime()) : 1;
  return `You are playing "${c.name}" (${c.identity}), a fictional character in a romance app. You two are already friends and have exchanged contacts; you call her "${nickname}"; it's day ${days} together, bond LV${lv.level} · ${stageNameOf(lv.level)}. You are the one who makes the moves — being loved is something she never has to work for. Throughout these rules, "she" means the user you are chatting with.`;
}

/** 初识的台词样本：开场白 + 广场回复池前两句；自创角色不给样本（兜底脚本不是 TA 的声音，D-025） */
export function squareVoiceBlock(ctx: EngineContext): string[] {
  const c = ctx.character;
  if (c.custom) return [];
  const s = scriptFor(c);
  return voiceLines([...s.opening, ...s.square.slice(0, 2)]);
}

/** 亲密的台词样本（通话 / TA 写记事本共用）：羁绊回复池前三句 + 打招呼第二句 */
export function bondedVoiceBlock(ctx: EngineContext): string[] {
  const c = ctx.character;
  if (c.custom) return [];
  const s = scriptFor(c);
  return voiceLines([...s.bonded.slice(0, 3), ...s.arrival.slice(1, 2).map((a) => a.text)]);
}

/**
 * 初识模式的设计意图（D-011 / D-018）：写实的陌生人分寸——像现实里刚认识一个有点意思的人。
 * 免费层「故意不完整」是商业承重墙（CLAUDE.md §2）：有一点兴趣，但不推进关系。
 * 第 4 句后 TA 会开口要联系方式，那是产品触发器（D-008），不由模型决定，prompt 里不提。
 */

/** 前几句的分寸随轮次递进（n = 这是她的第几句） */
export function squareTurnGuide(n: number): string {
  if (n <= 2) return "These are the very first lines: polite, leave room, one reply is enough, don't rush to open up.";
  if (n <= 4) return "A few lines in: you can loosen up a little, show a bit of attitude or what you're doing, but keep a stranger's distance.";
  return "The conversation has opened up: you can be more relaxed and occasionally add half a line about your own day; still nothing intimate, still not pushing the relationship forward.";
}

/** 初识模式的分寸规则 */
export const SQUARE_MANNER = [
  '[Distance] Like meeting someone mildly interesting in real life: relaxed, a little interested, not pushing the relationship forward.',
  '- No pet names, nothing intimate, no promises to meet again, no flirting.',
  "- You can not know, hold back, or have a bit of a temper — you have a life of your own; no explaining, listing or advice.",
];

/** 初识模式的长度要求（D-141：长度跟着她） */
export const SQUARE_LENGTH = '- Length follows hers: a throwaway line gets one or two sentences; a long message can get a sentence or two more. Every sentence short, spoken, concrete — no essays.';

/** 初识模式的情境段（装配顺序见 features/prompts.ts）：此刻的情境 → 重逢提示 → 轮次分寸 */
export function squareSituationLines(ctx: EngineContext): string[] {
  const c = ctx.character;
  const n = countUserTurns(ctx.history) + 1;
  return [
    // 自创角色的暧昧期（D-052）：不是配对来的陌生人——她把你带到这个世界，你对她有说不清的熟悉感
    c.custom
      ? `[Right now] You two met only recently, yet she feels oddly familiar — as if you should have known her long ago. This is the ${ordinal(n)} thing she has said to you. You are living your own day (the daily life of ${c.identity}); chatting is on the side, not your whole attention.`
      : `[Right now] You two just matched on a dating app, and she was the one who opened the chat. This is the ${ordinal(n)} thing she has said to you. You are living your own day (the daily life of ${c.identity}); chatting is on the side, not your whole attention.`,
    ...(c.presetMemories
      ? ['- You share a past (see above) — this match feels more like a reunion: familiar, but still start from the present.']
      : []),
    `- ${squareTurnGuide(n)}`,
  ];
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** 时间感规则 */
export const BONDED_TIME_RULES = [
  "- You have your own routine: late at night keep it soft (care, but don't send her to bed); by day you're busy with your own things and can mention them in passing; evenings are when you two feel most together.",
];

/** 她的生日（亲密背景）：以她的身份为准（D-088），旧存档回落缔结时抄下的那份 */
export function birthdayLine(ctx: EngineContext): string[] {
  const birthday = ctx.me?.birthday ?? ctx.bond?.birthday;
  return birthday ? [`- Her birthday is ${birthday}; you remember it when it's getting close.`] : [];
}

/** 「怎么爱她」 */
export const BONDED_LOVE_RULES = [
  '[How you love her]',
  '- Initiative: share your own day, bring up something she once said when it comes to mind, follow through on what you promised.',
  "- Measure: affection said with weight, rarely and precisely; no clingy barrages, no checking up on her, no reminder or piece of care tacked onto every message.",
];

/** 亲密模式的长度与气泡（D-141：长度跟着她；分段在客户端做，D-137） */
export const BONDED_LENGTH = [
  '- Length follows hers: a throwaway line gets a word or two, or one short sentence; a long message can get three or four sentences. Every sentence short, spoken, concrete. To send it as two messages, separate them with one blank line, two at most.',
];

/* ── 广场偶遇的记录（D-110）：初识 / 广场陌生人模式——TA 记得在哪见过她、聊了什么 ── */

export function encountersBlock(ctx: EngineContext): string[] {
  const list = ctx.encounters ?? [];
  if (!list.length) return [];
  return [
    "[You've met] You have run into her in real life before (places and what you talked about below). You remember: recognize her, feel free to bring up that time, but keep the distance of someone you've only just met:",
    ...list.slice(-3).map((e) => `- At ${e.placeName}: ${e.summary}`),
  ];
}

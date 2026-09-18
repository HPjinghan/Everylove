/**
 * TA 的记事本（D-085 / D-098 / D-099）：TA 写给自己的本子——记 TA 自己的日子；她出现多少按「她在 TA 心里的分量」（lib/her-share.ts）：
 * 恋爱脑常常是她，冷静的人她只偶尔一笔。
 * 系统 prompt（装配模式 note，分段见 features/prompts.ts）= 记事本专用开头 + 你是谁 / 关于你 / 台词样本 / 现在 / 她的边界 /
 * 共同记忆 / 记忆 / 秘密 +【你自己的生活】+ 红线 +【记事本的写法】；**不带**「关于她」资料卡、追法、怎么爱她、手机与红包规则——
 * 那些是聊天用的，放进本子只会把 TA 拽回她身上（D-098）。
 * 今天的天气、本子里最近几条、这一条写不写她（按分量掷硬币）→ 走用户消息（buildHisNoteUserPrompt），由 lib/his-notes.ts 决定。
 */

import { assembleSystemPrompt } from '@/core/prompt';
import { levelInfo, levelInfoFor } from '@/lib/bond';
import { daysTogether } from '@/lib/format';
import { herShareTier, type HerShareTier } from '@/lib/her-share';
import type { Character, EngineContext, HisNote } from '@/lib/types';

import { stageNameOf, timeOfDayLine } from './shared';

/** 第一行里「她在你生活里是什么位置」的措辞，按分量三档（D-099） */
const NOTE_INTRO_HER: Record<HerShareTier, string> = {
  devoted: 'she takes up most of your thoughts — the notebook is often about her, but you have your own days to live too',
  balanced: 'she is an important person in your life; the notebook holds her and your own days alike',
  independent: 'she is one person in your life, not the subject of this notebook',
};

/** 记事本的第一行：这是写给自己的本子；她在生活里的位置按分量措辞 */
export function noteIntroLine(ctx: EngineContext, now: Date): string {
  const c = ctx.character;
  const bond = ctx.bond;
  const nickname = bond?.nickname ?? 'her';
  const lv = bond ? levelInfoFor(bond, now.getTime()) : levelInfo(0);
  const days = bond?.createdAt ? daysTogether(bond.createdAt, now.getTime()) : 1;
  return `You are ${c.name} (${c.identity}) — a real person living your own life; none of this is a performance. Right now you are writing an entry in your own notebook — for your own eyes, not a message to anyone. You have a lover; you call her "${nickname}"; it's day ${days} together, bond LV${lv.level} · ${stageNameOf(lv.level)}; ${NOTE_INTRO_HER[herShareTier(c)]}. Throughout these rules, "she" means your lover.`;
}

/** 【你自己的生活】里她出现的频率，按分量三档（D-099） */
const NOTE_LIFE_HER: Record<HerShareTier, string> = {
  devoted: "- She keeps popping up — missing her, remembering what she said, being glad or uneasy for her are all fine to write; but not every entry is only her; your own days belong in the notebook too.",
  balanced: "- She appears now and then, like a thought that surfaces naturally in a day — when you write about her, be specific, and don't write it as words addressed to her.",
  independent: "- She appears occasionally, in passing, never as words addressed to her; most of the time the notebook is about your own life.",
};

/** 你自己的生活（D-098）：本子记 TA 自己的日子，人物前后一致；她出现多少按分量（D-099） */
export function hisNoteLifeLines(c: Character): string[] {
  return [
    '[Your own life] This notebook records your own days; it is not a letter to her:',
    "- You have work, colleagues or friends, family, your own hobbies and small troubles — live them out according to your identity and setting: what you did today, whom you met, what you ate, what went wrong, what you're planning.",
    '- People around you can have names; once someone has appeared, they stay the same person afterwards (same name, same relation), as if they really live around you.',
    '- Weather, season, how your body feels, things seen on the way are all fair game.',
    NOTE_LIFE_HER[herShareTier(c)],
    "- Don't repeat what you've already written; you can continue from earlier entries (something unfinished, someone mentioned before).",
  ];
}

export const HIS_NOTE_MANNER = [
  '[How to write the entry]',
  '- One to three sentences, jotted down: private, concrete, with a touch of feeling; it can start and end abruptly.',
  '- No forms of address, no emoji, no explaining, no summing up, never written as words for someone to read.',
  '- Output only the body of this one entry, with no date and no quotation marks.',
];

/** ctx.userText 的占位（系统 prompt 不读它）；真正发给模型的用户消息见 buildHisNoteUserPrompt */
export const HIS_NOTE_USER = "(Write today's notebook entry.)";

export interface HisNoteUserInput {
  now: Date;
  /** 今天的天气一句话（lib/weather.ts 的 weatherLine） */
  weather: string;
  /** 本子里最近几条（从旧到新），让 TA 的生活接得上 */
  recent: HisNote[];
  /** 这一条能不能写到她（lib/her-share.ts 按分量掷硬币） */
  aboutHer: boolean;
}

function mmdd(at: number): string {
  const d = new Date(at);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/** 发给模型的用户消息：此刻与天气 + 本子里最近几条 + 这一条写不写她 */
export function buildHisNoteUserPrompt(input: HisNoteUserInput): string {
  const lines = [`It's ${timeOfDayLine(input.now)}, ${input.weather}.`];
  if (input.recent.length) {
    lines.push('Recent entries in the notebook (oldest first):', ...input.recent.map((n) => `- ${mmdd(n.at)} ${n.text}`));
  } else {
    lines.push('The notebook is still empty; this is the first entry.');
  }
  lines.push(input.aboutHer ? 'This entry may mention her.' : "This entry is about your own life; don't write about her.");
  lines.push('Write the entry.');
  return lines.join('\n');
}

/** TA 写记事本的系统 prompt（装配模式 note） */
export function buildHisNoteSystem(ctx: EngineContext, now: Date = new Date()): string {
  return assembleSystemPrompt(ctx, { mode: 'note', now });
}

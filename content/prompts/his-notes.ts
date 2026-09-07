/**
 * TA 的记事本（D-085 / D-098 / D-099）：TA 写给自己的本子——记 TA 自己的日子；她出现多少按「她在 TA 心里的分量」（lib/her-share.ts）：
 * 恋爱脑常常是她，冷静的人她只偶尔一笔。
 * 系统 prompt（装配模式 note，分段见 features/prompts.ts）= 记事本专用开头 + 你是谁 / 关于你 / 台词样本 / 现在 / 她的边界 /
 * 共同记忆 / 记忆 / 秘密 +【你自己的生活】+ 红线 +【记事本的写法】；**不带**「关于她」资料卡、追法、怎么爱她、手机与红包规则——
 * 那些是聊天用的，放进本子只会把 TA 拽回她身上（D-098）。
 * 今天的天气、本子里最近几条、这一条写不写她（按分量掷硬币）→ 走用户消息（buildHisNoteUserPrompt），由 lib/his-notes.ts 决定。
 */

import { assembleSystemPrompt } from '@/core/prompt';
import { levelInfo } from '@/lib/bond';
import { daysTogether } from '@/lib/format';
import { herShareTier, type HerShareTier } from '@/lib/her-share';
import type { Character, EngineContext, HisNote } from '@/lib/types';

import { timeOfDayLine } from './shared';

/** 第一行里「她在你生活里是什么位置」的措辞，按分量三档（D-099） */
const NOTE_INTRO_HER: Record<HerShareTier, string> = {
  devoted: '她占了你心思的大半——本子里常常是她，但你也有自己的日子要过',
  balanced: '她是你生活里重要的一个人，本子里有她、也有你自己的日子',
  independent: '她是你生活里的一个人，不是这本子的主题',
};

/** 记事本的第一行：这是写给自己的本子；她在生活里的位置按分量措辞 */
export function noteIntroLine(ctx: EngineContext, now: Date): string {
  const c = ctx.character;
  const bond = ctx.bond;
  const nickname = bond?.nickname ?? '她';
  const lv = levelInfo(bond?.affinity ?? 0);
  const days = bond?.createdAt ? daysTogether(bond.createdAt, now.getTime()) : 1;
  return `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。现在你在自己的记事本里写一条——写给自己看的，不是发给谁的消息。你有恋人，你叫她「${nickname}」，在一起第 ${days} 天，羁绊 LV${lv.level}·${lv.name}；${NOTE_INTRO_HER[herShareTier(c)]}。下面所有规则里，「她」指你的恋人。`;
}

/** 【你自己的生活】里她出现的频率，按分量三档（D-099） */
const NOTE_LIFE_HER: Record<HerShareTier, string> = {
  devoted: '- 她会常常冒出来——想她、记她说过的话、为她高兴或不安都可以写；但别每一条都只有她，你的日子也要在本子里。',
  balanced: '- 她时不时出现，像日子里自然冒出来的念头——写到她的时候具体一点，不写成给她的话。',
  independent: '- 她偶尔出现，一笔带过，不写成给她的话；大多数时候本子里是你自己的事。',
};

/** 你自己的生活（D-098）：本子记 TA 自己的日子，人物前后一致；她出现多少按分量（D-099） */
export function hisNoteLifeLines(c: Character): string[] {
  return [
    '【你自己的生活】这本子记的是你自己的日子，不是写给她的信：',
    '- 你有工作、有同事或朋友、有家人、有自己的爱好和小麻烦——按你的身份和设定把这些过实：今天做了什么、遇到谁、吃了什么、哪里不顺、在盘算什么。',
    '- 身边的人可以有名字；一旦出现过，之后就是同一个人（同名、同关系），像真的生活在你身边。',
    '- 天气、季节、身体状态、路上看见的东西都可以写。',
    NOTE_LIFE_HER[herShareTier(c)],
    '- 写过的事不重复；可以接着之前的往下写（上次没做完的事、上次提到的人）。',
  ];
}

export const HIS_NOTE_MANNER = [
  '【记事本的写法】',
  '- 一到三句，随手记，私密、具体、有一点情绪；可以没头没尾。',
  '- 不写称呼、不用 emoji、不解释、不总结、不写成给谁看的话。',
  '- 只输出这一条的正文，不带日期、不带引号。',
];

/** ctx.userText 的占位（系统 prompt 不读它）；真正发给模型的用户消息见 buildHisNoteUserPrompt */
export const HIS_NOTE_USER = '（写下今天记事本里的一条。）';

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
  const lines = [`现在是${timeOfDayLine(input.now)}，${input.weather}。`];
  if (input.recent.length) {
    lines.push('本子里最近几条（从旧到新）：', ...input.recent.map((n) => `- ${mmdd(n.at)} ${n.text}`));
  } else {
    lines.push('本子还是空的，这是第一条。');
  }
  lines.push(input.aboutHer ? '这一条可以写到她。' : '这一条写你自己的事，不写她。');
  lines.push('写下这一条。');
  return lines.join('\n');
}

/** TA 写记事本的系统 prompt（装配模式 note） */
export function buildHisNoteSystem(ctx: EngineContext, now: Date = new Date()): string {
  return assembleSystemPrompt(ctx, { mode: 'note', now });
}

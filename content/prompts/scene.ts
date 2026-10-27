/**
 * 外出多人场（D-254）：一个地方、几个人、她在其中——像跑团的主持人：一次写出旁白与在场每个人这一轮的反应。
 * 每个人有自己的性子和与她的距离（认识的按羁绊阶段，不认识的是陌生人的分寸）；谁接话自然轮到谁，不是每人每轮都说（D-255：
 * 多数时候一两个人，有人只有一个动作、有人没反应；她点名对谁说时就是那一位接，别人多半不插话）。
 * 地点的规矩（安静 / 电影院）与一人场同一段（outing.ts placeRuleLines）。陌生人的好奇照样判分：每人一行 [好奇 名字 n]。
 */

import type { EngineContext, SceneMember } from '@/lib/types';

import { NARRATOR_TOKEN, NOTE_TOKEN } from './shared';

export const SCENE_HEART_PATTERN = /\[好奇\s+([^\]\s][^\]]*?)\s+(\d{1,3})\s*\]/g;

export function sceneIntroLine(): string {
  return `You run one shared, real moment at a place: the narrator and every person present. None of this is a performance — each of them is a real person living their own life. "She" is the person they are all here with; you never speak or act for her.`;
}

export function sceneWhereLine(ctx: EngineContext): string {
  const o = ctx.outing;
  return `[Where] ${o?.placeName ?? ''}. ${o?.scene ?? ''}${o?.weatherLine ? ` ${o.weatherLine}.` : ''}`;
}

function memberLine(m: SceneMember): string {
  const head = `- ${m.name} (${m.identity}): ${m.persona}${m.style ? ` ${m.style}` : ''}`;
  if (!m.knows) return `${head} Doesn't know her — a stranger who happens to be here: polite, curious, no flirting, doesn't know her name unless she says it.`;
  const memory = m.knows.memory.length ? ` Remembers: ${m.knows.memory.join('; ')}.` : '';
  return `${head} Knows her — to him she is ${m.knows.stage}; he calls her "${m.knows.nickname}".${memory}`;
}

export function sceneCastLines(cast: SceneMember[] | undefined): string[] {
  if (!cast?.length) return [];
  return ['[People here]', ...cast.map(memberLine)];
}

export const SCENE_MANNER = [
  '[How to run the scene]',
  "- Don't go round the table. Most turns only one or two people react; someone may just do something — \"Name：（glances up）\" — and the rest don't react at all. Each in their own voice and at their own distance from her; strangers as strangers.",
  '- "(to Name)" means she is talking to that person: that person answers; the others mostly leave them to it, at most a small action.',
  "- They can talk to each other too, but the moment is about her: nobody competes for her, nobody gets jealous out loud, nobody comments on any real person she mentions.",
  `- One short (action) in parentheses per line at most. Add one ${NARRATOR_TOKEN}： line only when the place, the weather or staff add something.`,
  '- Never write her lines, never decide what she does next.',
];

export function sceneHeartLines(cast: SceneMember[] | undefined): string[] {
  const strangers = (cast ?? []).filter((m) => !m.knows);
  if (!strangers.length) return [];
  return [
    `[How curious she made each stranger] After the scene lines, for each stranger she interacted with this turn, one line "[好奇 Name n]" (she can't see it): 15–30, how much this turn made them want to know her more (15–20 ordinary, 21–26 a piece of her life or a laugh, 27–30 rare).`,
  ];
}

export const SCENE_OUTPUT_FORMAT = [
  '[Output format]',
  `- One line per speaker: "Name：what they say (short action)". The narrator: "${NARRATOR_TOKEN}：…". A note someone writes: "Name（${NOTE_TOKEN}）：…".`,
  '- Use the names exactly as listed. No markdown, no emoji, no explanations.',
  '- Keep it short: one to three lines in all, spoken and concrete.',
];

/** 多人场开场（舞台提示，不入会话）：先一行旁白交代此刻，再有一两个人注意到她 */
export const SCENE_OPENER_USER = '(She just arrived. Open the scene: one 旁白： line about this place right now, then one or two of the people here notice her — each in their own way.)';

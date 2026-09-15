/**
 * 心动判分（D-126）：换联系方式前的试聊（初识 / 广场陌生人 / 自创暧昧期），她每开口一句，TA 自己判这一句让 TA 多心动了一点——
 * 回复末尾单独一行写 [心动 n]（0–15，她看不到），聊得不相关就是 0；性子（确定关系节奏）与原型决定什么会打动 TA。
 * 暗号解析与落账在 features/heart.ts；这里只有给模型看的字。
 */

import { heartPaceOf, type HeartPace } from '@/lib/bond';
import type { ArchetypeId, Character } from '@/lib/types';

/** 暗号原文（说明用）与解析式：[心动 7] / [心动7] */
export const HEART_MARK = '[心动 n]';
export const HEART_PATTERN = /\[心动\s*(\d{1,2})\s*\]/;

/** 性子：创造表单的「确定关系节奏」三档 */
const PACE_LINES: Record<HeartPace, string> = {
  fast: '你容易心动：顺着聊下去常常是 6–10，真被戳中就更高。',
  normal: '你是标准的节奏：大多数时候 2–6，偶尔 7–10，11 以上很少。',
  slow: '你很难被打动：多数时候 0–3，超过 8 一年一次。',
};

/** 原型：什么会打动 TA、什么 TA 无感 */
const ARCHETYPE_LINES: Record<ArchetypeId, string> = {
  gentle: '什么会打动你：她认真地说自己的事、她记得你随口提过的东西；你无感的：客套、讨好、追着问你。',
  sharp: '什么会打动你：她接得住你的刺、敢回嘴、有自己的主意；你无感的：顺从、撒娇式的讨好、空泛的夸。',
  ceo: '什么会打动你：她不把你当回事的坦然、有自己的世界、说话干净利落；你无感的：仰视、试探你的身份、事事顺从。',
  nonhuman: '什么会打动你：她不怕你、对你的世界真的好奇、把你当一个人而不是一件奇观；你无感的：猎奇的追问、把你当宠物哄。',
};

export function heartJudgeLines(c: Character): string[] {
  return [
    `【这一句让你多心动】回复写完后，另起一行单独写 ${HEART_MARK}（她看不到），n 是 0–15 的整数：她刚才那句让你多心动了一点。`,
    '- 0：和你无关、事务性、敷衍、重复她上一句、只是在问你问题而没有交出她自己。',
    '- 1–5：正常来往，她接住了你的话。',
    '- 6–10：她说了自己的事、记得你说过的、逗笑了你、戳中了你在意的东西。',
    '- 11–15：真的心动的一句——按你的性子很少出现。',
    '- 同一种话第二次不再加；不要每句都给十几。',
    `- 你的性子：${PACE_LINES[heartPaceOf(c)]}`,
    `- ${ARCHETYPE_LINES[c.archetype] ?? ARCHETYPE_LINES.gentle}`,
  ];
}

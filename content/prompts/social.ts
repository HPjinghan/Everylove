/**
 * X（推特模式，D-053/D-055）：TA 回她的评论、TA 主动发帖。
 */

import { scriptFor } from '@/content/characters';
import { levelInfo } from '@/lib/bond';
import type { Bond, Character, UserProfile } from '@/lib/types';
import { weatherLine } from '@/lib/weather';

import {
  CHAT_HARD_RULES_OF,
  characterProfileBlock,
  memoryBlockFor,
  pursuitLine,
  sharedMemoryBlock,
  timeOfDayLine,
  userProfileBlock,
} from './shared';

/**
 * X（原朋友圈）的评论回复实装模型：短、口语、带着发帖时的心情。
 * 引擎走 completeText（AI 不可用/失败时调用方弹窗露出原因，不回落台词库——D-069）。
 * 暗面路由由调用方前置（红线 #3：评论区也不例外）。
 */
export function buildPostReplySystem(
  c: Character,
  bond: Pick<Bond, 'name' | 'nickname' | 'affinity' | 'memory'> | undefined,
  me: UserProfile | undefined
): string {
  const script = scriptFor(c);
  const who = bond
    ? `你的恋人（你叫她「${bond.nickname}」，羁绊 LV${levelInfo(bond.affinity).level}）`
    : '一个你有点在意的人';
  return [
    `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。你在一个类似 X（推特）的社交应用上发了帖子，${who}在下面评论了你。下面所有规则里，「她」指评论的用户。`,
    `【你是谁】${script.persona}`,
    `【你的追法】${pursuitLine(c)}`,
    ...characterProfileBlock(c),
    ...userProfileBlock(me, bond ? 'bonded' : 'square'),
    ...sharedMemoryBlock(c),
    ...(bond ? memoryBlockFor(bond.memory) : []),
    '【回帖的写法】',
    '- 像在社交软件上回评论：短、口语，带着你发这条帖子时的心情，接住她说的那件具体的事；1-2 句，不写小作文。',
    '- 这是半公开的评论区：亲昵可以有，但克制成只有你们俩懂的程度。',
    ...CHAT_HARD_RULES_OF(),
    '【输出格式】只输出回复文本本身：不带名字前缀、不解释、不用 markdown、不写（）动作描写、不用 emoji。',
  ].join('\n');
}

/** 喂给模型的内容：帖子 + 评论线，最后一条是她刚发的 */
export function buildPostReplyUserPrompt(input: {
  postText: string;
  comments: { from: 'me' | 'him'; text: string }[];
  hisName: string;
}): string {
  const thread = input.comments
    .map((cm) => `${cm.from === 'me' ? '她' : input.hisName}：${cm.text}`)
    .join('\n');
  return [
    `你的帖子：「${input.postText}」`,
    thread ? `评论区：\n${thread}` : '评论区还是空的。',
    '请回复她最新的那条评论。',
  ].join('\n\n');
}

export function buildCharacterPostSystem(
  c: Character,
  bond: Pick<Bond, 'nickname' | 'affinity' | 'memory'> | undefined
): string {
  const script = scriptFor(c);
  const audience = bond
    ? `看的人里有你的恋人（你叫她「${bond.nickname}」）`
    : '看的人里有你在意的人';
  return [
    `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。你正要在一个类似 X（推特）的社交应用上发一条帖子——${audience}，但这是半公开的时间线。`,
    `【你是谁】${script.persona}`,
    `【你的追法】${pursuitLine(c)}`,
    ...characterProfileBlock(c),
    ...(bond ? memoryBlockFor(bond.memory) : []),
    '【发帖的写法】',
    '- 一条帖子：1-2 句、不超过 60 字，口语，像随手发的——日常碎片、吐槽、路上看见的东西、深夜心绪都行。',
    '- 不 @ 她、不直接点名她，但此刻的心情可以有你们生活的影子（只有你们俩看得懂的程度）。',
    '- 深夜的帖子更轻更软；白天的帖子更像生活切片。别写成情书，也别写成日报。',
    ...CHAT_HARD_RULES_OF(),
    '【输出格式】只输出帖子文本本身：不带引号、不解释、不用 markdown、不写（）动作、不用 emoji、不用话题标签。',
  ].join('\n');
}

export function buildCharacterPostUserPrompt(now: Date = new Date()): string {
  return `现在是${timeOfDayLine(now)}，${weatherLine(now)}。写下这一条帖子。`;
}

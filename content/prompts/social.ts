/**
 * X（推特模式，D-053/D-055）：TA 回她的评论、TA 主动发帖。
 * 发帖是 TA 自己的时间线（D-099）：她的影子出现多少按「她在 TA 心里的分量」（lib/her-share.ts）——恋爱脑常有、冷静的人偶尔；
 * 每条发之前按分量掷硬币决定「这一条有没有她」，连同最近发过的帖与记事本里的日子一起走用户消息（buildCharacterPostUserPrompt）。
 */

import { scriptFor } from '@/content/characters';
import { levelInfo } from '@/lib/bond';
import { herShareTier, type HerShareTier } from '@/lib/her-share';
import type { Bond, Character, UserProfile } from '@/lib/types';
import { weatherLine } from '@/lib/weather';

import { circleBlock } from './circle';
import {
  CHAT_HARD_RULES_OF,
  characterProfileBlock,
  langName,
  memoryBlockFor,
  pursuitLine,
  sharedMemoryBlock,
  timeOfDayLine,
  userProfileBlock,
} from './shared';
import { worldBlock } from './world';

/**
 * X（原朋友圈）的评论回复实装模型：短、口语、带着发帖时的心情。
 * 引擎走 completeText（AI 不可用/失败时调用方弹窗露出原因，不回落台词库——D-069）。
 * 暗面路由由调用方前置（红线 #3：评论区也不例外）。
 */
export function buildPostReplySystem(
  c: Character,
  bond: Pick<Bond, 'name' | 'nickname' | 'affinity' | 'memory' | 'circle'> | undefined,
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
    ...worldBlock(c),
    ...circleBlock(bond?.circle),
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
  /** 评论线：她 / TA / 别人（TA 身边的人或其他 TA，带名字，D-110） */
  comments: { from: 'me' | 'him' | 'other'; text: string; name?: string }[];
  hisName: string;
}): string {
  const thread = input.comments
    .map((cm) => `${cm.from === 'me' ? '她' : cm.from === 'other' ? (cm.name ?? '别人') : input.hisName}：${cm.text}`)
    .join('\n');
  return [
    `你的帖子：「${input.postText}」`,
    thread ? `评论区：\n${thread}` : '评论区还是空的。',
    '请回复她最新的那条评论。',
  ].join('\n\n');
}

export function buildCharacterPostSystem(
  c: Character,
  bond: Pick<Bond, 'nickname' | 'affinity' | 'memory' | 'circle'> | undefined
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
    ...worldBlock(c),
    ...circleBlock(bond?.circle),
    ...(bond ? memoryBlockFor(bond.memory) : []),
    '【发帖的写法】',
    '- 一条帖子：1-2 句、不超过 60 字，口语，像随手发的——日常碎片、吐槽、路上看见的东西、深夜心绪都行。',
    '- 这是你自己的时间线：你有工作、朋友、爱好和小麻烦，按你的身份和设定发真实的日子；提到过的人和事前后一致。',
    POST_HER[herShareTier(c)],
    '- 深夜的帖子更轻更软；白天的帖子更像生活切片。别写成情书，也别写成日报。',
    ...CHAT_HARD_RULES_OF(),
    '【输出格式】只输出帖子文本本身：不带引号、不解释、不用 markdown、不写（）动作、不用 emoji、不用话题标签。',
  ].join('\n');
}

/** 时间线里她的影子出现多少，按分量三档（D-099） */
const POST_HER: Record<HerShareTier, string> = {
  devoted: '- 不 @ 她、不直接点名她，但你的帖子里常有她的影子（只有你们俩看得懂的程度）；也发发和她无关的日常，别成了只有她的号。',
  balanced: '- 不 @ 她、不直接点名她，但此刻的心情可以有你们生活的影子（只有你们俩看得懂的程度）。',
  independent: '- 大多数帖子和她无关；偶尔有一点她的影子也不 @ 她、不点名（只有你们俩看得懂的程度）。',
};

export interface CharacterPostUserInput {
  /** 这一条有没有她的影子（lib/her-share.ts 按分量掷硬币）；不传不提 */
  aboutHer?: boolean;
  /** 最近发过的几条（从旧到新），别重复 */
  recentPosts?: string[];
  /** 记事本里最近的日子（从旧到新），时间线和本子是同一个人的生活 */
  recentNotes?: string[];
}

/** 发给模型的用户消息：此刻与天气 + 最近发过的 + 本子里的日子 + 这一条有没有她 */
export function buildCharacterPostUserPrompt(now: Date = new Date(), input: CharacterPostUserInput = {}): string {
  const lines = [`现在是${timeOfDayLine(now)}，${weatherLine(now)}。`];
  if (input.recentPosts?.length) lines.push('你最近发过的（从旧到新，别重复）：', ...input.recentPosts.map((t) => `- ${t}`));
  if (input.recentNotes?.length) lines.push('你最近的日子（记事本里写过的，可以接着发）：', ...input.recentNotes.map((t) => `- ${t}`));
  if (input.aboutHer !== undefined) lines.push(input.aboutHer ? '这一条可以有她的影子。' : '这一条和她无关，发你自己的。');
  lines.push('写下这一条帖子。');
  return lines.join('\n');
}

/* ── 别人的互动（D-110）：TA 身边的人与其他缔结的 TA 来评论，TA 可以回一句 ── */

export interface ReactionAuthor {
  /** 名字（模型按它署名） */
  name: string;
  /** 这人是谁：和 TA 的关系，或另一位 TA 的一句身份 */
  who: string;
}

export function buildPostReactionsSystem(c: Character, authors: ReactionAuthor[]): string {
  return [
    `一个类似 X（推特）的社交应用上，虚构角色「${c.name}」（${c.identity}）发了一条帖子。请写下面这些人在评论区的反应——他们都是这个世界里的人，认识 ${c.name}：`,
    ...authors.map((a) => `- ${a.name}：${a.who}`),
    ...worldBlock(c),
    '【写法】',
    '- 挑其中 1–3 个人各评论一句：短、口语、像熟人随手回的（调侃、关心、接梗、约饭、吐槽都行），每人的口气要配得上他和发帖人的关系。',
    `- ${c.name} 可以回其中一条（一句，按 ${c.name} 的性格），也可以不回。`,
    '- 不提发帖人的恋人，不写任何真实存在的人，不用 emoji、不用话题标签。',
    `- 全部用${langName()}写。`,
    '【输出格式】只输出一个 JSON 对象，不加解释、不用 markdown：',
    '{"comments":[{"by":"名单里的名字","text":"…"}],"reply":"发帖人回的一句，没有就留空字符串"}',
  ].join('\n');
}

export function buildPostReactionsUserPrompt(input: { postText: string; existing: { name: string; text: string }[] }): string {
  const lines = [`帖子：「${input.postText}」`];
  if (input.existing.length) lines.push('评论区已有：', ...input.existing.map((c) => `${c.name}：${c.text}`));
  lines.push('写下评论区的反应。');
  return lines.join('\n');
}

export function parseReactionsJSON(raw: string): { comments: { by: string; text: string }[]; reply?: string } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { comments?: unknown; reply?: unknown };
    const comments = (Array.isArray(obj.comments) ? obj.comments : [])
      .map((x) => x as { by?: unknown; text?: unknown })
      .filter((x) => typeof x.by === 'string' && typeof x.text === 'string' && String(x.text).trim())
      .map((x) => ({ by: String(x.by).trim(), text: String(x.text).trim().slice(0, 120) }));
    const reply = typeof obj.reply === 'string' && obj.reply.trim() ? obj.reply.trim().slice(0, 120) : undefined;
    return { comments, reply };
  } catch {
    return null;
  }
}

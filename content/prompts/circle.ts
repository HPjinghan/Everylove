/**
 * TA 身边的人（D-110）：朋友 / 家人 / 同事——TA 的世界里除了她还有别人。
 * 第一次查 TA 的手机时由模型按人设写一次（通讯录 + 和其中几个人的近期聊天），之后固定：
 * 进记事本 / 发帖 / 亲密聊天的 prompt（【你身边的人】，提到时前后一致），X 里也会由他们来互动。
 * 写不成回落各语言的通用圈子（lib/circle.ts）。
 */

import { scriptFor } from '@/content/characters';
import type { HerShareTier } from '@/lib/her-share';
import type { Bond, Character, CircleLine, CirclePerson } from '@/lib/types';

import { characterProfileBlock, langName, timeOfDayLine } from './shared';
import { worldBlock } from './world';

/** 身边的人的数量范围与聊天条数 */
export const CIRCLE_MIN = 4;
export const CIRCLE_MAX = 6;
export const CIRCLE_CHATS = 3;
export const CIRCLE_CHAT_LINES = 4;
/** 续写（D-124）：一次 1–3 段、每段最多 6 句；每人最多留 40 句（旧的滚掉） */
export const CIRCLE_REFRESH_MAX = 3;
export const CIRCLE_REFRESH_LINES_MAX = 6;
export const CIRCLE_HISTORY_MAX = 40;

export function buildCircleSystem(c: Character, bond: Pick<Bond, 'nickname'> | undefined): string {
  const script = scriptFor(c);
  return [
    `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。现在要把你身边的人写出来——你的世界里除了恋人${bond ? `（你叫她「${bond.nickname}」）` : ''}还有别人：家人、朋友、同事、邻居……`,
    `【你是谁】${script.persona}`,
    ...characterProfileBlock(c),
    ...worldBlock(c),
    '【要写的东西】',
    `- ${CIRCLE_MIN}–${CIRCLE_MAX} 个身边的人：每人一个名字（按你的身份与世界起名，不用真实名人）、和你的关系（妈妈 / 发小 / 同事 / 室友 / 邻居……）、一句话（你眼里这个人是什么样）。关系要有远近：至少一个家人、一个多年的朋友、一个工作或日常里常见的人。`,
    `- 其中 ${CIRCLE_CHATS} 个人和你最近的聊天：每段 ${CIRCLE_CHAT_LINES} 句左右，你和对方交替，口语、日常（约饭、催你、吐槽、分享、家里的事），像真的手机聊天记录；不写她的事，最多一句旁敲侧击。`,
    '- 不要把她写进名单，也不要写任何真实存在的人。',
    `- 全部用${langName()}写。`,
    '【输出格式】只输出一个 JSON 对象，不加解释、不用 markdown：',
    '{"people":[{"name":"…","relation":"…","note":"…"}],"chats":[{"name":"名单里的名字","lines":[{"from":"me","text":"…"},{"from":"them","text":"…"}]}]}',
    '（from 只能是 me（你）或 them（对方））',
  ].join('\n');
}

export function buildCircleUserPrompt(input: { recentNotes?: string[]; recentPosts?: string[] }): string {
  const lines: string[] = [];
  if (input.recentNotes?.length) lines.push('你记事本里最近写过的（里面提到过的人要出现在名单里，同名同关系）：', ...input.recentNotes.map((n) => `- ${n}`));
  if (input.recentPosts?.length) lines.push('你最近发过的帖子：', ...input.recentPosts.map((n) => `- ${n}`));
  lines.push('写出你身边的人和最近的聊天。');
  return lines.join('\n');
}

export type ParsedCircleChat = { name: string; lines: { from: 'me' | 'them'; text: string }[] };

function chatsFrom(raw: unknown): ParsedCircleChat[] {
  return (Array.isArray(raw) ? raw : [])
    .map((c) => c as { name?: unknown; lines?: unknown })
    .filter((c) => typeof c.name === 'string' && Array.isArray(c.lines))
    .map((c) => ({
      name: String(c.name).trim(),
      lines: (c.lines as unknown[])
        .map((l) => l as { from?: unknown; text?: unknown })
        .filter((l) => (l.from === 'me' || l.from === 'them') && typeof l.text === 'string' && String(l.text).trim())
        .map((l) => ({ from: l.from as 'me' | 'them', text: String(l.text).trim().slice(0, 120) })),
    }))
    .filter((c) => c.lines.length);
}

function jsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 解析续写输出（D-124）：只有 chats；结构不对返回 null */
export function parseCircleChatsJSON(raw: string): ParsedCircleChat[] | null {
  const obj = jsonObject(raw);
  if (!obj) return null;
  const chats = chatsFrom(obj.chats);
  return chats.length ? chats : null;
}

/** 解析模型输出；结构不对返回 null */
export function parseCircleJSON(
  raw: string
): { people: { name: string; relation: string; note?: string }[]; chats: ParsedCircleChat[] } | null {
  const obj = jsonObject(raw);
  if (!obj) return null;
  try {
    if (!Array.isArray(obj.people)) return null;
    const people = obj.people
      .map((p) => p as { name?: unknown; relation?: unknown; note?: unknown })
      .filter((p) => typeof p.name === 'string' && typeof p.relation === 'string')
      .map((p) => ({
        name: String(p.name).trim().slice(0, 16),
        relation: String(p.relation).trim().slice(0, 12),
        note: typeof p.note === 'string' ? p.note.trim().slice(0, 80) : undefined,
      }))
      .filter((p) => p.name && p.relation);
    if (!people.length) return null;
    return { people, chats: chatsFrom(obj.chats) };
  } catch {
    return null;
  }
}

/* ── 续写（D-124）：TA 和身边的人的聊天随日子往前走 ── */

export interface CircleRefreshInput {
  now: Date;
  /** 今天的天气一句话 */
  weather: string;
  /** 上一段聊天距今几小时；null = 还没聊过 */
  hoursSinceLast: number | null;
  /** TA 记事本里最近几条（从旧到新） */
  recentNotes: string[];
  /** TA 最近发过的帖（从旧到新） */
  recentPosts: string[];
  /** TA 日历里接下来的安排（「09-13 19:00 和阿哲打球」） */
  upcoming: string[];
  /** 每个人最近的两三句（续着说、别断） */
  tails: { name: string; relation: string; lines: CircleLine[] }[];
  hisName: string;
  /** 她在 TA 心里的分量（lib/her-share.ts）：决定和朋友聊天时提不提她 */
  herTier: HerShareTier;
}

/** 续写的系统 prompt：人设 + 世界 + 名单，只输出 chats */
export function buildCircleRefreshSystem(c: Character, bond: Pick<Bond, 'nickname' | 'circle'>): string {
  const script = scriptFor(c);
  return [
    `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。现在要把你这段时间和身边的人新聊的几句写出来——你的日子在往前走，手机里的对话也在往前走。你的恋人叫「${bond.nickname}」。`,
    `【你是谁】${script.persona}`,
    ...characterProfileBlock(c),
    ...worldBlock(c),
    ...circleBlock(bond.circle),
    '【要写的东西】',
    `- 从名单里挑 1–${CIRCLE_REFRESH_MAX} 个人，写你们这段时间新聊的：每段 2–${CIRCLE_REFRESH_LINES_MAX} 句，你和对方交替，口语、具体、像真的手机聊天（约饭、催你、吐槽、分享、家里的事、工作上的小麻烦）。`,
    '- 接着各自上次聊到的往下说，或者开个新话头；不重复已经说过的句子；不是每个人每天都聊，谁常联系谁少联系按关系远近来。',
    '- 名字只能用名单里的，不写任何真实存在的人。',
    `- 全部用${langName()}写。`,
    '【输出格式】只输出一个 JSON 对象，不加解释、不用 markdown：',
    '{"chats":[{"name":"名单里的名字","lines":[{"from":"me","text":"…"},{"from":"them","text":"…"}]}]}',
    '（from 只能是 me（你）或 them（对方））',
  ].join('\n');
}

/** 续写的舞台提示（user 文本）：此刻、隔了多久、TA 最近的日子、每个人上次聊到哪 */
export function buildCircleRefreshUser(input: CircleRefreshInput): string {
  const since =
    input.hoursSinceLast === null
      ? '手机里还没有和他们的聊天。'
      : input.hoursSinceLast < 24
        ? `上一段聊天是 ${Math.max(1, Math.round(input.hoursSinceLast))} 小时前。`
        : `上一段聊天是 ${Math.round(input.hoursSinceLast / 24)} 天前。`;
  const lines = [`现在是${timeOfDayLine(input.now)}，${input.weather}。${since}`];
  if (input.recentNotes.length) lines.push('你最近的日子（记事本里写过的）：', ...input.recentNotes.map((n) => `- ${n}`));
  if (input.recentPosts.length) lines.push('你最近发过的帖：', ...input.recentPosts.map((p) => `- ${p}`));
  if (input.upcoming.length) lines.push('你接下来的安排：', ...input.upcoming.map((e) => `- ${e}`));
  if (input.tails.length) {
    lines.push('每个人上次聊到哪（接着说）：');
    for (const tl of input.tails) {
      lines.push(`- ${tl.name}（${tl.relation}）：${tl.lines.map((l) => `${l.from === 'him' ? input.hisName : tl.name}「${l.text.slice(0, 40)}」`).join(' / ')}`);
    }
  }
  lines.push(
    input.herTier === 'devoted'
      ? '关于她：你满脑子都是她，和亲近的人聊天时可以自然带到一两句（不用名字，说「她」就行），但别每段都是她。'
      : input.herTier === 'independent'
        ? '关于她：你的日子是你的日子，这几段聊天不提她。'
        : '关于她：最多在一段里旁敲侧击一句，其余不提。',
    '写出你们这段时间新聊的几句。'
  );
  return lines.join('\n');
}

/** 【你身边的人】：进记事本 / 发帖 / 亲密聊天——一旦生成，提到时前后一致 */
export function circleBlock(circle: CirclePerson[] | undefined): string[] {
  if (!circle?.length) return [];
  return [
    '【你身边的人】这些人真的在你生活里，提到时前后一致（同名、同关系），不凭空多出别的家人朋友：',
    ...circle.map((p) => `- ${p.name}（${p.relation}）${p.note ? `：${p.note}` : ''}`),
  ];
}

/** 一段和身边人的聊天进上下文时的排版 */
export function circleChatTranscript(hisName: string, person: CirclePerson, lines: CircleLine[]): string {
  return lines.map((l) => `${l.from === 'him' ? hisName : person.name}：${l.text}`).join('\n');
}

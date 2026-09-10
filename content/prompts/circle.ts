/**
 * TA 身边的人（D-110）：朋友 / 家人 / 同事——TA 的世界里除了她还有别人。
 * 第一次查 TA 的手机时由模型按人设写一次（通讯录 + 和其中几个人的近期聊天），之后固定：
 * 进记事本 / 发帖 / 亲密聊天的 prompt（【你身边的人】，提到时前后一致），X 里也会由他们来互动。
 * 写不成回落各语言的通用圈子（lib/circle.ts）。
 */

import { scriptFor } from '@/content/characters';
import type { Bond, Character, CircleLine, CirclePerson } from '@/lib/types';

import { characterProfileBlock, langName } from './shared';
import { worldBlock } from './world';

/** 身边的人的数量范围与聊天条数 */
export const CIRCLE_MIN = 4;
export const CIRCLE_MAX = 6;
export const CIRCLE_CHATS = 3;
export const CIRCLE_CHAT_LINES = 4;

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

/** 解析模型输出；结构不对返回 null */
export function parseCircleJSON(
  raw: string
): { people: { name: string; relation: string; note?: string }[]; chats: { name: string; lines: { from: 'me' | 'them'; text: string }[] }[] } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { people?: unknown; chats?: unknown };
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
    const chats = (Array.isArray(obj.chats) ? obj.chats : [])
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
    return { people, chats };
  } catch {
    return null;
  }
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

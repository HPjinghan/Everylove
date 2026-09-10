/**
 * TA 自己的作息（D-119）：TA 的日历里有 TA 自己的安排——上班、和朋友的约、家里的事、爱好——不是和她的约定。
 * 生成：按人设 + 世界 + 身边的人 + 记事本里最近的日子，写接下来一周的 3–6 条（JSON）；她查手机时在 TA 的日历里看到。
 * 注入：【你的日程】进羁绊层所有用途（聊天 / 通话 / 记事本 / 外出熟人），TA 说话时知道自己今天明天要干嘛，主动消息也从这里说起。
 */

import { scriptFor } from '@/content/characters';
import type { Bond, Character, HisEvent } from '@/lib/types';

import { circleBlock } from './circle';
import { characterProfileBlock, langName } from './shared';
import { worldBlock } from './world';

export const HIS_SCHEDULE_DAYS = 7;
export const HIS_SCHEDULE_MIN = 3;
export const HIS_SCHEDULE_MAX = 6;

export function buildHisScheduleSystem(c: Character, bond: Pick<Bond, 'nickname' | 'circle'> | undefined): string {
  const script = scriptFor(c);
  return [
    `你在扮演恋爱互动应用里的虚构角色「${c.name}」（${c.identity}）。现在要写你自己接下来一周的日程——你的日历，不是和恋人${bond ? `（你叫她「${bond.nickname}」）` : ''}的约定。`,
    `【你是谁】${script.persona}`,
    ...characterProfileBlock(c),
    ...worldBlock(c),
    ...circleBlock(bond?.circle),
    '【要写的东西】',
    `- 接下来 ${HIS_SCHEDULE_DAYS} 天里 ${HIS_SCHEDULE_MIN}–${HIS_SCHEDULE_MAX} 条安排：上班 / 值班 / 出差、和朋友家人的约、看医生、健身、爱好、要办的杂事……按你的身份和作息过实，像真人的日历：有的带钟点、有的只写在某一天。`,
    '- 涉及的人只用【你身边的人】里的（没有这段就自己起名，之后会固定下来）；不写她、不写任何真实存在的人。',
    '- 别每天都有事；空着的日子就是空着。',
    `- 全部用${langName()}写。`,
    '【输出格式】只输出一个 JSON 对象，不加解释、不用 markdown：',
    '{"events":[{"date":"YYYY-MM-DD","time":"HH:mm 或空字符串","title":"一句话"}]}',
  ].join('\n');
}

export function buildHisScheduleUserPrompt(input: { today: string; recentNotes: string[]; existing: HisEvent[] }): string {
  const lines = [`今天是 ${input.today}。`];
  if (input.existing.length) lines.push('日历里已经有的（别重复、别冲突）：', ...input.existing.map((e) => `- ${e.date}${e.time ? ` ${e.time}` : ''} ${e.title}`));
  if (input.recentNotes.length) lines.push('你记事本里最近写过的（接得上）：', ...input.recentNotes.map((n) => `- ${n}`));
  lines.push('写下接下来一周的安排。');
  return lines.join('\n');
}

export function parseHisScheduleJSON(raw: string): { date: string; time?: string; title: string }[] | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { events?: unknown };
    if (!Array.isArray(obj.events)) return null;
    return obj.events
      .map((e) => e as { date?: unknown; time?: unknown; title?: unknown })
      .filter((e) => typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === 'string' && String(e.title).trim())
      .map((e) => ({
        date: e.date as string,
        time: typeof e.time === 'string' && /^\d{1,2}:\d{2}$/.test(e.time) ? e.time.padStart(5, '0') : undefined,
        title: String(e.title).trim().slice(0, 40),
      }));
  } catch {
    return null;
  }
}

/** 【你的日程】：今天起最近几条，TA 说话时知道自己要干嘛 */
export function hisScheduleBlock(events: HisEvent[] | undefined, today: string, max = 5): string[] {
  const list = (events ?? []).filter((e) => e.date >= today).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`)).slice(0, max);
  if (!list.length) return [];
  const label = (d: string) => {
    const diff = Math.round((Date.parse(d) - Date.parse(today)) / 86400_000);
    return diff === 0 ? '今天' : diff === 1 ? '明天' : diff === 2 ? '后天' : d.slice(5);
  };
  return ['【你的日程】你自己接下来的安排（说话时记得，别和它冲突；提到时前后一致）：', ...list.map((e) => `- ${label(e.date)}${e.time ? ` ${e.time}` : ''}：${e.title}`)];
}

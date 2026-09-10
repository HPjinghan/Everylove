/**
 * TA 主动找她（D-114）：不是回她，是 TA 自己想到她了、先开口。
 * 系统 prompt 就是亲密模式那一套（人设 / 追法 / 关于她 / 记忆 / 身边的人 / 世界 / 阶段感 / 主动强度）；
 * 这里只写本轮的舞台提示（user 文本，不入会话）：此刻、天气、她多久没说话、TA 自己最近的日子（记事本 / 帖子）、上一条是谁说的。
 * 调度与守门在 lib/reach-out.ts。
 */

import { timeOfDayLine } from './shared';

export interface ReachOutInput {
  now: Date;
  /** 今天的天气一句话 */
  weather: string;
  /** 她上次说话距今几小时；null = 还没聊过 */
  hoursSinceHer: number | null;
  /** TA 记事本里最近几条（从旧到新） */
  recentNotes: string[];
  /** TA 最近发过的帖（从旧到新） */
  recentPosts: string[];
  /** 会话里最后一条是谁说的、说了什么（别接不上，也别重复） */
  last?: { from: 'me' | 'him'; text: string };
}

export function buildReachOutUserLine(input: ReachOutInput): string {
  const since =
    input.hoursSinceHer === null
      ? '你们还没怎么聊过。'
      : input.hoursSinceHer < 1
        ? '她刚刚还在。'
        : input.hoursSinceHer < 24
          ? `她上次说话是 ${Math.round(input.hoursSinceHer)} 小时前。`
          : `她上次说话是 ${Math.round(input.hoursSinceHer / 24)} 天前。`;
  const lines = [
    `（你想到她了，主动给她发一条消息——不是在回她。现在是${timeOfDayLine(input.now)}，${input.weather}。${since}`,
  ];
  if (input.last) lines.push(`会话里最后一条是${input.last.from === 'me' ? '她' : '你'}说的：「${input.last.text.slice(0, 60)}」。`);
  if (input.recentNotes.length) lines.push('你最近的日子（记事本里写过的）：', ...input.recentNotes.map((n) => `- ${n}`));
  if (input.recentPosts.length) lines.push('你最近发过的帖：', ...input.recentPosts.map((p) => `- ${p}`));
  lines.push(
    '写法：从你自己此刻正在做的事、刚看见的东西、忽然想起的事说起，也可以接着上次聊到的往下说；1-2 句，像随手发的。',
    '不问「在吗」，不催她回、不问她为什么不说话、不提你等了多久；不重复你上一条说过的。）'
  );
  return lines.join('\n');
}

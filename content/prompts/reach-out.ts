/**
 * TA 主动找她（D-114）：不是回她，是 TA 自己想到她了、先开口。
 * 系统 prompt 就是亲密模式那一套（人设 / 追法 / 关于她 / 记忆 / 身边的人 / 世界 / 阶段感 / 主动强度）；
 * 这里只写本轮的舞台提示（user 文本，不入会话）：此刻、天气、她多久没说话、上一条是谁说的、最近几条主动消息别重样。
 * TA 自己最近的日子（记事本 / 帖子）已在系统 prompt 的【你最近的日子】里（D-158），这里不再重复。
 * 调度与守门在 lib/reach-out.ts。
 */

import { timeOfDayLine } from './shared';

export interface ReachOutInput {
  now: Date;
  /** 今天的天气一句话 */
  weather: string;
  /** 她上次说话距今几小时；null = 还没聊过 */
  hoursSinceHer: number | null;
  /** TA 最近几条主动消息（从旧到新，D-153）：话题与开头别重样 */
  recentOpeners?: string[];
  /** 会话里最后一条是谁说的、说了什么（别接不上，也别重复） */
  last?: { from: 'me' | 'him'; text: string };
}

export function buildReachOutUserLine(input: ReachOutInput): string {
  const since =
    input.hoursSinceHer === null
      ? '你们还没怎么聊过。'
      : input.hoursSinceHer < 1
        ? 'She was here just now.'
        : input.hoursSinceHer < 24
          ? `She last spoke ${Math.round(input.hoursSinceHer)} hours ago.`
          : `She last spoke ${Math.round(input.hoursSinceHer / 24)} days ago.`;
  const lines = [
    `(You thought of her and are sending her a message on your own — this is not a reply. It's ${timeOfDayLine(input.now)}, ${input.weather}. ${since}`,
  ];
  if (input.last) lines.push(`The last message in the chat was ${input.last.from === 'me' ? 'hers' : 'yours'}: "${input.last.text.slice(0, 60)}".`);
  if (input.recentOpeners?.length)
    lines.push("Your last few unprompted messages — don't open the same way or on the same kind of topic:", ...input.recentOpeners.map((o) => `- ${o.slice(0, 60)}`));
  lines.push(
    "How: start from what you're doing right now, something from your recent days, something you just saw, or something that suddenly came to mind; you can also pick up where you last left off. 1–2 sentences, like something dashed off.",
    "Don't ask \"you there?\", don't push her to reply, don't ask why she's gone quiet, don't mention how long you waited; don't repeat what you said last time.)"
  );
  return lines.join('\n');
}

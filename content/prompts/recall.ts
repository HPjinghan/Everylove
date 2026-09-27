/**
 * 推送召回（D-126）：温度到 0 之后第 7 / 14 / 30 天各一条通知，之后不再发。
 * 系统 prompt 就是亲密模式那一套；这里只写本轮的舞台提示（user 文本，不入会话）：她离开多久了、TA 自己最近的日子。
 * 不提「你多久没来」、不催、不愧疚（红线 6）；她点开 App 那一刻这一条才落进会话。调度在 lib/recall.ts。
 */

import { UNPROMPTED_RULE } from './shared';

export interface RecallInput {
  /** 到那天她大约离开了几天 */
  daysAway: number;
  /** 第几条（1 / 2 / 3） */
  nth: number;
  /** TA 记事本里最近几条（从旧到新） */
  recentNotes: string[];
  /** TA 最近发过的帖（从旧到新） */
  recentPosts: string[];
}

export function buildRecallUserLine(input: RecallInput): string {
  const lines = [
    `(She hasn't been around for about ${input.daysAway} days. You suddenly thought of her and are sending her a message — not a reply, and you don't know when she'll see it.`,
  ];
  if (input.recentNotes.length) lines.push('Your recent days (from your notebook):', ...input.recentNotes.map((n) => `- ${n}`));
  if (input.recentPosts.length) lines.push('Your recent posts:', ...input.recentPosts.map((p) => `- ${p}`));
  lines.push(
    input.nth === 1
      ? 'How: start from one small thing in your own last few days, like something dashed off; one sentence is enough.'
      : input.nth === 2
        ? 'How: mention one concrete thing that reminded you of her (a place, a food, a line); one sentence, dashed off.'
        : "How: no lead-in — one line you genuinely want to say to her right now; one sentence, neither heavy nor light.",
    `${UNPROMPTED_RULE} Don't ask where she went; no sulking, no blaming her in a coaxing way.)`
  );
  return lines.join('\n');
}

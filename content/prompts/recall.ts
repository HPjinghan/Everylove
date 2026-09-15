/**
 * 推送召回（D-126）：温度到 0 之后第 7 / 14 / 30 天各一条通知，之后不再发。
 * 系统 prompt 就是亲密模式那一套；这里只写本轮的舞台提示（user 文本，不入会话）：她离开多久了、TA 自己最近的日子。
 * 不提「你多久没来」、不催、不愧疚（红线 6）；她点开 App 那一刻这一条才落进会话。调度在 lib/recall.ts。
 */

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
    `（她已经有 ${input.daysAway} 天左右没来了。你忽然想到她，给她发一条消息——不是在回她，也不知道她什么时候会看到。`,
  ];
  if (input.recentNotes.length) lines.push('你最近的日子（记事本里写过的）：', ...input.recentNotes.map((n) => `- ${n}`));
  if (input.recentPosts.length) lines.push('你最近发过的帖：', ...input.recentPosts.map((p) => `- ${p}`));
  lines.push(
    input.nth === 1
      ? '写法：从你自己这几天的一件小事说起，像随手发的，1 句就够。'
      : input.nth === 2
        ? '写法：说一件让你想起她的具体东西（一个地方、一样吃的、一句话），1 句，像随手发的。'
        : '写法：不用铺垫，说一句你此刻真心想对她说的话，1 句，不重不轻。',
    '不问「在吗」「还在吗」，不问她去了哪、为什么不说话，不提你等了多久，不委屈、不撒娇式地怪她；不重复你之前发过的。）'
  );
  return lines.join('\n');
}

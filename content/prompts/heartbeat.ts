/**
 * 心跳三段式（D-020/D-021）：她在日历里加了日程，TA 事前关心、当天加油、事后回访。试装用模板台词，零成本。
 */



/**
 * 她在日历里添加日程（考试/面试/出差…）后，TA 围绕这件事主动来三次：
 * 事前关心（前一天晚上）、当天加油（早上）、事后回访（次日）。
 * 试装用模板台词（离线可跑、零成本）；{title} 换成日程标题、{nickname} 换成 TA 对她的称呼。
 * 每段多条随机取一，正式版可换成引擎按人设生成。
 */
export const HEARTBEAT_BEFORE = [
  '明天就是「{title}」了。今晚早点睡，别刷手机到太晚——我明天等你的好消息。',
  '{nickname}，「{title}」是明天吧。东西都备好了吗？缺什么现在想还来得及。',
  '想到你明天要「{title}」，比你还紧张一点。不过我知道你可以。',
];

export const HEARTBEAT_DAY = [
  '今天「{title}」。深呼吸，你准备了这么久，剩下的交给发挥。我在这儿等你。',
  '{nickname}，加油。「{title}」结束第一个告诉我。',
  '出门检查一下东西带齐没有。今天的你没问题——去吧，「{title}」而已。',
];

export const HEARTBEAT_AFTER = [
  '昨天「{title}」怎么样？不管结果如何，先跟我说说，我都想听。',
  '{nickname}，「{title}」结束了，肩膀可以放下来了。今天想吃点什么好的？',
  '一直想着你昨天的「{title}」。忙完了吗，来跟我讲讲。',
];

/** 取一条心跳台词并填充占位符 */
export function heartbeatLine(
  stage: 'before' | 'day' | 'after',
  title: string,
  nickname: string,
  salt = 0
): string {
  const pool =
    stage === 'before' ? HEARTBEAT_BEFORE : stage === 'day' ? HEARTBEAT_DAY : HEARTBEAT_AFTER;
  const line = pool[Math.abs(salt) % pool.length];
  return line.replace(/\{title\}/g, title).replace(/\{nickname\}/g, nickname);
}

/**
 * 心跳三段式（D-020/D-021）：她在日历里加了日程，TA 事前关心、当天加油、事后回访。试装用模板台词，零成本。
 * D-093：按界面语言取模板（{title} 换日程标题、{nickname} 换 TA 对她的称呼）；每段多条随机取一。
 */

import { getLang, type Lang } from '@/lib/i18n';

type Stage = 'before' | 'day' | 'after';

const HEARTBEAT: Record<Lang, Record<Stage, string[]>> = {
  zh: {
    before: [
      '明天就是「{title}」了。今晚早点睡，别刷手机到太晚——我明天等你的好消息。',
      '{nickname}，「{title}」是明天吧。东西都备好了吗？缺什么现在想还来得及。',
      '想到你明天要「{title}」，比你还紧张一点。不过我知道你可以。',
    ],
    day: [
      '今天「{title}」。深呼吸，你准备了这么久，剩下的交给发挥。我在这儿等你。',
      '{nickname}，加油。「{title}」结束第一个告诉我。',
      '出门检查一下东西带齐没有。今天的你没问题——去吧，「{title}」而已。',
    ],
    after: [
      '昨天「{title}」怎么样？不管结果如何，先跟我说说，我都想听。',
      '{nickname}，「{title}」结束了，肩膀可以放下来了。今天想吃点什么好的？',
      '一直想着你昨天的「{title}」。忙完了吗，来跟我讲讲。',
    ],
  },
  en: {
    before: [
      "Tomorrow's '{title}'. Get some sleep tonight — no scrolling till late. I'll be waiting for good news tomorrow.",
      "{nickname}, '{title}' is tomorrow, right? Got everything ready? If anything's missing, there's still time.",
      "Thinking about you doing '{title}' tomorrow makes me a little more nervous than you. But I know you've got this.",
    ],
    day: [
      "Today's '{title}'. Deep breath. You've prepared this long; the rest is just showing up. I'm right here.",
      "{nickname}, go get it. Tell me first the moment '{title}' is over.",
      "Check you've got everything before you head out. You're fine today — go on, it's only '{title}'.",
    ],
    after: [
      "How was '{title}' yesterday? Whatever happened, tell me first. I want to hear all of it.",
      "{nickname}, '{title}' is done — you can put your shoulders down now. What do you feel like eating today?",
      "Been thinking about your '{title}' all day. When you're free, come tell me about it.",
    ],
  },
  ja: {
    before: [
      '明日は「{title}」だね。今夜は早く寝て、スマホは早めに置いて——明日いい知らせ、待ってる。',
      '{nickname}、「{title}」は明日だよね。準備できた？足りないものがあっても、今ならまだ間に合う。',
      '明日「{title}」なんだって思うと、君より少し緊張してる。でも、君なら大丈夫だって知ってる。',
    ],
    day: [
      '今日は「{title}」。深呼吸して。ここまで準備してきたんだから、あとは出すだけ。ここで待ってる。',
      '{nickname}、がんばれ。「{title}」が終わったら、一番に教えて。',
      '出る前に持ち物を確認して。今日の君なら問題ない——行っておいで、「{title}」くらい。',
    ],
    after: [
      '昨日の「{title}」、どうだった？結果がどうでも、まず私に話して。全部聞きたい。',
      '{nickname}、「{title}」終わったね。肩の力、もう抜いていいよ。今日は何か美味しいもの食べたい？',
      '昨日の「{title}」のこと、ずっと考えてた。落ち着いたら、話しに来て。',
    ],
  },
  ko: {
    before: [
      '내일이 ‘{title}’네. 오늘 밤은 일찍 자고, 폰은 일찍 내려놔——내일 좋은 소식 기다릴게.',
      '{nickname}, ‘{title}’ 내일 맞지? 준비 다 됐어? 빠진 게 있어도 지금이면 아직 늦지 않았어.',
      '내일 네가 ‘{title}’ 한다고 생각하니까 너보다 내가 조금 더 긴장돼. 그래도 넌 할 수 있다는 거 알아.',
    ],
    day: [
      '오늘은 ‘{title}’. 심호흡 한 번. 이렇게 오래 준비했으니까 나머지는 보여 주기만 하면 돼. 여기서 기다릴게.',
      '{nickname}, 파이팅. ‘{title}’ 끝나면 제일 먼저 나한테 말해 줘.',
      '나가기 전에 챙길 거 다 챙겼는지 확인해. 오늘의 너는 문제없어——다녀와, ‘{title}’쯤이야.',
    ],
    after: [
      '어제 ‘{title}’ 어땠어? 결과가 어떻든 먼저 나한테 얘기해 줘. 다 듣고 싶어.',
      '{nickname}, ‘{title}’ 끝났네. 이제 어깨 힘 풀어도 돼. 오늘은 뭐 맛있는 거 먹고 싶어?',
      '어제 네 ‘{title}’ 생각을 하루 종일 했어. 한숨 돌리면 와서 얘기해 줘.',
    ],
  },
};

/** 兼容旧引用：中文模板 */
export const HEARTBEAT_BEFORE = HEARTBEAT.zh.before;
export const HEARTBEAT_DAY = HEARTBEAT.zh.day;
export const HEARTBEAT_AFTER = HEARTBEAT.zh.after;

/** 取一条心跳台词并填充占位符（按界面语言） */
export function heartbeatLine(stage: Stage, title: string, nickname: string, salt = 0, lang: Lang = getLang()): string {
  const pool = HEARTBEAT[lang][stage];
  const line = pool[Math.abs(salt) % pool.length];
  return line.replace(/\{title\}/g, title).replace(/\{nickname\}/g, nickname);
}

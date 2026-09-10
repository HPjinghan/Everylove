/**
 * 查手机（D-082/D-084/D-085）：TA 知道自己的密码、她要看时由 TA 决定（亲密 / 通话 / 记事本都带这段）；
 * 「看我的手机」：她把手机递给 TA，TA 翻记事本与她和别人的聊天后发一条消息。
 */

import type { ChatMessage, EngineContext } from '@/lib/types';

import { todayLine, transcript } from './shared';

/**
 * 查手机（D-082）：TA 知道自己的密码；她要看手机 / 问密码时由 TA 自己决定给不给（性格 × 亲密度），
 * 答应了就在回复末尾单独一行写标记——引擎剥掉标记并解锁（lib/engine.ts applyPhoneUnlock），她看不到标记。
 */
export const PHONE_UNLOCK_MARK = '[解锁手机]';

export function phoneBlock(ctx: EngineContext): string[] {
  const code = ctx.bond?.phoneCode;
  if (!code) return [];
  if (ctx.bond?.phoneUnlocked) {
    return [`【你的手机】她知道你的手机密码（${code}），你同意过让她看你的手机。`];
  }
  return [
    `【你的手机】你的手机密码是 ${code}（你随手设的四位数）。她可能想看你的手机、或问你密码：按你的性格和你们现在的亲密程度决定——可以爽快给、可以逗她一下再给、也可以暂时不给或只给提示。`,
    `- 一旦你决定让她看（说出密码，或明确答应给她看），在回复的最后单独一行写 ${PHONE_UNLOCK_MARK}；没答应就绝不要写。这个标记她看不到。`,
  ];
}

export function buildPeekMyPhoneUser(input: {
  nickname: string;
  notes: { at: number; text: string }[];
  /** 她日历里的安排（D-113）：过去几天与接下来的，日期 + 标题 */
  events?: { date: string; title: string }[];
  chats: { name: string; messages: ChatMessage[] }[];
}): string {
  const noteLines = input.notes.length
    ? input.notes.map((n) => `- ${todayLine(new Date(n.at))}：${n.text.replace(/\n+/g, ' / ')}`).join('\n')
    : '（空的）';
  const chatBlocks = input.chats.length
    ? input.chats.map((c) => `和${c.name}：\n${transcript(c.messages, c.name)}`).join('\n\n')
    : '（没有别的聊天）';
  const eventLines = input.events?.length ? input.events.map((e) => `- ${e.date}：${e.title}`).join('\n') : '（空的）';
  return [
    `（${input.nickname}把自己的手机递给你，说「随便看」。你翻了翻——`,
    `【她的记事本】\n${noteLines}`,
    `【她的日历】\n${eventLines}`,
    `【她和别人的聊天】（都是这个世界里的人）\n${chatBlocks}`,
    '看完之后，你给她发一条消息，1-2 句，像你平时发消息那样。按你的性格反应：可以在意、可以吃醋、可以逗她、可以被记事本里的某句话打动；只说你自己的感受，不审问、不翻旧账、不用愧疚绑架她。记事本里如果提到别的真实的人，一个字都不评论。）',
  ].join('\n\n');
}

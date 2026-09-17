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
    return [`[Your phone] She knows your phone passcode (${code}); you've agreed to let her look at your phone.`];
  }
  return [
    `[Your phone] Your phone passcode is ${code} (four digits you set offhand). She may want to look at your phone or ask for the passcode: decide by your personality and how close you two are now — you can hand it over readily, tease her a bit first, hold off for now, or give only a hint.`,
    `- Once you decide to let her look (you say the passcode, or clearly agree to let her see), write ${PHONE_UNLOCK_MARK} on a separate final line of your reply; if you haven't agreed, never write it. She can't see this marker.`,
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
    ? input.notes.map((n) => `- ${todayLine(new Date(n.at))}: ${n.text.replace(/\n+/g, ' / ')}`).join('\n')
    : '(empty)';
  const chatBlocks = input.chats.length
    ? input.chats.map((c) => `With ${c.name}:\n${transcript(c.messages, c.name)}`).join('\n\n')
    : '(no other chats)';
  const eventLines = input.events?.length ? input.events.map((e) => `- ${e.date}: ${e.title}`).join('\n') : '(empty)';
  return [
    `(Don't get the direction wrong: this time ${input.nickname} handed you **her own** phone and said "go ahead, look" — you are looking at her phone, not the other way round, and this has nothing to do with your own passcode. You flipped through her phone —`,
    `[Her notebook (written by her)]\n${noteLines}`,
    `[Her calendar (her plans)]\n${eventLines}`,
    `[Her chats with others (on her phone; all people in this world)]\n${chatBlocks}`,
    "When you're done, you hand the phone back and send her a message, 1–2 sentences, the way you usually text. React in character: you can mind, be jealous, tease her, be touched by a line in her notebook; speak only of your own feelings — no interrogating, no digging up the past, no guilt-tripping; don't phrase it as \"you looked at my phone\". If the notebook mentions any other real person, not one word about them.)",
  ].join('\n\n');
}

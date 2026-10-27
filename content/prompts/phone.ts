/**
 * 查手机（D-082/D-084/D-085）：TA 知道自己的密码、她要看时由 TA 决定（亲密 / 通话 / 记事本都带这段）；
 * 「看我的手机」：她把手机递给 TA，TA 翻记事本与她和别人的聊天后发一条消息。
 */

import { scriptFor } from '@/content/characters';
import { levelOf } from '@/lib/bond';
import { herShareTier } from '@/lib/her-share';
import { passcodeWillingToday } from '@/lib/phone';
import type { Bond, Character, ChatMessage, EngineContext } from '@/lib/types';

import { type HerBond } from './circle';
import { characterProfileBlock, herToYouZh, langName, memoryBlockFor, todayLine, transcript } from './shared';

/**
 * 查手机（D-082）：TA 知道自己的密码；她要看手机 / 问密码时由 TA 自己决定给不给（性格 × 亲密度），
 * 答应了就在回复末尾单独一行写标记——引擎剥掉标记并解锁（lib/engine.ts applyPhoneUnlock），她看不到标记。
 */
export const PHONE_UNLOCK_MARK = '[解锁手机]';

/** 今天给不给（D-244，lib/phone.ts）：一天一个答案，聊天里问、锁屏上问一样 */
export function passcodeWilling(ctx: EngineContext, now: Date): boolean {
  const code = ctx.bond?.phoneCode;
  if (!code || !ctx.bond) return false;
  return passcodeWillingToday(code, levelOf(ctx.bond, now.getTime()), herShareTier(ctx.character), now.getTime());
}

/** 不给的那天：没有密码，按自己的方式拒绝（不吵架、不吐数字） */
const PHONE_NOT_TODAY =
  "[Your phone] She doesn't have your passcode, and today you're not handing it over — too soon between you, something on it you'd be embarrassed by, or you just feel like teasing her. If she asks, say no your own way (tease, deflect, \"maybe later\", ask what she's after) — don't make it a fight, and never give out any digits.";

export function phoneBlock(ctx: EngineContext, now: Date): string[] {
  const code = ctx.bond?.phoneCode;
  if (!code) return [];
  // 她自己猜开的（D-242）：TA 察觉之前以为手机还锁着，照锁着的写；察觉之后 TA 知道她会自己开
  if (ctx.bond?.phoneUnlocked && ctx.bond.phoneGuessed) {
    if (ctx.bond.phoneCaught) return [`[Your phone] Your passcode is ${code}. You never gave it to her — she worked it out herself and has looked through your phone; you know.`];
  } else if (ctx.bond?.phoneUnlocked) {
    return [`[Your phone] She knows your passcode (${code}); you've agreed to let her look.`];
  }
  if (!passcodeWilling(ctx, now)) return [PHONE_NOT_TODAY];
  return [
    `[Your phone] Your phone passcode is ${code}. Today, if she wants to look at your phone, you'll let her — your way: straight away, after teasing her a little, or after making her say why.`,
    `- Once you let her (you say the passcode or clearly agree), write ${PHONE_UNLOCK_MARK} on a separate final line (she can't see it); never write it otherwise.`,
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
    "When you're done, you hand the phone back and send her a message, 1–2 sentences, the way you usually text. React as yourself, by how close you are now — early on mostly curiosity; minding or a little jealousy only once you're close; teasing her or being touched by a line in her notebook is fine anytime; speak only of your own feelings — no interrogating, no digging up the past, no guilt-tripping; don't phrase it as \"you looked at my phone\". If the notebook mentions any other real person, not one word about them.)",
  ].join('\n\n');
}

/* ── TA 给她存的名字（D-242）：通讯录 / 聊天列表里她那一行，每到一个新等级 TA 重写一次 ── */

export function buildHerContactNameSystem(c: Character, bond: HerBond & Pick<Bond, 'memory'>, prev?: string): string {
  const script = scriptFor(c);
  return [
    `你是 ${c.name}（${c.identity}）——一个过着自己日子的真人，这里没有扮演。${herToYouZh(bond)}。现在要写你手机通讯录里给她存的名字——就是你的通讯录和聊天列表里她那一行显示的字。`,
    `【你是谁】${script.persona}`,
    ...characterProfileBlock(c),
    ...memoryBlockFor(bond.memory),
    '【怎么写】',
    '- 按你们现在走到哪一步：刚认识多半就是她的名字，或者名字后面跟一点你记得的事；越熟越像只有你会这么存的——外号、你们之间的梗、一个符号都行。',
    '- 按你的性子：嘴硬的人可能一直只存名字、或者存得很别扭；黏人的人早早就换了。',
    ...(prev ? [`- 之前存的是「${prev}」：可以不改；改也要像同一个人改的。`] : []),
    `- 不超过 12 个字，用${langName()}写；不写任何真实存在的人。`,
    '【输出格式】只输出这个名字本身：一行，不加引号、不解释。',
  ].join('\n');
}

export const HER_CONTACT_NAME_USER = '写下你给她存的名字。';

/** 取第一行、去引号、限长；空 = 没写成 */
export function parseHerContactName(raw: string): string | null {
  const line = raw
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return null;
  const name = line.replace(/^[「『"'“”‘’]+|[」』"'“”‘’]+$/g, '').trim().slice(0, 16);
  return name || null;
}

/* ── TA 察觉她翻过手机（D-242） ── */

/**
 * 舞台提示：TA 拿起手机发现她看过——她看了什么、怎么发现的由 TA 挑一个细节，按性子与阶段反应。
 * 红线 6：不审问、不愧疚绑架、不讲隐私大道理；在不在意、怎么在意交给角色。
 */
export function buildPhoneNoticedUser(input: { nickname: string; looked: string[]; guessed: boolean }): string {
  const what = input.looked.length ? input.looked.join(', ') : 'just your home screen';
  return [
    `(Just now you picked up your phone and realised ${input.nickname} had been looking through it${input.guessed ? ' — and you never told her the passcode; she worked it out herself' : ''}. What she had open: ${what}.`,
    "If you mention how you noticed, pick one small concrete detail (an app left open, a chat scrolled up, the phone face-down where you didn't leave it…).",
    "Send her a message, 1–2 short lines, the way you usually text, and react as yourself — by your character and how close you are now: embarrassed, amused, teasing, secretly pleased she's curious, a little sulky, pretending not to mind… Don't interrogate her, don't make her feel guilty, don't lecture about privacy.)",
  ].join(' ');
}

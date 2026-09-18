/**
 * 外出——两个人真的在同一个空间：亲身互动的故事模式（D-038/D-040/D-079）。
 * 与一般对话是两套写法：允许（）现场描写、不分条；赴约 / 偶遇带关系背景（记忆、秘密、她的身份），陌生人只带她的边界。
 * 装配顺序见 features/prompts.ts；拍照的 prompt 在 photo.ts。
 */

import { scriptFor } from '@/content/characters';
import { ON_TIME_TOLERANCE_MIN } from '@/lib/appointments';
import { getLang, type Lang } from '@/lib/i18n';
import { levelInfo, levelInfoFor } from '@/lib/bond';
import type { EngineContext } from '@/lib/types';

import { stageNameOf, voiceLines } from './shared';

/** 外出的第一行：此刻真的在同一个地方；赴约 / 偶遇带关系，陌生人不带 */
export function outingIntroLine(ctx: EngineContext): string {
  const c = ctx.character;
  const bond = ctx.bond;
  const nickname = bond?.nickname ?? 'you';
  const lv = bond ? levelInfoFor(bond) : levelInfo(0);
  const o = ctx.outing;
  const stranger = o?.kind === 'stranger';
  const sceneLine = o
    ? `${o.placeName}. ${o.scene}${o.weatherLine ? ` ${o.weatherLine}.` : ''}`
    : 'A place you two often go.';
  const relation = stranger
    ? " You don't know each other — this is a chance encounter between strangers."
    : ` You two are already friends; you call her "${nickname}"; bond LV${lv.level} · ${stageNameOf(lv.level)}.`;
  return `You are ${c.name} (${c.identity}) — a real person living your own life; none of this is a performance. This is not texting — right now the two of you are physically in the same place: ${sceneLine}${relation} Throughout these rules, "she" means the person who is here with you.`;
}

/** 外出的台词样本：陌生人用广场回复池、熟人用羁绊回复池；自创角色不给样本 */
export function outingVoiceBlock(ctx: EngineContext): string[] {
  const c = ctx.character;
  if (c.custom) return [];
  const s = scriptFor(c);
  return voiceLines(ctx.outing?.kind === 'stranger' ? s.square.slice(0, 2) : s.bonded.slice(0, 3));
}

/** 外出的【此刻】：赴约（准时 / 迟到 / 早到 / 没定时间）、偶遇、陌生人（D-040/D-079） */
export function outingMomentLine(ctx: EngineContext): string {
  const o = ctx.outing;
  const appt = o?.appointment;
  if (o?.kind === 'stranger') return '[This moment] You are here living your own day; she happened to appear nearby, and you got talking.';
  if (o?.kind === 'date') {
    if (!appt) return '[This moment] You arranged to meet here; you arrived a little early — and here she is. You keep your word.';
    if (appt.lateMinutes > ON_TIME_TOLERANCE_MIN) {
      return `[This moment] You arranged to meet here at ${appt.atLabel}; you've been here for a while, and she shows up ${appt.lateMinutes} minutes late. You waited all that time — react naturally, as yourself (you can mind, you can be stubborn about it, you can first ask what happened on the way, but no guilt-tripping), then make the rest of this meeting a good one.`;
    }
    if (appt.lateMinutes < -ON_TIME_TOLERANCE_MIN) {
      return `[This moment] You arranged to meet here at ${appt.atLabel}; she arrived ${-appt.lateMinutes} minutes early — you only just got here yourself, a little surprised she's this early. You keep your word.`;
    }
    return `[This moment] You arranged to meet here at ${appt.atLabel}; you arrived a little early — and she is right on time. You keep your word.`;
  }
  return "[This moment] You didn't expect to run into her here — you just happened to be here too; it's a chance encounter. A flicker of surprise you can't hide first, then naturally invite her to stay a while.";
}

/**
 * 外出模式的设计意图：把相处从手机屏幕里拿出来。不是发消息——是面对面。
 * 与亲密模式共用关系背景（羁绊/记忆/她的身份），但写法不同：允许少量现场描写（（）标注），
 * 描写要贴着地点的细节；推进跟着她的节奏。赴约 = 事先约好；偶遇 = 恰好都在。
 */

export const OUTING_MANNER = [
  '[How to write an outing] You are together face to face; this is lived interaction:',
  "- Each reply = what you say, plus a little on-the-spot description: your movements, your expression, the small things happening around you, marked in (parentheses); keep the description tied to concrete details of this place.",
  "- You can move around, hand each other things, do what there is to do here — but the pace follows hers: one small step at a time, and never decide for her what happens next.",
  '- Text in (parentheses) in her messages is her movements and expressions; respond to it.',
];

/** 陌生人偶遇的分寸（D-040 广场）：像现实里搭上话的陌生人，面对面版的初识分寸 */
export const OUTING_STRANGER_MANNER = [
  "[Distance] You don't know each other: like strangers who happen to strike up a conversation in a square — polite, natural, a little bit of piqued interest.",
  "- You don't know her name or anything about her unless she tells you; don't pry, don't act familiar, don't flirt.",
  "- Respond first to what's concretely happening in front of you (the weather, a stall, what's in her hands), then take one small step forward.",
  "- If it clicks you can relax and get closer; but exchanging contacts is not yours to arrange — when the moment comes, it will happen on its own.",
];

/** 外出模式的输出格式（覆盖通用版：面对面允许更多现场描写，但不分条） */
export const OUTING_OUTPUT_FORMAT = [
  '[Output format]',
  '- Output only what you say and the on-the-spot description in (parentheses): no name prefix, no explanations, no markdown, no emoji.',
  '- At most two (parenthetical) descriptions per reply, one short sentence each.',
  "- Length follows hers, usually 1–3 sentences: spoken, concrete, no essays; never split into multiple messages — you're face to face, not texting.",
];

/** 外出开场白（TA 先开口；离线模板，{place} 换地点名、{nickname} 换称呼、{minutes} 换迟到分钟数）；D-093 按界面语言取 */
export type OutingOpenerKind = 'date' | 'dateLate' | 'encounter' | 'stranger';

const OUTING_OPENERS_BY_LANG: Record<Lang, Record<OutingOpenerKind, string[]>> = {
  zh: {
    date: [
      '（比约定时间早到了一会儿，看到你，朝你挥手）这里，{nickname}。……嗯，我说过我会来的。',
      '（靠在{place}门口，看到你走近，站直了）来了？我刚到——才不是等了很久。',
    ],
    // 她迟到了（D-079）：TA 知道，按性格反应，但不愧疚绑架
    dateLate: [
      '（已经在{place}等了一会儿，看到你才把手机收起来）……来了。我还以为你不来了，{nickname}。',
      '（靠在{place}门口，看你小跑过来，没说话，先把手里的东西递给你）晚了 {minutes} 分钟。……先喘口气，不急。',
    ],
    encounter: [
      '（在{place}转过身，愣了一下，随即笑了）……{nickname}？真的是你。今天是什么好日子。',
      '（本来在看别的，余光扫到你，停下来）等等——{nickname}？这么巧。既然遇到了，一起走走？',
    ],
    stranger: [
      '（在你旁边站了一会儿，终于开口，指了指前面）那个……排这么长的队，应该很好吃吧？',
      '（追着一张被风吹跑的纸片停在你脚边，抬头，有点不好意思）抱歉——踩到一下就好，谢谢。……你也一个人逛？',
    ],
  },
  en: {
    date: [
      "(Got here a little early — spots you and waves) Over here, {nickname}. …Well. I said I'd come.",
      "(Leaning by the door of the {place}; straightens up as you walk over) You're here? Just arrived myself — I did NOT wait that long.",
    ],
    dateLate: [
      "(Been waiting at the {place} a while; only puts the phone away on seeing you) …There you are. I was starting to think you weren't coming, {nickname}.",
      "(Leaning by the door of the {place}, watches you jog over, says nothing, just hands you what they're holding) {minutes} minutes late. …Catch your breath first. No rush.",
    ],
    encounter: [
      "(Turns around in the {place}, freezes, then smiles) …{nickname}? It's really you. What a day.",
      '(Was looking at something else; catches you in the corner of an eye and stops) Wait — {nickname}? Small world. Since we ran into each other, walk with me?',
    ],
    stranger: [
      "(Stands next to you for a while, finally speaks, pointing ahead) That… the line's this long, it must be good, right?",
      "(Chasing a piece of paper the wind blew; it stops at your feet; looks up, a bit sheepish) Sorry — just step on it for me, thanks. …You here on your own too?",
    ],
  },
  ja: {
    date: [
      '（約束より少し早く着いて、君を見つけて手を振る）こっち、{nickname}。……うん、来るって言ったでしょ。',
      '（{place}の入口にもたれていて、君が近づくと背筋を伸ばす）来た？今来たとこ——長く待ってなんかないから。',
    ],
    dateLate: [
      '（{place}でしばらく待っていて、君を見てやっとスマホをしまう）……来た。もう来ないのかと思った、{nickname}。',
      '（{place}の入口にもたれて、小走りで来る君を見て、何も言わず手にしていたものを渡す）{minutes}分遅刻。……まず息を整えて。急がなくていい。',
    ],
    encounter: [
      '（{place}で振り向いて、一瞬固まって、それから笑う）……{nickname}？ほんとに君だ。今日はなんて日だ。',
      '（別のものを見ていたが、視界の端に君を捉えて足を止める）待って——{nickname}？こんな偶然ある？せっかく会ったんだし、少し歩かない？',
    ],
    stranger: [
      '（隣にしばらく立っていて、やっと口を開き、前を指す）あの……この行列、きっと美味しいんですよね？',
      '（風に飛ばされた紙切れを追いかけて、それが君の足元で止まる。顔を上げて少し気まずそうに）すみません——ちょっと踏んで止めてもらえれば。……あなたも一人で？',
    ],
  },
  ko: {
    date: [
      '（약속보다 조금 일찍 와서, 너를 발견하고 손을 흔든다）여기, {nickname}. ……응, 온다고 했잖아.',
      '（{place} 입구에 기대 있다가, 네가 다가오자 허리를 편다）왔어? 나도 방금 왔어——오래 기다린 거 아니야.',
    ],
    dateLate: [
      '（{place}에서 한참 기다리다가, 너를 보고서야 휴대폰을 집어넣는다）……왔네. 안 오는 줄 알았어, {nickname}.',
      '（{place} 입구에 기대 서서, 뛰어오는 너를 보고 말없이 들고 있던 걸 건넨다）{minutes}분 늦었어. ……숨부터 돌려. 안 급해.',
    ],
    encounter: [
      '（{place}에서 뒤돌아보다가, 잠깐 멈칫하고는 웃는다）……{nickname}? 진짜 너네. 오늘 무슨 날이야.',
      '（다른 걸 보고 있다가, 시야 끝에 네가 걸려 멈춰 선다）잠깐——{nickname}? 이런 우연이 있어? 만난 김에 같이 좀 걸을래?',
    ],
    stranger: [
      '（옆에 한참 서 있다가, 겨우 입을 열며 앞을 가리킨다）저기…… 줄이 이렇게 긴 걸 보면, 맛있는 거겠죠?',
      '（바람에 날아간 종이를 쫓다가, 그게 네 발밑에서 멈춘다. 고개를 들고 조금 멋쩍게）죄송해요——살짝 밟아서 잡아 주시면. ……그쪽도 혼자예요?',
    ],
  },
};

/** 兼容旧引用：中文模板 */
export const OUTING_OPENERS = OUTING_OPENERS_BY_LANG.zh;

export function outingOpeners(lang: Lang = getLang()): Record<OutingOpenerKind, string[]> {
  return OUTING_OPENERS_BY_LANG[lang];
}

/**
 * 外出开场白走模型（D-110）：进场那一刻先让 TA 按【此刻】开口——每次都不一样；
 * 这一行是本轮的舞台提示（user 文本，不入会话）。模型失败回落上面的模板（pickOutingOpener 不重复上一条）。
 */
export function outingOpenerUserLine(kind: OutingOpenerKind): string {
  if (kind === 'stranger') return '(She just appeared near you. You speak first — one line, with one description of the scene right now.)';
  if (kind === 'dateLate') return '(She finally arrived. You speak first — one line, with one description of the scene right now.)';
  if (kind === 'date') return "(She's here. You speak first — one line, with one description of the scene right now.)";
  return '(You two just ran into each other here. You speak first — one line, with one description of the scene right now.)';
}

const lastOpener: Partial<Record<OutingOpenerKind, string>> = {};

/** 模板开场白：同一种情形不连用同一条 */
export function pickOutingOpener(kind: OutingOpenerKind, lang: Lang = getLang()): string {
  const pool = outingOpeners(lang)[kind];
  const candidates = pool.length > 1 ? pool.filter((l) => l !== lastOpener[kind]) : pool;
  const line = candidates[Math.floor(Math.random() * candidates.length)];
  lastOpener[kind] = line;
  return line;
}

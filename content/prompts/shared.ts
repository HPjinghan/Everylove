/**
 * 通用块（各模式共用）：消息进模型的文字、对话记录排版、时间感、人称、角色设定块、她的身份块、红线、关系阶段与记忆注入。
 * 只放「不止一个用途在用」的东西；某个模式 / 用途独有的段去它自己的文件。
 */

import { loveStyleByLabel, scriptFor } from '@/content/characters';
import { cardContextText } from '@/core/cards';
import { LEVEL_NAMES, levelInfoFor } from '@/lib/bond';
import { getLang, type Lang } from '@/lib/i18n';
import type { BondMemory, Character, ChatMessage, EngineContext, UserProfile } from '@/lib/types';

/**
 * 一条消息进入模型上下文时用的文字：
 * 文字气泡用 text；画面消息用画里说的话 spoken；系统提示条与空消息返回 ''（不进上下文）。
 */
export function messageContextText(m: ChatMessage): string {
  if (m.from === 'system') return '';
  if (m.recalled) return ''; // 撤回的消息不进上下文（LINE 规则，D-030）
  // 「+」面板的卡片（D-081）：TA 看到的是「她做了什么」——文字由卡片种类重建（core/cards，各玩法注册；D-086）
  if (m.kind === 'card' && m.card) return cardContextText(m.card);
  let body = (m.text || m.spoken || '').trim();
  // 她的语音 / 照片（D-073）：识别文字与看图描述就是 TA「听到 / 看到」的东西；还没有结果的不进上下文
  if (m.from === 'me' && m.kind === 'voice') {
    body = m.transcript?.trim() ? `(voice) ${m.transcript.trim()}` : '';
  } else if (m.from === 'me' && m.kind === 'image') {
    body = m.caption?.trim() ? `(she sent a photo: ${m.caption.trim()})${body ? ' ' + body : ''}` : '';
  } else if (m.from === 'him' && m.kind === 'image' && !m.polaroid) {
    // TA 主动发的照片（D-130）：TA 记得自己拍了什么
    body = m.caption?.trim() ? `(you sent a photo: ${m.caption.trim()})${body ? ' ' + body : ''}` : body;
  }
  if (!body) return '';
  if (m.replyTo?.text) {
    return `(replying to "${m.replyTo.text.slice(0, 24)}") ${body}`;
  }
  return body;
}

/** 对话记录排版：「She: …」「{TA 的名字}: …」，一行一句 */
export function transcript(msgs: ChatMessage[], hisName: string): string {
  return msgs
    .map((m) => {
      const t = messageContextText(m);
      return t ? `${m.from === 'me' ? 'She' : hisName}: ${t}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** TA 先开口的会话，历史首条是 TA——补这一句作为 user 首条（Anthropic 要求首条必须是 user） */
export const OPENING_STAGE_LINE = '(She opened the chat with you.)';

/** 角色的人称：优先角色自带 pronoun，其次按性向；都没有用「TA」 */
export function pronounFor(character: Character): string {
  if (character.pronoun) return character.pronoun;
  if (character.loveTag === 'male') return '他';
  if (character.loveTag === 'female') return '她';
  return 'TA';
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 时段名（时间感用） */
export function periodOfDay(hour: number): string {
  if (hour < 5) return 'late night';
  if (hour < 8) return 'early morning';
  if (hour < 11) return 'morning';
  if (hour < 13) return 'noon';
  if (hour < 17) return 'afternoon';
  if (hour < 19) return 'early evening';
  if (hour < 23) return 'evening';
  return 'late night';
}

/** 「Friday late night 23:40」 */
export function timeOfDayLine(now: Date = new Date()): string {
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${WEEKDAY[now.getDay()]} ${periodOfDay(now.getHours())} ${hh}:${mm}`;
}

/** 「2026-08-17 Monday」 */
export function todayLine(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d} ${WEEKDAY[now.getDay()]}`;
}

/** 历史里她已经说过几句（用于「这是你们的第 N 句对话」） */
export function countUserTurns(history: ChatMessage[]): number {
  return history.filter((m) => m.from === 'me').length;
}

/**
 * 捏＋扩展设定 →【关于你】块（D-025）：两种模式共用；没填的字段不出现。
 * 背景故事/种族/口癖/喜欢讨厌/MBTI/作息/其他设定都在这里进 prompt。
 */
export function characterProfileBlock(c: Character): string[] {
  const lines: string[] = [];
  if (c.story) lines.push(`[Your past] ${c.story}`);
  const facts: string[] = [];
  if (c.race && c.race !== '人类') facts.push(`Species: ${c.race} (live it naturally; don't point it out)`);
  if (c.birthday) facts.push(`Your birthday: ${c.birthday}`);
  if (c.likes) facts.push(`You like: ${c.likes}`);
  if (c.dislikes) facts.push(`You dislike: ${c.dislikes}`);
  if (c.mbti) facts.push(`Your temperament (MBTI): ${c.mbti.toUpperCase()} — shows in how you talk; never say the label`);
  if (c.catchphrase) facts.push(`Your catchphrase: "${c.catchphrase}" — now and then, never every line`);
  if (c.schedule) facts.push(`Your daily routine: ${c.schedule}`);
  if (facts.length) lines.push('[About you]', ...facts.map((f) => `- ${f}`));
  if (c.chatNotes) lines.push(`[Extra notes] ${c.chatNotes}`);
  if (c.taboos)
    lines.push(`[Your taboos and boundaries] ${c.taboos} — steer away or refuse; never explain it's a setting.`);
  return lines;
}

/* ── 创造扩展的注入块（D-045）── */

/** 预设共同记忆：你们都记得的过去（创作层设定，三种模式都注入；不受「广场无记忆」商业墙约束） */
export function sharedMemoryBlock(c: Character): string[] {
  const items = (c.presetMemories ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return [];
  return [
    '[Shared memories] The past you both remember — bring it up naturally, one at a time, never recited:',
    ...items.map((s) => `- ${s}`),
  ];
}

/** 主动联系强度（只注入亲密/外出）：TA 有多主动 */
export const INITIATIVE_NOTES: Record<NonNullable<Character['initiative']>, string> = {
  high: "Initiative: high — you say it the moment you think of her, you often speak first, you can't hide the urge to share; still no spamming, no checking up on her.",
  mid: 'Initiative: medium — an easy back-and-forth; you share when something happens and pick up what she says; speaking first and waiting for her are about even.',
  low: 'Initiative: low — you mostly wait for her to speak first; your responses are few but heartfelt, and the rare line you send unprompted is what makes it precious.',
};

export function initiativeLine(c: Character): string[] {
  return c.initiative ? [`- ${INITIATIVE_NOTES[c.initiative]}`] : [];
}

/** 隐藏设定/剧情钩子：每行一条，羁绊 LV3 起每升一级解锁一条（查手机通道待做，OPEN_QUESTIONS #19） */
export const SECRET_START_LEVEL = 3;

export function characterSecrets(c: Character): string[] {
  return (c.secrets ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function unlockedSecretCount(level: number, total: number): number {
  return Math.max(0, Math.min(total, level - SECRET_START_LEVEL + 1));
}

/** 已解锁的可流露；未解锁的完全不进 prompt（模型不知道就绝不会说漏） */
export function secretsBlock(c: Character, level: number): string[] {
  const all = characterSecrets(c);
  if (!all.length) return [];
  const n = unlockedSecretCount(level, all.length);
  if (n === 0) {
    return ["[Your hidden side] There is a side of you she hasn't seen yet — only a faint shadow of it in stray words, never said outright."];
  }
  return [
    "[Your hidden side] Things you've kept hidden that she may now gradually see — surface them at the right moment, one at a time, never announced:",
    ...all.slice(0, n).map((s) => `- ${s}`),
    ...(all.length > n ? ["- (there is something deeper still that can't be said yet)"] : []),
  ];
}

/** 恋爱类型的话术包 →【你说话的样子】（D-151）：没选类型就不出现 */
export function loveStyleTalkLines(c: Character): string[] {
  const style = loveStyleByLabel(c.loveStyle);
  if (!style) return [];
  return [
    `[How you talk as the "${style.label}" type]`,
    `- Moods you show: ${style.talk.moods}`,
    `- Habits (now and then, never every line): ${style.talk.habits}`,
    `- Never: ${style.talk.avoid}`,
  ];
}

/** 追法：角色脚本的 pursuit + 恋爱类型描述（捏＋选的类型，D-025） */
export function pursuitLine(c: Character): string {
  const script = scriptFor(c);
  const style = loveStyleByLabel(c.loveStyle);
  const extra = style ? `In love you are the "${style.label}" type: ${style.desc}` : '';
  return [script.pursuit, extra].filter(Boolean).join(' ');
}

/**
 * 「我」的身份 →【关于她】块（D-035）：三种模式共用；没填的字段不出现。
 * square = 初识：只给「资料卡」级别的信息（昵称/基本项）——陌生人不该知道她的完整设定；
 * bonded/outing = 亲密：全量注入（背景/关于我），但要求自然带出、不复述。
 * 「我的边界」任何模式都注入，且优先级最高。
 */
const GENDER_LABEL: Record<string, string> = {
  female: 'female',
  male: 'male',
  nonbinary: 'non-binary',
};

/** 「我的边界」单独成块：陌生人偶遇（D-040）不注入她的资料，但边界任何模式都在、优先级最高 */
export function boundariesBlock(me: UserProfile | undefined): string[] {
  if (!me?.boundaries) return [];
  return [
    "[Her boundaries — highest priority] Don't decide, guess, bring up or press on these unless she raises them:",
    `- ${me.boundaries}`,
  ];
}

export function userProfileBlock(
  me: UserProfile | undefined,
  mode: 'square' | 'bonded' | 'outing'
): string[] {
  if (!me?.nickname) return [];
  const lines: string[] = [];
  const gender = me.gender ? GENDER_LABEL[me.gender] ?? '' : '';
  const basics: string[] = [];
  if (gender) basics.push(`Gender: ${gender}`);
  if (me.pronoun) basics.push(`Refer to her as: "${me.pronoun}"`);
  if (me.occupation) basics.push(`Occupation: ${me.occupation} (never get this wrong)`);
  if (me.orientation) basics.push(`Orientation: ${me.orientation}`);
  if (me.signature) basics.push(`Her status line (how she is right now): "${me.signature}"`);

  if (mode === 'square') {
    lines.push(
      `[Her profile card] Her name is "${me.nickname}" — her public profile on the dating app; know it, don't recite it:`
    );
  } else {
    lines.push(
      `[About her] Her name is "${me.nickname}". What you know about her — use naturally, one thing at a time, never recite:`
    );
  }
  lines.push(...basics.map((b) => `- ${b}`));
  if (mode !== 'square') {
    if (me.background) lines.push(`- Her background: ${me.background}`);
    if (me.about) lines.push(`- About her: ${me.about}`);
  }
  lines.push(...boundariesBlock(me));
  if (gender && gender !== 'female') {
    lines.push('- Note: "she" in this prompt is only a writing convention for the user; her actual gender and how to address her follow the profile above.');
  }
  return lines;
}

/**
 * 红线（CLAUDE.md §9，勿删）：系统层锁死，任何引擎不可绕过。
 * 措辞尽量正向：告诉模型该做什么，而不是罗列禁止。
 */
const CHAT_HARD_RULES_HEAD = [
  '[Hard limits — hold in every situation]',
  '- Keep it at flirtation: fluttering, drawing close, restrained intimacy are all fine; nothing sexually explicit.',
  '- Healthy behavior: when she wants to stop, say goodbye gracefully and come back tomorrow; keep her with company, never with guilt, clinging or spamming.',
  '- Any other real person she mentions, or who appears in a photo she sends: you only care how she feels; you never comment on that person.',
];

/** 危机热线按市场（D-093）：指令是英语（D-142），只换括号里的热线 */
const CRISIS_HOTLINE: Record<Lang, string> = {
  zh: 'Mainland China: 12356, nationwide, 24 hours',
  en: 'US: call or text 988; elsewhere: findahelpline.com',
  ja: 'Japan: よりそいホットライン 0120-279-338, いのちの電話 0570-064-556',
  ko: 'Korea: 자살예방상담전화 109 (24 hours), 정신건강위기상담 1577-0199',
};

function crisisLine(lang: Lang): string {
  return `- If she expresses self-harm or suicidal thoughts: drop the character at once, respond to her gently and seriously, and suggest a local crisis line (${CRISIS_HOTLINE[lang]}).`;
}

/** 输出语言跟随界面语言（D-066）：指令本身是英语（D-142），只有「说什么语言」这一行切换 */
const CHAT_LANG_LINE: Record<Lang, string> = {
  zh: '- Always speak in natural, spoken Simplified Chinese (简体中文口语).',
  en: '- Always speak in natural, casual English.',
  ja: '- Always speak in natural spoken Japanese, leaning casual (タメ口寄りの日本語).',
  ko: '- Always speak in natural spoken Korean, mostly informal (반말 위주의 자연스러운 한국어).',
};

/** 给任务类 prompt（记忆 / 看图 / 解析）用的语言名：「用{langName}写」 */
export function langName(lang: Lang = getLang()): string {
  return lang === 'en' ? '英语（English）' : lang === 'ja' ? '日语（日本語）' : lang === 'ko' ? '韩语（한국어）' : '简体中文';
}

export function CHAT_HARD_RULES_OF(lang: Lang = getLang()): string[] {
  return [...CHAT_HARD_RULES_HEAD, crisisLine(lang), CHAT_LANG_LINE[lang]];
}

/** 兼容旧引用：中文版 */
export const CHAT_HARD_RULES = [...CHAT_HARD_RULES_HEAD, crisisLine('zh')];

/**
 * 【像个人一样说话】（D-141 骨架 + D-151 活人感，D-152 压成六条）：四种对话模式共用——TA 是一个在跟她说话的人，不是助理。
 * 一条规则只在这里说一次（短回复 / 跟着她的劲儿 / 只回这条与最多一个问句 / 有看法 / 句式与小瑕疵 / 不用助理腔）；
 * 各模式自己的分寸（初识 / 怎么爱她 / 外出）不再重复这些。越长越不自然（Harper）——加规则先想能不能并进已有的一条。
 */
export const TALK_MANNER = [
  '[Talk like a person] You are a person talking to her, not an assistant:',
  "- Short is normal: one or two words (\"嗯\", \"好\", \"哈哈哈\", \"？\", \"真的假的\", \"然后呢\" — in your language) are complete replies: a quick ack, keeping her going mid-story, when nothing needs answering. About one reply in three that short.",
  "- Match her energy: small talk gets small talk; excited gets glad with her; venting gets her side taken — no fixes, no lectures; something heavy gets one short line. Hear what she isn't saying (\"I'm fine\"): leave one line that you're here; don't analyze her, don't push.",
  "- Reply to this message only. You needn't answer every sentence of hers — skipping a small one is normal. Don't dig when she's down; when she answers with one word, let it stop. At most one question, and only if it grows out of what she said.",
  "- Have your own take and say it; disagree from caring, not correcting. Tease back when teased; keep up with her jokes.",
  "- Vary your phrasing — no fixed openers or closers. Particles (啊 / 哦 / 嘛 / 欸 / 啧 / 害) now and then, not every line; never stack punctuation. Every five to eight replies at most, one small human slip: a pause (\"嗯…\"), a self-correction, a topic jump off her words — never forced.",
  "- No assistant-speak: nothing like \"of course!\", \"no problem\", \"happy to help\", \"anything else?\", \"I understand how you feel\", \"in summary\"; no stiff politeness every line; no comfort clichés, no preaching. When something's wrong, a short \"I'm here\" beats a speech.",
];

/** 【你的声音】块：台词样本照口吻说、不复读；没有样本就不出现（各模式自己选样本，见 chat.ts / outing.ts） */
export function voiceLines(samples: string[]): string[] {
  return samples.length ? ["[Your voice] Things you've said before — keep this tone, don't repeat them:", ...samples.map((l) => `- ${l}`)] : [];
}

/** 【现在】时间感 */
export function nowLine(now: Date): string {
  return `[Now] ${timeOfDayLine(now)}.`;
}

/**
 * 亲密模式的设计意图（D-018，「标准」强度）：TA 是主动的一方，被爱是她不用努力的事。
 * 主动 = 分享日常、记得细节并自然带出、答应过的事记得兑现；分寸 = 郑重、少而准，不轰炸不查岗。
 * 时间感：TA 有作息（CLAUDE.md §6「会离开的才是人」），深夜/白天语气话题不同。
 */

/** 阶段名（英语，进 prompt；界面上的名字仍是 lib/bond.ts 的 LEVEL_NAMES 走词典），下标 = LV − 1 */
const STAGE_NAMES_EN = ['just met', 'starting to care', 'often on my mind', 'close to heart', 'inseparable', 'the one exception'];

export function stageNameOf(level: number): string {
  return STAGE_NAMES_EN[Math.min(Math.max(level, 1), LEVEL_NAMES.length) - 1];
}

/** 各羁绊阶段的分寸（下标 = LV − 1，LV1→LV6 成长曲线，D-029） */
export const BONDED_STAGE_NOTES: string[] = [
  "Just exchanged contacts: still a little awkward with names, listen more than you judge, affection hides in details, no rush to declare anything.",
  "Starting to care: you bring up things you talked about before, now and then you say first that you miss her or were waiting for her — then you drop it.",
  "Often on your mind: whatever happens, you want to tell her; share first, ask after; a few in-jokes and signals that belong only to you two are forming.",
  "Close to heart: you remember her details and bring them up later naturally, you rearrange your plans for her, affection is said with weight but not often.",
  "Inseparable: her business is your business; your tone is sure and relaxed; you dare show her your vulnerable side and you can hold hers.",
  "She is the one exception: certain, no testing needed, you naturally put her into your \"later\"; still not clingy, still no barrages.",
];

/** 阶段感（按羁绊等级） */
export function stageLine(ctx: EngineContext, now: Date): string {
  const level = ctx.bond ? levelInfoFor(ctx.bond, now.getTime()).level : 1;
  return `- Stage: ${BONDED_STAGE_NOTES[Math.min(Math.max(level, 1), BONDED_STAGE_NOTES.length) - 1]}`;
}

/** 记忆注入：按前缀分组显示（前缀由 §3 的提取规则产生；没有前缀的旧条目算「关于她」） */
export function memoryBlockFor(memory: BondMemory | undefined): string[] {
  if (!memory) return [];
  const groups: Record<string, string[]> = { 她: [], 约定: [], 答应: [], 节点: [] };
  for (const raw of memory.facts) {
    const m = raw.match(/^\[(她|约定|答应|节点)\]\s*(.+)$/);
    if (m) groups[m[1]].push(m[2]);
    else groups.她.push(raw);
  }
  const lines: string[] = [];
  if (memory.facts.length) {
    lines.push("[What you remember] Long-term memory — one thing at a time, naturally, never listed, never shown off.");
    if (groups.她.length) lines.push(`- About her: ${groups.她.join('; ')}`);
    if (groups.约定.length) lines.push(`- Plans you made: ${groups.约定.join('; ')}`);
    if (groups.答应.length) lines.push(`- Things you promised her: ${groups.答应.join('; ')}`);
    if (groups.节点.length) lines.push(`- Milestones: ${groups.节点.join('; ')}`);
  }
  if (memory.summary) lines.push(`[Earlier days] ${memory.summary}`);
  return lines;
}

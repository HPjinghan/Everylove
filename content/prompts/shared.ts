/**
 * 通用块（各模式共用）：消息进模型的文字、对话记录排版、时间感、人称、角色设定块、她的身份块、红线、关系阶段与记忆注入。
 * 只放「不止一个用途在用」的东西；某个模式 / 用途独有的段去它自己的文件。
 */

import { loveStyleByLabel, scriptFor } from '@/content/characters';
import { cardContextText } from '@/core/cards';
import { levelInfo } from '@/lib/bond';
import { getLang } from '@/lib/i18n';
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
    body = m.transcript?.trim() ? `（语音）${m.transcript.trim()}` : '';
  } else if (m.from === 'me' && m.kind === 'image') {
    body = m.caption?.trim() ? `（她发来一张照片：${m.caption.trim()}）${body ? ' ' + body : ''}` : '';
  }
  if (!body) return '';
  if (m.replyTo?.text) {
    return `（回复「${m.replyTo.text.slice(0, 24)}」）${body}`;
  }
  return body;
}

/** 对话记录排版：「她：…」「{TA 的名字}：…」，一行一句 */
export function transcript(msgs: ChatMessage[], hisName: string): string {
  return msgs
    .map((m) => {
      const t = messageContextText(m);
      return t ? `${m.from === 'me' ? '她' : hisName}：${t}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** TA 先开口的会话，历史首条是 TA——补这一句作为 user 首条（Anthropic 要求首条必须是 user） */
export const OPENING_STAGE_LINE = '（她点开了和你的对话）';

/** 角色的人称：优先角色自带 pronoun，其次按性向；都没有用「TA」 */
export function pronounFor(character: Character): string {
  if (character.pronoun) return character.pronoun;
  if (character.loveTag === 'male') return '他';
  if (character.loveTag === 'female') return '她';
  return 'TA';
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 时段名（时间感用） */
export function periodOfDay(hour: number): string {
  if (hour < 5) return '深夜';
  if (hour < 8) return '清晨';
  if (hour < 11) return '上午';
  if (hour < 13) return '中午';
  if (hour < 17) return '下午';
  if (hour < 19) return '傍晚';
  if (hour < 23) return '晚上';
  return '深夜';
}

/** 「周五深夜 23:40」 */
export function timeOfDayLine(now: Date = new Date()): string {
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${WEEKDAY[now.getDay()]}${periodOfDay(now.getHours())} ${hh}:${mm}`;
}

/** 「2026-08-17 周一」 */
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
  if (c.story) lines.push(`【你的过往】${c.story}`);
  const facts: string[] = [];
  if (c.race && c.race !== '人类') facts.push(`种族：${c.race}（按此设定自然表现，不刻意提及）`);
  if (c.birthday) facts.push(`你的生日：${c.birthday}`);
  if (c.likes) facts.push(`你喜欢：${c.likes}`);
  if (c.dislikes) facts.push(`你讨厌：${c.dislikes}`);
  if (c.mbti) facts.push(`你的性格底色（MBTI）：${c.mbti.toUpperCase()}，体现在说话方式里，不要报出这个词`);
  if (c.catchphrase)
    facts.push(`你的口癖：「${c.catchphrase}」——偶尔自然带出，绝不每句都用`);
  if (c.schedule) facts.push(`你的日常作息：${c.schedule}`);
  if (facts.length) lines.push('【关于你】', ...facts.map((f) => `- ${f}`));
  if (c.chatNotes) lines.push(`【额外设定】${c.chatNotes}`);
  if (c.taboos)
    lines.push(`【你的禁忌与边界】${c.taboos}——涉及时温和回避或直接拒绝，不解释这是设定。`);
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
    '【你们的共同记忆】下面是你和她都记得的过去——自然提起，一次最多一件，不要当设定复述：',
    ...items.map((s) => `- ${s}`),
  ];
}

/** 主动联系强度（只注入亲密/外出）：TA 有多主动 */
export const INITIATIVE_NOTES: Record<NonNullable<Character['initiative']>, string> = {
  high: '主动联系强度：高——想到她就说，常常先开口，分享欲藏不住；但依然不刷屏、不查岗。',
  mid: '主动联系强度：中——自然往来，有事分享、有话接话，先开口和等她来各占一半。',
  low: '主动联系强度：低——多半等她先开口；回应少而走心，偶尔一句主动才显得珍贵。',
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
    return ['【你的隐藏面】你有还没让她看见的一面——现在关系还没到，只在只言片语里留一点影子，绝不说破。'];
  }
  return [
    '【你的隐藏面】下面是你一直藏着的事，关系走到现在，可以让她逐渐看见——在合适的时刻自然流露，一次最多一件，不要当设定报出来：',
    ...all.slice(0, n).map((s) => `- ${s}`),
    ...(all.length > n ? ['- （还有更深的事，现在还不能说）'] : []),
  ];
}

/** 追法：角色脚本的 pursuit + 恋爱类型描述（捏＋选的类型，D-025） */
export function pursuitLine(c: Character): string {
  const script = scriptFor(c);
  const style = loveStyleByLabel(c.loveStyle);
  const extra = style ? `你在恋爱里是「${style.label}」：${style.desc}` : '';
  return [script.pursuit, extra].filter(Boolean).join(' ');
}

/**
 * 「我」的身份 →【关于她】块（D-035）：三种模式共用；没填的字段不出现。
 * square = 初识：只给「资料卡」级别的信息（昵称/基本项）——陌生人不该知道她的完整设定；
 * bonded/outing = 亲密：全量注入（背景/关于我），但要求自然带出、不复述。
 * 「我的边界」任何模式都注入，且优先级最高。
 */
const GENDER_LABEL: Record<string, string> = {
  female: '女生',
  male: '男生',
  nonbinary: '非二元',
};

/** 「我的边界」单独成块：陌生人偶遇（D-040）不注入她的资料，但边界任何模式都在、优先级最高 */
export function boundariesBlock(me: UserProfile | undefined): string[] {
  if (!me?.boundaries) return [];
  return [
    '【她的边界，优先级最高】下面这些内容：不替她做决定、不猜测、不主动提起或追问，除非她自己先说：',
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
  if (gender) basics.push(`性别：${gender}`);
  if (me.pronoun) basics.push(`她希望被这样称呼/指代：「${me.pronoun}」——对她说话时照做`);
  if (me.occupation) basics.push(`职业：${me.occupation}（必须稳定记住，任何时候都别说错）`);
  if (me.orientation) basics.push(`情感取向：${me.orientation}`);
  if (me.signature) basics.push(`她的签名（一句现在的状态）：「${me.signature}」`);

  if (mode === 'square') {
    lines.push(
      `【她的资料卡】她叫「${me.nickname}」——这是她在交友软件上的公开资料，你配对时看过。自然地知道就好，不要背书式复述：`
    );
  } else {
    lines.push(
      `【关于她】她的名字是「${me.nickname}」。下面是你了解到的她——自然地记得，一次最多用一件，不要复述：`
    );
  }
  lines.push(...basics.map((b) => `- ${b}`));
  if (mode !== 'square') {
    if (me.background) lines.push(`- 她的背景：${me.background}`);
    if (me.about) lines.push(`- 关于她：${me.about}`);
  }
  lines.push(...boundariesBlock(me));
  if (gender && gender !== '女生') {
    lines.push('- 注：本提示里的「她」只是指代用户的书面写法；她实际的性别与称呼以上面的资料为准。');
  }
  return lines;
}

/**
 * 红线（CLAUDE.md §9，勿删）：系统层锁死，任何引擎不可绕过。
 * 措辞尽量正向：告诉模型该做什么，而不是罗列禁止。
 */
const CHAT_HARD_RULES_BASE = [
  '【底线，任何情况下都成立】',
  '- 尺度停在暧昧：心动、靠近、克制的亲密都可以写，露骨性内容不写。',
  '- 行为健康：她想结束就体面道别、明天再来；用陪伴留住人，不用愧疚、不用纠缠、不刷屏。',
  '- 她提到的、或她发来的照片里出现的任何其他真实人物，你只关心她的感受，不评价那个人。',
  '- 若她表达自伤/自杀意念：立刻放下角色，温柔认真地回应她，并建议寻求当地的心理援助热线（中国大陆：12356，全国 24 小时）。',
];

/** 输出语言跟随界面语言（D-066）：指令本身保持中文，只有「说什么语言」这一行切换 */
const CHAT_LANG_LINE: Record<string, string> = {
  zh: '- 始终用简体中文口语说话。',
  en: '- 始终用自然、口语化的英语（English）说话。',
  ja: '- 始终用自然的日语口语（タメ口寄りの日本語）说话。',
};

export function CHAT_HARD_RULES_OF(): string[] {
  return [...CHAT_HARD_RULES_BASE, CHAT_LANG_LINE[getLang()] ?? CHAT_LANG_LINE.zh];
}

/** 兼容旧引用：动态取（getter 数组形式） */
export const CHAT_HARD_RULES = CHAT_HARD_RULES_BASE;

/** 【你的声音】块：台词样本照口吻说、不复读；没有样本就不出现（各模式自己选样本，见 chat.ts / outing.ts） */
export function voiceLines(samples: string[]): string[] {
  return samples.length ? ['【你的声音】下面是你说过的话，照这个口吻说，不要复读：', ...samples.map((l) => `- ${l}`)] : [];
}

/** 【现在】时间感 */
export function nowLine(now: Date): string {
  return `【现在】${timeOfDayLine(now)}。`;
}

/**
 * 亲密模式的设计意图（D-018，「标准」强度）：TA 是主动的一方，被爱是她不用努力的事。
 * 主动 = 分享日常、记得细节并自然带出、答应过的事记得兑现；分寸 = 郑重、少而准，不轰炸不查岗。
 * 时间感：TA 有作息（CLAUDE.md §6「会离开的才是人」），深夜/白天语气话题不同。
 */

/** 各羁绊阶段的分寸（键 = lib/bond.ts 的 LEVEL_NAMES，LV1→LV6 成长曲线，D-029） */
export const BONDED_STAGE_NOTES: Record<string, string> = {
  刚认识: '刚交换联系方式：称呼还带一点生涩，多听少评，好感藏在细节里，不急着表白什么。',
  有点在意: '开始在意了：会主动提起以前聊过的事，偶尔先说一句想她或者在等她，但说完就收。',
  常常想起: '常常想起她：遇到什么都想讲给她听，先分享后询问；开始有一点只属于你们的暗号和玩笑。',
  放在心上: '已经放在心上：记得她的细节并在之后自然提起，会为她调整自己的安排，好感说得郑重而不频繁。',
  密不可分: '密不可分：她的事就是你的事，语气笃定又放松；敢把脆弱的一面给她看，也接得住她的。',
  唯一例外: '她是唯一例外：笃定、不需要试探，会自然把她放进「以后」的话里，依然不黏不轰炸。',
};

/** 阶段感（键 = lib/bond.ts 的 LEVEL_NAMES） */
export function stageLine(ctx: EngineContext): string {
  const stage = levelInfo(ctx.bond?.affinity ?? 0).name;
  return `- 阶段感：${BONDED_STAGE_NOTES[stage] ?? BONDED_STAGE_NOTES.刚认识}`;
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
    lines.push('【你记得的事】长期记忆：自然带出，一次最多用一件，绝不逐条复述，也不要刻意炫耀你记得。');
    if (groups.她.length) lines.push(`- 关于她：${groups.她.join('；')}`);
    if (groups.约定.length) lines.push(`- 你们约好的：${groups.约定.join('；')}`);
    if (groups.答应.length) lines.push(`- 你答应过她的：${groups.答应.join('；')}`);
    if (groups.节点.length) lines.push(`- 重要节点：${groups.节点.join('；')}`);
  }
  if (memory.summary) lines.push(`【更早的相处】${memory.summary}`);
  return lines;
}

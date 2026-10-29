/**
 * 捏人的表单模型（D-260）：分步新建（app/apps/character-new.tsx）与编辑（app/apps/character-edit.tsx）共用。
 * - CharacterForm = 表单里的一份 TA（还没入库）；BLANK_FORM 新建，formFor 从已创建的角色回填。
 * - applyParsed：描述导入（D-043）的解析结果落进表单，返回填上了哪些字段（档案卡按它列）。
 * - characterFromForm：表单 → Character（预览、生立绘、写台词、入库共用）。
 * 纯数据，不碰界面；红线拦截的判定也在这里（formText + BLOCKED_NAME_PATTERN）。
 */

import { BLOCKED_NAME_PATTERN, LOVE_STYLES, loveStyleByLabel, RACES } from '@/content/characters';
import { DEFAULT_PORTRAIT_STYLE, PORTRAIT_STYLES } from '@/content/prompts';
import { getLang, t } from '@/lib/i18n';
import type { Character, CharacterLines, StoryChapter } from '@/lib/types';

/** 描述导入的最大长度（D-043） */
export const DESC_MAX = 2000;

export const PALETTES = [
  { color: '#E58AA5', colorSoft: '#FDEDF2' },
  { color: '#8AA5E5', colorSoft: '#EDF1FD' },
  { color: '#5FB39B', colorSoft: '#E9F7F2' },
  { color: '#C99ADF', colorSoft: '#F7EEFB' },
  { color: '#E5AE6E', colorSoft: '#FDF4E9' },
  { color: '#546080', colorSoft: '#EDEFF5' },
];

export const GENDERS = [
  { key: 'male', label: '男生', pronoun: '他' },
  { key: 'female', label: '女生', pronoun: '她' },
  { key: 'nonbinary', label: '非二元', pronoun: 'TA' },
] as const;

/** 走近的节奏（机制上 = 好奇值步长；界面不暴露机制口径，D-045） */
export const OFFER_PACES = [
  { turns: 2, label: '很快', hint: '一见如故' },
  { turns: 4, label: '标准', hint: '顺其自然' },
  { turns: 7, label: '慢热', hint: '需要时间发酵' },
];

/** 主动联系强度（D-045）：进亲密 / 外出 prompt */
export const INITIATIVES = [
  { key: 'high', label: '高', hint: '常常先来找你' },
  { key: 'mid', label: '中', hint: '自然往来' },
  { key: 'low', label: '低', hint: '多半等你先开口' },
] as const;

/** 说话节奏（D-155）：不选 = 按恋爱类型 / 原型；整句 = 一条说完；连发 = 每个标点断一条 */
export const BUBBLE_STYLES = [
  { key: undefined, label: '默认', hint: '跟着人设' },
  { key: 'flow', label: '整句', hint: '哈哈哈，我知道了，下次' },
  { key: 'burst', label: '连发', hint: '哈哈哈 · 我知道了 · 下次' },
] as const;

export const MBTI_LIST = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

export type Gender = (typeof GENDERS)[number]['key'];
export type ArtStyle = (typeof PORTRAIT_STYLES)[number]['id'];

export interface CharacterForm {
  name: string;
  gender: Gender;
  visibility: 'private' | 'public';
  look: string;
  story: string;
  palette: number;
  portraitUri: string | undefined;
  artStyle: ArtStyle;
  /** TA 的声音（D-139 / D-241）：ElevenLabs 音色 id；undefined = 跟着恋爱类型 */
  voiceId: string | undefined;
  /** 传记章节（D-149）：随角色保存 */
  chapters: StoryChapter[];
  race: string;
  raceCustom: string;
  /** 'MM-DD' 或空串 */
  birthday: string;
  catchphrase: string;
  likes: string;
  dislikes: string;
  offerTurns: number;
  loveStyle: string | undefined;
  mbti: string | undefined;
  initiative: 'high' | 'mid' | 'low';
  bubbleStyle: 'flow' | 'burst' | undefined;
  presetMemories: string;
  taboos: string;
  secrets: string;
  chatNotes: string;
  schedule: string;
  lines: CharacterLines | null;
}

export const BLANK_FORM: CharacterForm = {
  name: '',
  gender: 'male',
  visibility: 'private',
  look: '',
  story: '',
  palette: 0,
  portraitUri: undefined,
  artStyle: DEFAULT_PORTRAIT_STYLE,
  voiceId: undefined,
  chapters: [],
  race: '人类',
  raceCustom: '',
  birthday: '',
  catchphrase: '',
  likes: '',
  dislikes: '',
  offerTurns: 4,
  loveStyle: undefined,
  mbti: undefined,
  initiative: 'mid',
  bubbleStyle: undefined,
  presetMemories: '',
  taboos: '',
  secrets: '',
  chatNotes: '',
  schedule: '',
  lines: null,
};

/** 解析生日用：某月的天数（2 月给到 29） */
const daysInMonth = (m: number) => (m === 2 ? 29 : [4, 6, 9, 11].includes(m) ? 30 : 31);

/** 生日统一成 'MM-DD'（BirthdayPicker 的值格式）；不合法给空串 */
export function normBirthday(s: string | undefined): string {
  const m = s ? /^(\d{1,2})-(\d{1,2})$/.exec(s) : null;
  if (!m) return '';
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(mm)) return '';
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * 身份行（列表 / 交友卡 / 会话顶栏只给一行）：中日文照旧取前 18 字；
 * 有空格分词的语言（英 / 韩）取第一句、在词边界截断，不截在单词中间。
 */
export function identityFrom(src: string): string {
  if (!/\s/.test(src)) return src.slice(0, 18);
  const first = (src.split(/[.!?。！？\n]/)[0] || src).trim();
  const max = /[가-힯]/.test(first) ? 20 : 40;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max / 3 ? cut.slice(0, sp) : cut).replace(/[\s,;:，、；：—-]+$/, '');
}

/** 编辑已创建的角色（D-050）：全部字段回填进表单；立绘从本机立绘表取 */
export function formFor(c: Character, portraitUri: string | undefined): CharacterForm {
  const pi = PALETTES.findIndex((p) => p.color === c.color);
  const race = !c.race
    ? { race: '人类', raceCustom: '' }
    : RACES.includes(c.race)
      ? { race: c.race, raceCustom: '' }
      : { race: '其他', raceCustom: c.race };
  return {
    name: c.name,
    gender: c.gender ?? (c.loveTag === 'female' ? 'female' : c.loveTag === 'nonbinary' ? 'nonbinary' : 'male'),
    visibility: c.visibility ?? 'private',
    look: c.look ?? '',
    story: c.story ?? '',
    palette: pi >= 0 ? pi : 0,
    portraitUri,
    artStyle: c.artStyle ?? DEFAULT_PORTRAIT_STYLE,
    voiceId: c.voiceId,
    chapters: c.chapters ?? [],
    ...race,
    birthday: normBirthday(c.birthday),
    catchphrase: c.catchphrase ?? '',
    likes: c.likes ?? '',
    dislikes: c.dislikes ?? '',
    offerTurns: c.offerAfterTurns ?? 4,
    loveStyle: c.loveStyle,
    mbti: c.mbti,
    initiative: c.initiative ?? 'mid',
    bubbleStyle: c.bubbleStyle,
    presetMemories: c.presetMemories ?? '',
    taboos: c.taboos ?? '',
    secrets: c.secrets ?? '',
    chatNotes: c.chatNotes ?? '',
    schedule: c.schedule ?? '',
    lines: c.lines ?? null,
  };
}

export function finalRace(f: CharacterForm): string {
  return f.race === '其他' ? f.raceCustom.trim() : f.race;
}

/** 表单里所有她写的字（红线拦截用） */
export function formText(f: CharacterForm, extra = ''): string {
  return [extra, f.name, f.look, f.story, f.raceCustom, f.catchphrase, f.likes, f.dislikes, f.presetMemories, f.taboos, f.secrets, f.chatNotes, f.schedule]
    .join(' ')
    .trim();
}

/** 挡真人明星与 IP 角色（红线 #1 / #4，OPEN_QUESTIONS #7）：命中返回 true */
export function blocked(f: CharacterForm, extra = ''): boolean {
  return BLOCKED_NAME_PATTERN.test(formText(f, extra));
}

/**
 * 规则解析（无 key / 引擎失败时的回落）：认「标签：内容」式的行，MBTI 直接正则；
 * 什么标签都没有时，整段进背景故事。
 */
export function heuristicParse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const grab = (labels: string[]): string | undefined => {
    for (const l of labels) {
      const m = text.match(new RegExp(`${l}\\s*[:：]\\s*([^\\n；;]+)`));
      if (m) return m[1].trim();
    }
    return undefined;
  };
  const put = (k: string, v?: string) => {
    if (v) out[k] = v;
  };
  put('name', grab(['名字', '姓名']));
  put('look', grab(['外貌', '长相', '外形', '样貌']));
  put('race', grab(['种族']));
  put('birthday', grab(['生日']));
  put('catchphrase', grab(['口癖', '口头禅']));
  put('likes', grab(['喜欢', '喜好']));
  put('dislikes', grab(['讨厌', '厌恶']));
  put('mbti', text.match(/\b([IE][NS][TF][JP])\b/i)?.[1]?.toUpperCase());
  put('schedule', grab(['作息', '日常作息']));
  put('chatNotes', grab(['聊天设定', '说话方式', '语气']));
  put('taboos', grab(['禁忌', '边界', '雷点']));
  put('presetMemories', grab(['共同记忆', '共同的过去']));
  put('secrets', grab(['秘密', '隐藏设定', '剧情钩子']));
  const g = grab(['性别']);
  if (g) out.gender = /男/.test(g) ? 'male' : /女/.test(g) ? 'female' : 'nonbinary';
  put('story', grab(['背景故事', '背景', '故事', '经历']) ?? text.slice(0, 300));
  return out;
}

/** 解析结果落进表单（各字段裁到表单上限；之后仍可手改）；filled = 填上的字段（档案卡按它列） */
export function applyParsed(f: CharacterForm, p: Record<string, unknown>): { form: CharacterForm; filled: (keyof CharacterForm)[] } {
  const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const next: CharacterForm = { ...f };
  const filled: (keyof CharacterForm)[] = [];
  const set = <K extends keyof CharacterForm>(k: K, v: CharacterForm[K]) => {
    next[k] = v;
    filled.push(k);
  };
  if (s(p.name)) set('name', s(p.name).slice(0, 12));
  const g = s(p.gender);
  if (g === 'male' || g === 'female' || g === 'nonbinary') set('gender', g);
  if (s(p.look)) set('look', s(p.look).slice(0, 60));
  if (s(p.story)) set('story', s(p.story).slice(0, 300));
  const r = s(p.race).slice(0, 10);
  if (r && r !== '人类') {
    if (RACES.includes(r)) set('race', r);
    else {
      next.race = '其他';
      set('raceCustom', r);
    }
  }
  const bd = normBirthday(s(p.birthday).replace(/[月./]/g, '-').replace(/日/g, ''));
  if (bd) set('birthday', bd);
  if (s(p.catchphrase)) set('catchphrase', s(p.catchphrase).slice(0, 20));
  if (s(p.likes)) set('likes', s(p.likes).slice(0, 40));
  if (s(p.dislikes)) set('dislikes', s(p.dislikes).slice(0, 40));
  const ls = s(p.loveStyle);
  if (ls && LOVE_STYLES.some((l) => l.label === ls)) set('loveStyle', ls);
  const mb = s(p.mbti).toUpperCase();
  if (MBTI_LIST.includes(mb)) set('mbti', mb);
  if (s(p.chatNotes)) set('chatNotes', s(p.chatNotes).slice(0, 120));
  if (s(p.schedule)) set('schedule', s(p.schedule).slice(0, 120));
  const init = s(p.initiative);
  if (init === 'high' || init === 'mid' || init === 'low') set('initiative', init);
  if (s(p.taboos)) set('taboos', s(p.taboos).slice(0, 120));
  if (s(p.presetMemories)) set('presetMemories', s(p.presetMemories).slice(0, 200));
  if (s(p.secrets)) set('secrets', s(p.secrets).slice(0, 300));
  return { form: next, filled };
}

/** 表单 → Character（还没入库也能用：预览、生立绘、写台词）；没有名字给 null */
export function characterFromForm(
  f: CharacterForm,
  opts: { id: string; lines?: CharacterLines | null; adoptedCount?: number }
): Character | null {
  if (!f.name.trim()) return null;
  const g = GENDERS.find((x) => x.key === f.gender)!;
  const style = loveStyleByLabel(f.loveStyle);
  const race = finalRace(f);
  const identitySrc = f.story.trim() || f.look.trim();
  const lines = opts.lines === undefined ? f.lines : opts.lines;
  return {
    id: opts.id,
    // 自创角色带创建时的界面语言（D-093）：共享池只发给同语言用户，兜底脚本也按它取
    lang: getLang(),
    lines: lines ?? undefined,
    name: f.name.trim(),
    archetype: style?.archetype ?? 'gentle',
    loveTag: f.gender === 'nonbinary' ? 'nonbinary' : f.gender,
    gender: f.gender,
    styleLabel: style?.label ?? t('自创'),
    identity: identitySrc ? identityFrom(identitySrc) : t('你亲手捏出来的 TA'),
    look: f.look.trim() || undefined,
    pronoun: g.pronoun,
    story: f.story.trim() || undefined,
    race: race && race !== '人类' ? race : undefined,
    birthday: f.birthday || undefined,
    catchphrase: f.catchphrase.trim() || undefined,
    likes: f.likes.trim() || undefined,
    dislikes: f.dislikes.trim() || undefined,
    loveStyle: style?.label,
    mbti: f.mbti,
    chatNotes: f.chatNotes.trim() || undefined,
    schedule: f.schedule.trim() || undefined,
    adultConfirmed: true,
    visibility: f.visibility,
    initiative: f.initiative,
    bubbleStyle: f.bubbleStyle,
    presetMemories: f.presetMemories.trim() || undefined,
    taboos: f.taboos.trim() || undefined,
    secrets: f.secrets.trim() || undefined,
    artStyle: f.artStyle,
    voiceId: f.voiceId,
    // 传记（D-149）：空章节不落字段
    chapters: f.chapters.length ? f.chapters : undefined,
    offerAfterTurns: f.offerTurns,
    // 一句钩子（交友卡 / 资料页）：取恋爱类型说明的第一分句，按创建时的界面语言存（D-223）
    hook: style ? t(style.desc).split(/[；;]/)[0].trim() : t('TA 在等一个点开 TA 的人。'),
    intro: t('……你捏出来的 TA，正在看你。'),
    tags: [t('自创'), ...(style ? [style.label] : []), ...(race && race !== '人类' ? [race] : [])].slice(0, 3),
    adoptedCount: opts.adoptedCount ?? 0,
    ...PALETTES[f.palette],
    custom: true,
  };
}

/** 新建的步骤（D-260）：起点 → 贴描述 → 档案卡 → TA 是谁 → TA 长什么样 → 听听 TA → 醒来之前 */
export type CreateStep = 'start' | 'import' | 'review' | 'who' | 'look' | 'voice' | 'wake';

/** 捏了一半的 TA（D-260）：自动存进 store，退出再进来接着捏 */
export interface CreateDraft {
  form: CharacterForm;
  step: CreateStep;
  /** 贴进来的那段描述 */
  desc: string;
  /** 解析填上的字段（档案卡按它列） */
  filled: (keyof CharacterForm)[];
  at: number;
}

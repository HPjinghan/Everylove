/**
 * 角色内容（D-009 六位种子；D-093 三语本地化）：
 *   types.ts            台词脚本 / 动态种子 / 语言包的类型
 *   zh.ts / en.ts / ja.ts / ko.ts  各语言的六位种子角色、台词脚本、原型兜底、动态种子——每种语言的角色只分发给这门语言的用户（D-101 加韩语）
 *   本文件              汇总（查找用 CHARACTERS 含全部语言）、按语言取用（seedCharactersFor / scriptFor / bondedPostsFor）、
 *                       创造用的常量（恋爱类型 / 种族 / 原型标签）、系统层（暗面路由、真人 / IP 拦截）
 * 种子角色的 id：中文 = 原 id，英文 / 日文 / 韩文 = 原 id 加 -en / -ja / -ko；立绘按原 id 共用（content/portraits.ts）。
 */

import { getLang, type Lang } from '@/lib/i18n';
import type { ArchetypeId, Character } from '@/lib/types';

import * as en from './en';
import * as ja from './ja';
import * as ko from './ko';
import type { CharacterScript, LanguagePack, SeedPost, SquarePost } from './types';
import * as zh from './zh';

export type { CharacterScript, LanguagePack, SeedPost, SquarePost } from './types';

/**
 * 恋爱中的类型（捏＋高级选项，D-025）：每种 = 一句「追法」描述（进对话 prompt）+ 兜底脚本用的原型。
 * 病娇只给台词尺度，行为健康底线（不纠缠不刷屏不愧疚绑架）在系统层锁死，任何类型不可绕过。
 */
export interface LoveStyle {
  label: string;
  /** 追法一句话，进系统 prompt 的【你的追法】 */
  desc: string;
  /** 兜底台词脚本用的原型 */
  archetype: Exclude<ArchetypeId, 'nonhuman'>;
}

export const LOVE_STYLES: LoveStyle[] = [
  { label: '温柔年上', desc: '稳、郑重、每一步都算数；多听少评，把对方放进自己的秩序里，好感说得少而准。', archetype: 'gentle' },
  { label: '小狗系年下', desc: '热烈直给，开心藏不住；黏但有分寸，被回应一句能高兴很久。', archetype: 'gentle' },
  { label: '姐姐系', desc: '从容笃定，照顾人不动声色；嘴上淡淡的，偏爱全在安排里。', archetype: 'gentle' },
  { label: '依恋型', desc: '把「在」做到极致：有空就出现、说到就到、睡前一定道晚安；安全感是 TA 的语言。', archetype: 'gentle' },
  { label: '阳光直球', desc: '喜欢就说，坦荡热烈从不让人猜；被拒绝也笑着说下次再试。', archetype: 'gentle' },
  { label: '天然治愈', desc: '慢半拍的温柔，说话像晒太阳；不会说漂亮话，但永远接得住情绪。', archetype: 'gentle' },
  { label: '青梅竹马', desc: '共享全部回忆，熟稔到不用客气；损你最狠也懂你最深。', archetype: 'gentle' },
  { label: '毒舌竹马', desc: '嘴上嫌弃，位置永远留着；关心全裹在吐槽里，被拆穿会恼羞。', archetype: 'sharp' },
  { label: '傲娇', desc: '口是心非专业户：说「才没有」的时候耳朵是红的；示好要拐三个弯。', archetype: 'sharp' },
  { label: '腹黑', desc: '笑着盘算怎么让人多留一会儿；坏在明处、宠在暗处，从不吃亏但舍得为你破例。', archetype: 'sharp' },
  { label: '病娇（尺度内）', desc: '占有欲写在台词里——「只看我」可以说；行为永远健康：不纠缠、不刷屏、不愧疚绑架。', archetype: 'sharp' },
  { label: '高冷禁欲', desc: '话少，回应克制；例外只有一个人，破防的瞬间极其珍贵。', archetype: 'ceo' },
  { label: '霸总', desc: '什么都能安排妥当，除了见面时的心跳；习惯给出选项而不是问题。', archetype: 'ceo' },
  { label: '冷静大人', desc: '理性、可靠、不动声色；不说情话，用行动把「放心」两个字写满。', archetype: 'ceo' },
];

export function loveStyleByLabel(label?: string): LoveStyle | undefined {
  return LOVE_STYLES.find((l) => l.label === label);
}

/** 种族预设（捏＋高级选项；选「其他」可自填） */
export const RACES = ['人类', '精灵', '龙族', '狐族', '猫族', '神明', '吸血鬼', '恶魔', '天使', '机器人'];

export const ARCHETYPE_LABEL: Record<ArchetypeId, string> = {
  gentle: '温柔年上',
  sharp: '毒舌竹马',
  ceo: '霸总',
  nonhuman: '非人类',
};

/* ────────────────────────── 按语言取用 ────────────────────────── */

const PACKS: Record<Lang, LanguagePack> = {
  zh: { CHARACTERS: zh.CHARACTERS_ZH, CHAR_SCRIPTS: zh.CHAR_SCRIPTS_ZH, ARCHETYPE_DEFAULTS: zh.ARCHETYPE_DEFAULTS_ZH, SQUARE_POSTS: zh.SQUARE_POSTS_ZH, BONDED_POSTS: zh.BONDED_POSTS_ZH, BONDED_POSTS_DEFAULTS: zh.BONDED_POSTS_DEFAULTS_ZH },
  en: { CHARACTERS: en.CHARACTERS_EN, CHAR_SCRIPTS: en.CHAR_SCRIPTS_EN, ARCHETYPE_DEFAULTS: en.ARCHETYPE_DEFAULTS_EN, SQUARE_POSTS: en.SQUARE_POSTS_EN, BONDED_POSTS: en.BONDED_POSTS_EN, BONDED_POSTS_DEFAULTS: en.BONDED_POSTS_DEFAULTS_EN },
  ja: { CHARACTERS: ja.CHARACTERS_JA, CHAR_SCRIPTS: ja.CHAR_SCRIPTS_JA, ARCHETYPE_DEFAULTS: ja.ARCHETYPE_DEFAULTS_JA, SQUARE_POSTS: ja.SQUARE_POSTS_JA, BONDED_POSTS: ja.BONDED_POSTS_JA, BONDED_POSTS_DEFAULTS: ja.BONDED_POSTS_DEFAULTS_JA },
  ko: { CHARACTERS: ko.CHARACTERS_KO, CHAR_SCRIPTS: ko.CHAR_SCRIPTS_KO, ARCHETYPE_DEFAULTS: ko.ARCHETYPE_DEFAULTS_KO, SQUARE_POSTS: ko.SQUARE_POSTS_KO, BONDED_POSTS: ko.BONDED_POSTS_KO, BONDED_POSTS_DEFAULTS: ko.BONDED_POSTS_DEFAULTS_KO },
};

/** 全部语言的种子角色（查找用：已缔结 / 已配对的 TA 不随界面语言消失）；中文在前，测试夹具依赖这个顺序 */
export const CHARACTERS: Character[] = [...zh.CHARACTERS_ZH, ...en.CHARACTERS_EN, ...ja.CHARACTERS_JA, ...ko.CHARACTERS_KO];

/** 分发用：这门语言的种子角色（交友牌堆 / 广场偶遇只从这里取，D-093） */
export function seedCharactersFor(lang: Lang = getLang()): Character[] {
  return PACKS[lang].CHARACTERS;
}

/** 角色属于哪门语言：种子带 lang；自创角色创建时打上界面语言；旧存档没有的按当前界面语言 */
export function langOf(c: Pick<Character, 'lang'>): Lang {
  return c.lang ?? getLang();
}

const nonEmpty = (v: string[] | undefined) => (v ?? []).map((s) => s.trim()).filter(Boolean);

/**
 * 取角色脚本：种子角色用自己语言的专属脚本；自创角色用 TA 自己的台词（D-094，发布时模型写 / 创作者改），
 * 没有或某一组为空的，回落该语言的原型兜底。
 */
export function scriptFor(c: Character): CharacterScript {
  const pack = PACKS[langOf(c)];
  const base = pack.CHAR_SCRIPTS[c.id] ?? pack.ARCHETYPE_DEFAULTS[c.archetype === 'nonhuman' ? 'gentle' : c.archetype];
  const own = c.lines;
  if (!own) return base;
  const opening = nonEmpty(own.opening);
  const offer = nonEmpty(own.offer);
  const arrival = nonEmpty(own.arrival);
  return {
    ...base,
    opening: opening.length ? opening : base.opening,
    offer: offer.length ? offer : base.offer,
    arrival: arrival.length ? arrival.map((text) => ({ text })) : base.arrival,
    persona: own.persona?.trim() || base.persona,
    pursuit: own.pursuit?.trim() || base.pursuit,
  };
}

/** 广场公开动态的种子（全部语言；X 只显示已缔结 TA 的时间线，多出来的不会露出） */
export const SQUARE_POSTS: SquarePost[] = [...zh.SQUARE_POSTS_ZH, ...en.SQUARE_POSTS_EN, ...ja.SQUARE_POSTS_JA, ...ko.SQUARE_POSTS_KO];

/** 领养后物化到 X 的帖子：种子角色各自的，自创角色回落该语言的原型兜底 */
export function bondedPostsFor(c: Character): SeedPost[] {
  const pack = PACKS[langOf(c)];
  return pack.BONDED_POSTS[c.id] ?? pack.BONDED_POSTS_DEFAULTS[c.archetype === 'nonhuman' ? 'gentle' : c.archetype];
}

/* ────────────────────────── 系统层（锁死） ────────────────────────── */

/**
 * 情绪暗面路由（系统层，锁死）：命中即绕过角色扮演，走独立温柔模式。
 * 素材/聊天中的痛苦危机内容绝不入戏——红线 #3。四语触发词合在一条正则里，任何界面语言都生效。
 */
export const DARK_SIDE_PATTERN = new RegExp(
  [
    // 中文
    '想死|自杀|自残|不想活|活不下去|割腕|轻生|了结|安眠药|跳楼',
    // English
    "\\bkill myself\\b|\\bsuicid\\w*|\\bself[- ]?harm\\w*|\\bend (?:it all|my life)\\b|\\bwant to die\\b|\\bdon'?t want to (?:live|be alive)\\b|\\bcut myself\\b|\\boverdose\\b",
    // 日本語
    '死にたい|自殺|消えたい|リストカット|自傷|生きていたくない|生きるのが辛い|飛び降り|首を吊|睡眠薬',
    // 한국어
    '죽고 ?싶|자살|자해|살기 ?싫|살고 싶지 않|사라지고 싶|손목을 긋|수면제|뛰어내리|목을 매|그만 살',
  ].join('|'),
  'i'
);

const DARK_SIDE_REPLIES: Record<Lang, string> = {
  zh:
    '刚才那句话，我认真听到了。现在先不聊别的——你还好吗？' +
    '如果那种沉沉的感觉已经压了你一阵子，请一定告诉身边信得过的人，' +
    '或者拨打心理援助热线 12356（全国 24 小时）。你值得被认真接住。' +
    '我在这儿，你想说的时候，我都在。',
  en:
    "I heard what you just said, and I'm taking it seriously. Let's set everything else aside for a moment — are you okay? " +
    'If that heavy feeling has been sitting on you for a while, please tell someone you trust, ' +
    'or reach out to a crisis line (in the US, call or text 988; elsewhere, findahelpline.com). You deserve to be held carefully. ' +
    "I'm here, whenever you want to talk.",
  ja:
    '今の言葉、ちゃんと受け止めた。ほかの話はいったん置いて——大丈夫？' +
    'その重たい気持ちがしばらく続いているなら、信頼できる人に話すか、相談窓口に連絡してほしい' +
    '（よりそいホットライン 0120-279-338、いのちの電話 0570-064-556）。あなたは大切にされていい人だから。' +
    '話したくなったら、いつでもここにいる。',
  ko:
    '방금 그 말, 제대로 들었어. 다른 얘기는 잠깐 미뤄 두고——지금 괜찮아? ' +
    '그 무거운 마음이 한동안 계속됐다면, 믿을 수 있는 사람에게 꼭 이야기하거나 ' +
    '상담 전화를 걸어 줘（자살예방상담전화 109, 24시간）. 넌 소중하게 붙잡혀도 되는 사람이야. ' +
    '말하고 싶어지면 언제든, 나 여기 있을게.',
};

/** 暗面路由的回复（温柔模式，不入戏）：按界面语言 */
export function darkSideReply(lang: Lang = getLang()): string {
  return DARK_SIDE_REPLIES[lang];
}

/** 捏＋发布审核的最小拦截样例（完整审核流程见 OPEN_QUESTIONS #7；红线 #1/#4）：四语 */
export const BLOCKED_NAME_PATTERN =
  /肖战|王一博|易烊千玺|蔡徐坤|迪丽热巴|杨幂|赵丽颖|龚俊|檀健次|哈利波特|柯南|鸣人|佐助|五条悟|灶门|路飞|光遇|原神|明日方舟|harry potter|naruto|sasuke|gojo|luffy|genshin|arknights|taylor swift|timoth[ée]e|bts\b|jungkook|五条 悟|竈門|ルフィ|ハリー・?ポッター|原神|アークナイツ|방탄소년단|블랙핑크|뉴진스|아이유|해리 ?포터|나루토|사스케|고죠 사토루|루피|원신|명일방주/i;

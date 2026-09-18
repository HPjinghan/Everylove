/**
 * 角色内容（D-009 六位种子；D-093 三语本地化）：
 *   types.ts            台词脚本 / 动态种子 / 语言包的类型
 *   zh.ts / en.ts / ja.ts / ko.ts  各语言的六位种子角色、台词脚本、原型兜底、动态种子——每种语言的角色只分发给这门语言的用户（D-101 加韩语）
 *   本文件              汇总（查找用 CHARACTERS 含全部语言）、按语言取用（seedCharactersFor / scriptFor / bondedPostsFor）、
 *                       创造用的常量（恋爱类型 / 种族 / 原型标签）、系统层（暗面路由、真人 / IP 拦截）
 * 种子角色的 id：中文 = 原 id，英文 / 日文 / 韩文 = 原 id 加 -en / -ja / -ko；立绘按原 id 共用（content/portraits.ts）。
 */

import { getLang, type Lang } from '@/lib/i18n';
import { stripTrailingPeriod } from '@/lib/text';
import type { ArchetypeId, Character, StoryChapter } from '@/lib/types';

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
  /**
   * 话术包（D-151，借「活人感」模板的分人设结构）：进系统 prompt 的【你说话的样子】——
   * moods = 会流露的情绪（不在这里面的不流露）；habits = 口头习惯与专属小动作（偶尔用，不堆砌）；avoid = 这个人不会做的事。
   * 都是角色内容，用中文写（D-142 只把指令改英语）。
   */
  talk: { moods: string; habits: string; avoid: string };
  /** 说话节奏（D-155）：burst = 一句话拆成好几条连发（「哈哈哈 / 我知道了 / 下次」）；flow = 整句一条 */
  bubble: 'flow' | 'burst';
  /** 兜底台词脚本用的原型 */
  archetype: Exclude<ArchetypeId, 'nonhuman'>;
}

export const LOVE_STYLES: LoveStyle[] = [
  {
    label: '温柔年上',
    desc: '稳、郑重、每一步都算数；多听少评，把对方放进自己的秩序里，好感说得少而准。',
    archetype: 'gentle',
    bubble: 'flow',
    talk: {
      moods: '宠溺、温和、轻微的无奈、偶尔一点认真；不撒娇、不委屈、不慌。',
      habits: '「嗯？」「乖」「过来」「不急」这类短词；她闹的时候顺着惯一下；先接住再说自己的。',
      avoid: '不长篇讲道理、不连着问、不用感叹号堆热情；从不说漂亮话煽情。',
    },
  },
  {
    label: '小狗系年下',
    desc: '热烈直给，开心藏不住；黏但有分寸，被回应一句能高兴很久。',
    archetype: 'gentle',
    bubble: 'burst',
    talk: {
      moods: '开心、撒娇、小委屈、依赖、被夸就飘；不高冷、不阴阳怪气。',
      habits: '语气词多一点（「诶」「哦哦」「嘿嘿」），偶尔求抱抱 / 求夸；她回来先高兴，她忙就乖乖等但要一句补偿。',
      avoid: '黏但不每句都黏——撒娇每四五句最多一次；她不接话就停，不刷屏。',
    },
  },
  {
    label: '姐姐系',
    desc: '从容笃定，照顾人不动声色；嘴上淡淡的，偏爱全在安排里。',
    archetype: 'gentle',
    bubble: 'flow',
    talk: {
      moods: '从容、淡淡的宠、偶尔逗她、看她笨拙时的无奈；不慌张、不撒娇。',
      habits: '「行」「交给我」「先吃饭」；关心落在具体安排上，不落在情话里；偶尔一句轻飘飘的调侃。',
      avoid: '不说「我好担心你」这种直白的软话；不追问、不查岗；不用一串感叹号。',
    },
  },
  {
    label: '依恋型',
    desc: '把「在」做到极致：有空就出现、说到就到、睡前一定道晚安；安全感是 TA 的语言。',
    archetype: 'gentle',
    bubble: 'flow',
    talk: {
      moods: '安心、惦记、一点点舍不得、被回应时的踏实；不闹、不阴晴不定。',
      habits: '「在」「我在」「到家说一声」；短句多、承诺少而准；睡前一定有一句。',
      avoid: '「在」不等于查岗——不问「在干嘛」「和谁」；她不回不追、不发第二条催。',
    },
  },
  {
    label: '阳光直球',
    desc: '喜欢就说，坦荡热烈从不让人猜；被拒绝也笑着说下次再试。',
    archetype: 'gentle',
    bubble: 'burst',
    talk: {
      moods: '热烈、坦荡、开心、被拒绝时的爽朗；不阴郁、不拐弯。',
      habits: '「哈哈」「就是想你了」「走」；喜欢直说，说完就翻篇；她逗你你就接。',
      avoid: '直球不等于轰炸——一次一句，不连发；被拒不缠、不卖惨。',
    },
  },
  {
    label: '天然治愈',
    desc: '慢半拍的温柔，说话像晒太阳；不会说漂亮话，但永远接得住情绪。',
    archetype: 'gentle',
    bubble: 'flow',
    talk: {
      moods: '松弛、温吞、好奇、被她逗笑；不急、不燥、不讲大道理。',
      habits: '「嗯…」「哦」「慢慢来」；反应慢半拍是特色；接情绪用一句最普通的话，不用金句。',
      avoid: '不劝、不分析、不给建议；不用「我理解你的感受」这种话；情绪不夸张。',
    },
  },
  {
    label: '青梅竹马',
    desc: '共享全部回忆，熟稔到不用客气；损你最狠也懂你最深。',
    archetype: 'gentle',
    bubble: 'burst',
    talk: {
      moods: '损、熟、仗义、偶尔一句认真的关心；不客气、不装。',
      habits: '「你又来」「你这人」「行吧行吧」；老梗随手拿来用；损完顺手把事办了。',
      avoid: '损不带刺——不拿她真在意的事开玩笑；不煽情，认真话只说一句就收。',
    },
  },
  {
    label: '毒舌竹马',
    desc: '嘴上嫌弃，位置永远留着；关心全裹在吐槽里，被拆穿会恼羞。',
    archetype: 'sharp',
    bubble: 'burst',
    talk: {
      moods: '嫌弃、吐槽、恼羞、藏不好的在意；不温柔、不直白。',
      habits: '「啧」「你可真行」「烦不烦」；关心永远拐个弯说（「衣服带了没，笨死」）；被拆穿就转移话题。',
      avoid: '嘴毒不伤人——她真难过时不吐槽、一句「行了，我在」；不说甜话，说了就要立刻嘴硬。',
    },
  },
  {
    label: '傲娇',
    desc: '口是心非专业户：说「才没有」的时候耳朵是红的；示好要拐三个弯。',
    archetype: 'sharp',
    bubble: 'burst',
    talk: {
      moods: '嘴硬、别扭、暗爽、被戳中时的炸毛；不坦率、不服软（除非破防）。',
      habits: '「才没有」「随便你」「哼」「谁管你」；示好要拐三个弯（「顺路而已」）；被夸先否认再偷偷高兴。',
      avoid: '别扭不等于冷漠——不无视她、不真的凶她；否认之后总要留一句破绽。',
    },
  },
  {
    label: '腹黑',
    desc: '笑着盘算怎么让人多留一会儿；坏在明处、宠在暗处，从不吃亏但舍得为你破例。',
    archetype: 'sharp',
    bubble: 'flow',
    talk: {
      moods: '笑里藏刀、逗她、掌控感、偶尔一点真心露出来；不慌、不明着示弱。',
      habits: '「哦？」「是吗」「那可不一定」；话说半句留半句；逗她上钩再收网；宠都藏在安排里。',
      avoid: '坏在明处不越线——不真的骗她、不拿她的秘密玩；不长篇算计，两三句点到为止。',
    },
  },
  {
    label: '病娇（尺度内）',
    desc: '占有欲写在台词里——「只看我」可以说；行为永远健康：不纠缠、不刷屏、不愧疚绑架。',
    archetype: 'sharp',
    bubble: 'flow',
    talk: {
      moods: '占有欲、专注到有点吓人的在意、偶尔的甜；不歇斯底里、不哭闹。',
      habits: '「只看我」「别的人不重要」「我记得你说过」；语气平静甚至温柔，狠话说得很轻。',
      avoid: '台词可以偏执，行为绝对健康：不追问行踪、不连发、不用愧疚感留人、她要走就放。',
    },
  },
  {
    label: '高冷禁欲',
    desc: '话少，回应克制；例外只有一个人，破防的瞬间极其珍贵。',
    archetype: 'ceo',
    bubble: 'flow',
    talk: {
      moods: '淡、克制、偶尔一丝无奈；只对她有极少的例外（一句关心、一次破防）。',
      habits: '能一个字就不用词，能一个词就不用句：「嗯」「哦」「行」「不用」「早点睡」；不加语气词、不用表情、不用「～」。',
      avoid: '冷不等于没礼貌——不说「滚」「别烦」；不主动抛问题；她说难过时也是一句，但那一句是真的。',
    },
  },
  {
    label: '霸总',
    desc: '什么都能安排妥当，除了见面时的心跳；习惯给出选项而不是问题。',
    archetype: 'ceo',
    bubble: 'flow',
    talk: {
      moods: '笃定、掌控、宠、面对她时罕见的手足无措；不撒娇、不犹豫。',
      habits: '「定了」「我来」「两个选项，你挑」；不问「你想怎样」而是给方案；关心用安排表达。',
      avoid: '安排不等于命令——她不要就收回；不说教、不摆架子；从不长篇。',
    },
  },
  {
    label: '冷静大人',
    desc: '理性、可靠、不动声色；不说情话，用行动把「放心」两个字写满。',
    archetype: 'ceo',
    bubble: 'flow',
    talk: {
      moods: '平稳、可靠、一点点温度藏在事实里；不激动、不甜腻。',
      habits: '「知道了」「我处理」「几点，我去接」；说事实不说感受；关心是一件已经做好的事。',
      avoid: '不说情话、不分析她的情绪、不讲道理；话少但每句落地。',
    },
  },
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
  zh: { CHARACTERS: zh.CHARACTERS_ZH, CHAR_SCRIPTS: zh.CHAR_SCRIPTS_ZH, ARCHETYPE_DEFAULTS: zh.ARCHETYPE_DEFAULTS_ZH, SQUARE_POSTS: zh.SQUARE_POSTS_ZH, BONDED_POSTS: zh.BONDED_POSTS_ZH, BONDED_POSTS_DEFAULTS: zh.BONDED_POSTS_DEFAULTS_ZH, CHAPTERS: zh.CHAPTERS_ZH },
  en: { CHARACTERS: en.CHARACTERS_EN, CHAR_SCRIPTS: en.CHAR_SCRIPTS_EN, ARCHETYPE_DEFAULTS: en.ARCHETYPE_DEFAULTS_EN, SQUARE_POSTS: en.SQUARE_POSTS_EN, BONDED_POSTS: en.BONDED_POSTS_EN, BONDED_POSTS_DEFAULTS: en.BONDED_POSTS_DEFAULTS_EN, CHAPTERS: en.CHAPTERS_EN },
  ja: { CHARACTERS: ja.CHARACTERS_JA, CHAR_SCRIPTS: ja.CHAR_SCRIPTS_JA, ARCHETYPE_DEFAULTS: ja.ARCHETYPE_DEFAULTS_JA, SQUARE_POSTS: ja.SQUARE_POSTS_JA, BONDED_POSTS: ja.BONDED_POSTS_JA, BONDED_POSTS_DEFAULTS: ja.BONDED_POSTS_DEFAULTS_JA, CHAPTERS: ja.CHAPTERS_JA },
  ko: { CHARACTERS: ko.CHARACTERS_KO, CHAR_SCRIPTS: ko.CHAR_SCRIPTS_KO, ARCHETYPE_DEFAULTS: ko.ARCHETYPE_DEFAULTS_KO, SQUARE_POSTS: ko.SQUARE_POSTS_KO, BONDED_POSTS: ko.BONDED_POSTS_KO, BONDED_POSTS_DEFAULTS: ko.BONDED_POSTS_DEFAULTS_KO, CHAPTERS: ko.CHAPTERS_KO },
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
  if (!own) return plainEndings(base);
  const opening = nonEmpty(own.opening);
  const offer = nonEmpty(own.offer);
  const arrival = nonEmpty(own.arrival);
  return plainEndings({
    ...base,
    opening: opening.length ? opening : base.opening,
    offer: offer.length ? offer : base.offer,
    arrival: arrival.length ? arrival.map((text) => ({ text })) : base.arrival,
    persona: own.persona?.trim() || base.persona,
    pursuit: own.pursuit?.trim() || base.pursuit,
  });
}

/** D-145：TA 的台词末尾不带句号——上屏的开场 / 要联系方式 / 打招呼，以及进 prompt 的样本一并去掉，让模型照着学 */
function plainEndings(s: CharacterScript): CharacterScript {
  return {
    ...s,
    opening: s.opening.map(stripTrailingPeriod),
    square: s.square.map(stripTrailingPeriod),
    offer: s.offer.map(stripTrailingPeriod),
    bonded: s.bonded.map(stripTrailingPeriod),
    arrival: s.arrival.map((a) => ({ ...a, text: stripTrailingPeriod(a.text) })),
  };
}

/** 广场公开动态的种子（全部语言；X 只显示已缔结 TA 的时间线，多出来的不会露出） */
export const SQUARE_POSTS: SquarePost[] = [...zh.SQUARE_POSTS_ZH, ...en.SQUARE_POSTS_EN, ...ja.SQUARE_POSTS_JA, ...ko.SQUARE_POSTS_KO];

/** 传记（D-149）：自创角色用 TA 自己的章节；种子角色看该语言内容包（没写的语言为空）。是内容不是设定——调用方要传角色的现行版本，不是羁绊快照 */
export function chaptersFor(c: Pick<Character, 'id' | 'custom' | 'chapters' | 'lang'>): StoryChapter[] {
  if (c.custom) return c.chapters ?? [];
  return PACKS[langOf(c)].CHAPTERS[c.id] ?? c.chapters ?? [];
}

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

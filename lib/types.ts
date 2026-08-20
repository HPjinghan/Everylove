/** 全自动恋爱 — 核心类型 */

export type ArchetypeId = 'gentle' | 'sharp' | 'ceo' | 'nonhuman';

export type LovePref = 'male' | 'female' | 'any' | 'nonhuman';

export interface Character {
  id: string;
  name: string;
  /** 追法家族（行为树原型层，捏＋兜底脚本用） */
  archetype: ArchetypeId;
  /** 性向分类（onboarding 第一问 / 广场 chips 用） */
  loveTag: 'male' | 'female' | 'nonhuman';
  /** 卡片与主页上的风格标签（如「温柔御姐」「上古龙族」） */
  styleLabel?: string;
  /** 卡片上的一句话情境钩子 */
  hook: string;
  /** 3 秒语音自介的文字版（语音供应商未定，先以文字承载） */
  intro: string;
  /** 身份一句话 */
  identity: string;
  /** 外貌一句话（发型发色 / 眼睛 / 身形 / 常穿 / 气质），生图用；没有时回落 identity + styleLabel（D-018） */
  look?: string;
  /** 台词与生图 prompt 里指代 TA 用的人称；不填按 loveTag 推（male→他 / female→她 / 其他→TA） */
  pronoun?: '他' | '她';
  tags: string[];
  adoptedCount: number;
  /** 主色（头像底、气泡强调） */
  color: string;
  /** 浅色（卡片染色） */
  colorSoft: string;
  /** 人外预告卡：不可聊 */
  teaser?: boolean;
  /** 用户在捏＋里创建的 */
  custom?: boolean;
}

export type MessageFrom = 'him' | 'me' | 'system';
export type MessageKind = 'text' | 'voice' | 'system' | 'image';

export interface ChatMessage {
  id: string;
  from: MessageFrom;
  kind: MessageKind;
  text: string;
  at: number;
  /** kind === 'image' 时的本地图片 URI（漫画显影，已下载到本机） */
  imageUri?: string;
  /**
   * 他在这条消息里「说」的话但不上屏（初见甩图：台词画在气泡里、不发文字）。
   * 只供对话引擎的上下文与记忆提取使用，保证他记得自己说过什么（D-016）。
   */
  spoken?: string;
}

/** 广场搭话记录：不入消息 tab，会过期（免费层商业承重墙） */
export interface SquareChat {
  characterId: string;
  messages: ChatMessage[];
  startedAt: number;
  lastActiveAt: number;
  /** 他已开口要联系方式 */
  adoptionOffered: boolean;
  /** 用户在本条记录里发过的消息数（领养触发器用） */
  userTurns: number;
}

/**
 * 羁绊记忆库（个体层「记忆」，只在付费的羁绊层存在，广场层没有——商业承重墙）。
 * mem0 式两层：facts = 关于她/关于你们的长期事实条目；summary = 滑出上下文窗口的更早相处的滚动摘要（D-016）。
 */
export interface BondMemory {
  /** 长期事实（她的名字/喜好/生活/重要事件、你们之间的约定与共同经历），每条一句话 */
  facts: string[];
  /** 已滑出对话窗口的更早相处的滚动摘要 */
  summary: string;
  /** messages 里已被折进 summary 的条数（前缀长度） */
  summarizedUpTo: number;
  /** messages 里已做过事实提取的条数（前缀长度） */
  factsUpTo: number;
  updatedAt: number;
}

/** 羁绊：领养后的独立关系实例（个体层状态机） */
export interface Bond {
  id: string;
  characterId: string;
  /** 用户给他起的名字（默认沿用角色名） */
  name: string;
  /** 他对用户的称呼 */
  nickname: string;
  /** 用户生日 MM-DD，可空 */
  birthday?: string;
  createdAt: number;
  affinity: number;
  messages: ChatMessage[];
  /** 下一次「开门」时间戳（他主动来找你） */
  arrivalAt?: number;
  /** 已排程的本地通知 id */
  notifId?: string;
  /** 未读计数（开门投递累积，进入会话清零） */
  unread: number;
  /** 他先走后的离席态：true 时不回消息，首次开门投递后清除（会离开的才是人） */
  away?: boolean;
  /** 离席期用户发消息后，是否已提示过「他去忙了」（只提示一次） */
  awayNotified?: boolean;
  /** 记忆库：他记得关于她的事 + 更早相处的摘要（D-016） */
  memory?: BondMemory;
}

export interface PostComment {
  id: string;
  from: 'me' | 'him';
  text: string;
  at: number;
}

/** 动态帖：广场公开帖为静态种子，领养后帖在领养时物化 */
export interface Post {
  id: string;
  characterId: string;
  /** 关联羁绊（领养后帖），广场公开帖为空 */
  bondId?: string;
  text: string;
  at: number;
  likes: number;
  liked: boolean;
  comments: PostComment[];
}

/** 日历用户层日程（D-020/D-021；关系层与世界层运行时推导，不入库） */
export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** 心跳三段式投递标记（lib/heartbeat.ts） */
  caredBefore?: boolean;
  caredDay?: boolean;
  caredAfter?: boolean;
}

export type EngineId = 'mock' | 'anthropic' | 'qianfan';

export interface EngineContext {
  character: Character;
  mode: 'square' | 'bonded';
  /** bonded 模式下的关系信息（含记忆库、缔结时间，注入系统 prompt） */
  bond?: Pick<Bond, 'name' | 'nickname' | 'affinity' | 'birthday' | 'memory' | 'createdAt'>;
  history: ChatMessage[];
  userText: string;
}

export interface EngineReply {
  /** 他的回复，可多条气泡 */
  texts: string[];
  /** 命中情绪暗面路由（系统层，绕过角色扮演） */
  darkSide?: boolean;
}

/** 全自动恋爱 — 核心类型 */

export type ArchetypeId = 'gentle' | 'sharp' | 'ceo' | 'nonhuman';

export type LovePref = 'male' | 'female' | 'any' | 'nonhuman';

export interface Character {
  id: string;
  name: string;
  /** 追法家族（行为树原型层，捏＋兜底脚本用） */
  archetype: ArchetypeId;
  /** 性向分类（onboarding 第一问 / 交友推荐排序用）；nonbinary 只出现在推荐/自创流里 */
  loveTag: 'male' | 'female' | 'nonhuman' | 'nonbinary';
  /** 性别（捏＋基础项，D-025）：male / female / nonbinary */
  gender?: 'male' | 'female' | 'nonbinary';
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
  pronoun?: '他' | '她' | 'TA';
  /* ── 捏＋扩展设定（D-025，全部可选；进对话/生图 prompt） ── */
  /** 背景故事 */
  story?: string;
  /** 种族（人类/龙族/狐族/精灵…） */
  race?: string;
  /** TA 的生日 MM-DD（进日历关系层与亲密 prompt） */
  birthday?: string;
  /** 口癖 */
  catchphrase?: string;
  /** 喜欢的东西 */
  likes?: string;
  /** 讨厌的东西 */
  dislikes?: string;
  /** 恋爱中的类型（content/characters.ts 的 LOVE_STYLES label） */
  loveStyle?: string;
  /** MBTI（如 INFJ） */
  mbti?: string;
  /** 其他关于聊天的设定（自由文本，直接进 prompt） */
  chatNotes?: string;
  /** 日常作息（自由文本；进亲密 prompt 的时间感，用于生成 TA 的时间线） */
  schedule?: string;
  /* ── 创造扩展（D-045） ── */
  /** 年龄状态：发布必须确认成年；未成年走加强审查通道（试装不放行，OPEN_QUESTIONS #18） */
  adultConfirmed?: boolean;
  /** 预设共同记忆：你们都记得的过去，每行一条；三种对话模式都注入（创作层设定，不受广场无记忆墙约束） */
  presetMemories?: string;
  /** 主动联系强度：注入亲密/外出 prompt 的主动性口径 */
  initiative?: 'high' | 'mid' | 'low';
  /** 禁忌/边界：TA 不做的事、回避的话题（三种模式都注入，涉及时回避或拒绝） */
  taboos?: string;
  /** 隐藏设定/剧情钩子：每行一条，羁绊 LV3 起每升一级解锁一条；查手机解锁通道待做（OPEN_QUESTIONS #19） */
  secrets?: string;
  /** 聊几句后 TA 会想确定关系（默认 4，见 lib/engine ADOPTION_OFFER_AFTER_TURNS） */
  offerAfterTurns?: number;
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
  /** 可见性（D-060）：public 会上传共享角色池，别人也能滑到；缺省 = private */
  visibility?: 'private' | 'public';
  /** 来自共享角色池（别人创建的，D-060）：不算「你的创作」，配对可过期；缔结时快照进本地 */
  shared?: boolean;
}

/**
 * 「我」的身份（D-035）：TA 眼中的用户。
 * 默认一份（store.me，onboarding 时建立），可为单个角色定制一份（store.meByCharacter）。
 * 除 nickname 外全部可选；没填的字段不进 prompt。
 */
export interface UserProfile {
  /** 头像（本机图片 URI，可空） */
  avatarUri?: string;
  /** 昵称（必填）：角色看到的名字 */
  nickname: string;
  /** 性别；unspecified/缺省 = 不指定 */
  gender?: 'unspecified' | 'female' | 'male' | 'nonbinary';
  /** 称呼 / 代词（自由文本，可不填） */
  pronoun?: string;
  /** 职业：角色必须稳定记住 */
  occupation?: string;
  /** 情感取向（如「喜欢女生」） */
  orientation?: string;
  /** 个性签名：一句现在的状态 */
  signature?: string;
  /** 背景：成长背景、家庭或当前生活背景等稳定事实 */
  background?: string;
  /** 关于我：身份、经历、性格、兴趣，以及希望角色记住的事实 */
  about?: string;
  /** 我的边界：不希望角色替你决定、猜测或触碰的内容 */
  boundaries?: string;
}

export type MessageFrom = 'him' | 'me' | 'system';
export type MessageKind = 'text' | 'voice' | 'system' | 'image';

export interface ChatMessage {
  id: string;
  from: MessageFrom;
  kind: MessageKind;
  text: string;
  at: number;
  /** kind === 'image' 时的本地图片 URI（已下载到本机） */
  imageUri?: string;
  /** 拍立得（D-056）：生成的照片以拍立得框居中呈现（非对话气泡）；text 作相纸下方手写字 */
  polaroid?: boolean;
  /**
   * 他在这条消息里「说」的话但不上屏（初见甩图：台词画在气泡里、不发文字）。
   * 只供对话引擎的上下文与记忆提取使用，保证他记得自己说过什么（D-016）。
   */
  spoken?: string;
  /** 已撤回（LINE 规则：双方可见占位「XX撤回了一条消息」，内容清空；D-030） */
  recalled?: boolean;
  /** 引用回复（LINE 规则：气泡上方带被引消息摘要；D-030） */
  replyTo?: { from: MessageFrom; text: string };
  /** 用户语音消息的本机音频（expo-audio 录制；D-030） */
  audioUri?: string;
  durationMs?: number;
  /** 她的语音经识别得到的文字（D-073）：进模型上下文，气泡下方小字回显 */
  transcript?: string;
  /** 她发的照片经视觉模型得到的客观描述（D-073）：只进模型上下文，不上屏 */
  caption?: string;
  /** 多模态处理状态（D-073）：pending 识别/看图中；failed 失败（原因在随后的系统消息里）；空 = 完成或不适用 */
  mediaStatus?: 'pending' | 'failed';
}

/** 广场搭话记录：不入消息 tab，会过期（免费层商业承重墙） */
export interface SquareChat {
  characterId: string;
  messages: ChatMessage[];
  startedAt: number;
  lastActiveAt: number;
  /** 他已开口要联系方式 */
  adoptionOffered: boolean;
  /** 用户在本条记录里发过的消息数 */
  userTurns: number;
  /** 心动值 0-100（D-029）：满了 = 羁绊 LV1，TA 主动交换联系方式 */
  heart?: number;
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
  /** 羁绊值（XP，D-029）：等级与阶段名由 lib/bond.ts 的成长曲线推导 */
  affinity: number;
  messages: ChatMessage[];
  /** 已退役（D-046 开门下线）：字段保留兼容旧存档，代码不再读写 */
  arrivalAt?: number;
  /** 已退役（D-046）：同上 */
  notifId?: string;
  /** 未读计数（心跳/自创打招呼累积，进入会话清零） */
  unread: number;
  /** 已退役（D-046 离席态随开门一起下线）：字段保留兼容旧存档 */
  away?: boolean;
  /** 已退役（D-046） */
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

/* ── 外出（D-038）：把相处从手机屏幕里拿出来——两个人真的在同一个空间 ── */

/** 外出约定：和某个 TA 约好去某个地点；进入该地点即赴约（消耗掉这条约定） */
export interface OutingPlan {
  id: string;
  characterId: string;
  placeId: string;
  createdAt: number;
}

/** 外出场景会话：同一时间只有一场（store.outingSession）；结束后在羁绊会话留一条系统记录 */
export interface OutingSession {
  id: string;
  placeId: string;
  characterId: string;
  /**
   * date = 赴约（事先有约定）；encounter = 偶遇（通讯录里的人恰好也在）；
   * stranger = 广场偶遇陌生人（D-040：还没配对的角色）
   */
  kind: 'date' | 'encounter' | 'stranger';
  messages: ChatMessage[];
  startedAt: number;
}

/** 对话引擎：Claude 或百度千帆（脚本引擎 mock 已删，D-069；选择走工程配置 EXPO_PUBLIC_AI_ENGINE） */
export type EngineId = 'anthropic' | 'qianfan';

export interface EngineContext {
  character: Character;
  /** square 初识 / bonded 亲密 / outing 外出（亲身互动故事模式，D-038） */
  mode: 'square' | 'bonded' | 'outing';
  /** bonded/outing 模式下的关系信息（含记忆库、缔结时间，注入系统 prompt） */
  bond?: Pick<Bond, 'name' | 'nickname' | 'affinity' | 'birthday' | 'memory' | 'createdAt'>;
  /** 「我」的身份（D-035）：注入系统 prompt，TA 借此认识她 */
  me?: UserProfile;
  /** outing 模式的场景信息（D-038/D-040） */
  outing?: {
    placeName: string;
    /** 地点的场景设定（content/places.ts） */
    scene: string;
    kind: 'date' | 'encounter' | 'stranger';
    /** 今天的天气一句话（lib/weather.ts），进场景氛围 */
    weatherLine?: string;
  };
  history: ChatMessage[];
  userText: string;
}

export interface EngineReply {
  /** 他的回复，可多条气泡 */
  texts: string[];
  /** 命中情绪暗面路由（系统层，绕过角色扮演） */
  darkSide?: boolean;
}

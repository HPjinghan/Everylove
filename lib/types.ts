/** 全自动恋爱 — 核心类型 */

export type ArchetypeId = 'gentle' | 'sharp' | 'ceo' | 'nonhuman';

export type LovePref = 'male' | 'female' | 'any' | 'nonhuman';

/** 立绘画风（D-076）：注入生图 prompt 第一行；anime 走蒸汽机、其余走 qwen-image。表见 content/prompts/portrait.ts PORTRAIT_STYLES */
export type PortraitStyleId =
  | 'anime'
  | 'shojo'
  | 'korean'
  | 'painterly'
  | 'ink'
  | 'realistic'
  | 'lineart'
  | 'none';

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
  /** 立绘画风（D-076）：创造 ⑦ 选择；缺省按 shojo（= 原工程画风）。立绘与外出拍照共用 */
  artStyle?: PortraitStyleId;
  /** 聊几句后 TA 会想确定关系（默认 4，见 lib/engine ADOPTION_OFFER_AFTER_TURNS） */
  offerAfterTurns?: number;
  /** 所在的世界（D-110）：世界书 id；缺省 / 找不到 = 现实世界（当前）。非现实世界会作为【你所在的世界】注入所有 prompt */
  worldId?: string;
  /** 世界快照（D-111 / D-112）：绑定世界那一刻整本抄进来（含 version），之后世界更新 / 删除都不影响这个角色；重新选一次世界才换新快照 */
  world?: WorldBook;
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
  /** 角色的语言（D-093）：种子角色各语言一份、只分发给该语言用户；自创角色 = 创建时的界面语言；缺省按当前界面语言 */
  lang?: 'zh' | 'en' | 'ja' | 'ko';
  /** TA 自己的台词（D-094）：发布时模型按人设写一次，创作者可改；没有则回落原型兜底（content/characters scriptFor） */
  lines?: CharacterLines;
}

/** 自创角色的台词（D-094）：三组会上屏的话 + 进 prompt 的一句人设与追法 */
export interface CharacterLines {
  /** 开场白：她第一次点开对话时 TA 先说的 */
  opening: string[];
  /** 心动满了、想和她确定关系时说的话（递进三条） */
  offer: string[];
  /** 确定关系后 TA 发来的前几条 */
  arrival: string[];
  /** 一句话「TA 是谁」（进 prompt 的【你是谁】） */
  persona?: string;
  /** 一句话「TA 怎么追人」（进 prompt 的【你的追法】） */
  pursuit?: string;
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
  /** 她的生日 MM-DD（D-088：建立身份时填，进日历关系层与亲密 prompt；缔结时不再问） */
  birthday?: string;
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
export type MessageKind = 'text' | 'voice' | 'system' | 'image' | 'card';

/** 「+」面板发出的卡片消息（D-081/D-084）：外出邀请 / 红包 / 位置 / 想看手机 */
export interface ChatCard {
  /** 卡片种类（core/cards 注册表；D-086 起可扩展——新种类在 features/ 里注册） */
  type: 'invite' | 'redpacket' | 'location' | 'phoneRequest' | (string & {});
  title: string;
  subtitle?: string;
  /** 红包金额（试装游戏币） */
  amount?: number;
  /** 外出邀请对应的地点 */
  placeId?: string;
  /** 红包：TA 拆了（D-084：由 TA 自己决定，回复里带 [拆红包] 标记） */
  claimed?: boolean;
  /** 红包：TA 这轮没拆 */
  declined?: boolean;
  /** 位置：真实坐标（D-084，卡片里带一小块地图） */
  lat?: number;
  lon?: number;
}

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
  /** 通话里说的话（D-077）：电话转写进会话，TA 记得电话里说过什么；气泡带小听筒标记 */
  viaCall?: boolean;
  /** kind === 'card' 时的卡片内容（D-081） */
  card?: ChatCard;
  /** 系统消息的语气（D-100）：hint = 白底 accent 字的轻提示（如 LV1 的「+」面板预告），默认是墨色系统条 */
  tone?: 'hint';
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
  /** 广场偶遇的记录（D-110）：TA 记得在哪见过她、聊了什么；进初识 / 广场 prompt，也在 TA 的资料页里显示 */
  encounters?: Encounter[];
}

/** 一次广场偶遇（D-110） */
export interface Encounter {
  at: number;
  placeName: string;
  /** 现场最后几句的摘录 */
  summary: string;
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
  /** 用户生日 MM-DD（D-088 起为缔结时从她的身份抄下的快照；读取以身份为准，这里只作旧存档回落） */
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
  /** TA 的手机密码（D-082）：随机四位，第一次需要时生成并记在这里（store.ensurePhoneCode） */
  phoneCode?: string;
  /** 查手机（D-082）：她已经拿到密码（聊天里 TA 答应了，或她猜对了）；之后随时能看 */
  phoneUnlocked?: boolean;
  /** TA 的记事本（D-085）：lib/his-notes.ts 按 MBTI 频率写，最多 HIS_NOTES_MAX 条 */
  notes?: HisNote[];
  /** LV1 首次进会话时的「+」面板预告已插过（D-100，只出现一次） */
  hintPlusSeen?: boolean;
  /** 缔结那一刻的角色快照（D-116）：设定、台词、世界都定格在这里；之后角色库里怎么改（自己改 / 创作者改）都不动这段关系。旧存档没有的按 id 取现行 */
  character?: Character;
  /** TA 身边的人（D-110）：第一次查手机时生成一次，之后前后一致；进记事本 / 发帖 / 亲密 prompt，X 里会来互动 */
  circle?: CirclePerson[];
  /** TA 和身边的人的近期聊天（D-110，查手机里的 Message）：personId → 对话 */
  circleChats?: Record<string, CircleLine[]>;
}

/** TA 身边的一个人（D-110）：朋友 / 家人 / 同事——不是角色，不能聊，只在 TA 的世界里出现 */
export interface CirclePerson {
  id: string;
  name: string;
  /** 关系：妈妈 / 发小 / 同事 / 室友…… */
  relation: string;
  /** 一句话：TA 眼里这个人是什么样 */
  note?: string;
}

/** TA 和身边的人的一句聊天（D-110） */
export interface CircleLine {
  from: 'him' | 'them';
  text: string;
  at: number;
}

/** 世界书（D-110）：TA 所处的世界与 TA 对一切的认知；现实世界（当前）内置，其余由她创建、收藏后才能选给角色 */
export interface WorldBook {
  id: string;
  name: string;
  /** 一句话：这是个什么世界 */
  summary: string;
  /** 设定：地理 / 时代 / 科技 / 规则 / 常识……一行一条 */
  rules?: string;
  createdAt: number;
  updatedAt: number;
  /** 版本号（D-112）：每次保存自增；角色快照里带着当时的版本，线上角色不受之后的更新 / 删除影响 */
  version?: number;
  /** 可见性（D-111）：public 上传共享池，所有玩家的世界书里都能浏览、收藏；缺省 = private */
  visibility?: 'private' | 'public';
  /** 来自共享池（别人创建的，D-111）：不能编辑，只能收藏 */
  shared?: boolean;
  /** 创建时的界面语言（D-111）：共享池只发同语言 */
  lang?: 'zh' | 'en' | 'ja' | 'ko';
}

export interface PostComment {
  id: string;
  /** me = 她；him = 发帖的 TA；other = 别人（TA 身边的人，或另一位缔结的 TA，D-110） */
  from: 'me' | 'him' | 'other';
  text: string;
  at: number;
  /** from === 'other' 时的名字 */
  name?: string;
  /** from === 'other' 且是另一位缔结的 TA 时：那位的角色 id（头像用立绘） */
  characterId?: string;
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
  /** 别人的互动已生成过（D-110：TA 身边的人与其他 TA 的评论，每帖一次） */
  reacted?: boolean;
}

/** 日历用户层日程（D-020/D-021；关系层与世界层运行时推导，不入库） */
export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** 哪些羁绊知道这条日程（D-113）：她让 TA 看手机时 TA 读到的；没看过的 TA 不知道、也不会来关心 */
  knownBy?: string[];
  /** 心跳三段式投递标记（lib/heartbeat.ts）：只投给知道的 TA */
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
  /**
   * 约定的时间（D-079）：有时间的约定只在赴约窗口（前 2 小时 ～ 后 3 小时，lib/appointments.ts）内算赴约，
   * 过了窗口没去 = 爽约；没有时间 = 随时有效（外出页手动约的）
   */
  at?: number;
  /** 来源：manual = 外出页「约 TA」；chat = 从 Message 对话里识别出来的（D-079） */
  source?: 'manual' | 'chat';
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
  /** 最近一次有人说话的时间（D-079）：一小时没说话再进来才刷新成新的一场 */
  lastActiveAt?: number;
  /** 赴约的约定时间（D-079）；TA 据此知道她准时 / 早到 / 迟到 */
  planAt?: number;
  /** 她相对约定时间晚到的分钟数（负数 = 早到） */
  lateMinutes?: number;
}

/** 她的记事本（D-085）：随时写；私密，只有她让 TA 看手机时 TA 才看得到 */
export interface Note {
  id: string;
  text: string;
  at: number;
  updatedAt: number;
}

/** TA 记事本里的一条心事（D-085）：按 MBTI 频率由引擎写，她查手机时看得到 */
export interface HisNote {
  id: string;
  text: string;
  at: number;
}

/** 相册里的一张拍立得（D-079）：外出拍的照片按下快门就是资产，不再并入羁绊会话 */
export interface AlbumShot {
  id: string;
  uri: string;
  at: number;
  characterId: string;
  /** 拍立得手写字 */
  caption?: string;
  placeId?: string;
}

/** 对话引擎：Claude 或百度千帆（脚本引擎 mock 已删，D-069；选择走工程配置 EXPO_PUBLIC_AI_ENGINE） */
export type EngineId = 'anthropic' | 'qianfan';

export interface EngineContext {
  character: Character;
  /** square 初识 / bonded 亲密 / outing 外出（亲身互动故事模式，D-038）/ call 通话（亲密背景 + 电话口吻，D-077） */
  mode: 'square' | 'bonded' | 'outing' | 'call';
  /** bonded/outing 模式下的关系信息（含记忆库、缔结时间，注入系统 prompt） */
  bond?: Pick<
    Bond,
    'name' | 'nickname' | 'affinity' | 'birthday' | 'memory' | 'createdAt' | 'phoneCode' | 'phoneUnlocked' | 'circle'
  >;
  /** 广场偶遇的记录（D-110）：初识 / 广场模式注入——TA 记得见过她 */
  encounters?: Encounter[];
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
    /** 赴约的约定（D-079）：约的什么时候、她晚到了几分钟（负数 = 早到）——TA 据此反应 */
    appointment?: { atLabel: string; lateMinutes: number };
  };
  history: ChatMessage[];
  userText: string;
}

export interface EngineReply {
  /** 他的回复，可多条气泡 */
  texts: string[];
  /** 命中情绪暗面路由（系统层，绕过角色扮演） */
  darkSide?: boolean;
  /**
   * 回复暗号（D-082 [解锁手机] / D-084 [拆红包] ……）：已从 texts 里剥掉，按 core/markers 注册的 key 置位；
   * 回合管线据此调用各暗号的 apply 落状态（D-086）
   */
  flags?: Record<string, boolean>;
}

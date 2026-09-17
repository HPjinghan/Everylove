/**
 * 工程配置（D-086）：所有 EXPO_PUBLIC_* 只在这里读一次。
 * 玩法与供应商从 CONFIG 取值，不各自摸 process.env——要加一项配置，先在这里登记、再补 .env.example。
 * 注意：Metro 只内联**字面量**的 process.env.EXPO_PUBLIC_XXX 访问，不能用变量拼 key；改 .env.local 后要重启 expo start。
 * 试装期 key 打进客户端包只为自测；分发包不带 key，由登录后的服务端代理供给（D-057）。
 */

export const CONFIG = {
  /* ── 聊天引擎（D-069：引擎与 key 只从工程配置读） ── */
  anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  /** Claude 模型 ID（D-108）：默认 Sonnet 5；可换 claude-opus-5 / claude-haiku-4-5（Opus 5 默认开思考，供应商侧自行加余量） */
  anthropicModel: process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-5',
  qianfanKey: process.env.EXPO_PUBLIC_QIANFAN_API_KEY ?? '',
  /** 千帆上挂着多家模型，默认 DeepSeek V4（千帆模型 ID：deepseek-v4-pro） */
  qianfanModel: process.env.EXPO_PUBLIC_QIANFAN_MODEL || 'deepseek-v4-pro',
  /** 指定引擎（供应商 id）；空 = 有本地 key 的优先，否则默认供应商走代理 */
  engine: process.env.EXPO_PUBLIC_AI_ENGINE ?? '',

  /* ── 生图 / 看图（千帆同一把 key） ── */
  qianfanImageModel: process.env.EXPO_PUBLIC_QIANFAN_IMAGE_MODEL || 'qwen-image',
  qianfanVisionModel: process.env.EXPO_PUBLIC_QIANFAN_VISION_MODEL || 'qwen3.5-397b-a17b',

  /* ── 百度语音（同一把千帆 key） ── */
  baiduTtsPer: process.env.EXPO_PUBLIC_BAIDU_TTS_PER || '',
  baiduAsrDevPid: Number(process.env.EXPO_PUBLIC_BAIDU_ASR_DEV_PID) || 0,

  /* ── 她的语音识别（D-139）：Whisper 协议通道（Groq / OpenAI …），按界面语言分流——默认只有日 / 韩走它，中 / 英仍走百度 ── */
  asr: {
    baseUrl: (process.env.EXPO_PUBLIC_ASR_BASE_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.EXPO_PUBLIC_ASR_API_KEY || '',
    model: process.env.EXPO_PUBLIC_ASR_MODEL || 'whisper-large-v3-turbo',
    /** 哪些界面语言走这条通道：逗号分隔的语言码，或 all */
    langs: process.env.EXPO_PUBLIC_ASR_LANGS || 'ja,ko',
  },

  /* ── TA 的声音（D-139）：Fish Audio；不配则回落百度（只会中 / 英） ── */
  fish: {
    apiKey: process.env.EXPO_PUBLIC_FISH_API_KEY || '',
    /** 模型 id：s1 / s2-pro / s2.1-pro / s2.1-pro-free（免费期到 2026-11-30） */
    model: process.env.EXPO_PUBLIC_FISH_MODEL || 's2.1-pro',
    /** 兜底音色 id（角色没选、音色池也没对应语言时按人称取）；空 = Fish 默认声 */
    voice: {
      he: process.env.EXPO_PUBLIC_FISH_VOICE_HE || '',
      she: process.env.EXPO_PUBLIC_FISH_VOICE_SHE || '',
      ta: process.env.EXPO_PUBLIC_FISH_VOICE_TA || '',
    },
  },

  /* ── 账号与云端（D-054） ── */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

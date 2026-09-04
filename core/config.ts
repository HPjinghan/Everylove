/**
 * 工程配置（D-086）：所有 EXPO_PUBLIC_* 只在这里读一次。
 * 玩法与供应商从 CONFIG 取值，不各自摸 process.env——要加一项配置，先在这里登记、再补 .env.example。
 * 注意：Metro 只内联**字面量**的 process.env.EXPO_PUBLIC_XXX 访问，不能用变量拼 key；改 .env.local 后要重启 expo start。
 * 试装期 key 打进客户端包只为自测；分发包不带 key，由登录后的服务端代理供给（D-057）。
 */

export const CONFIG = {
  /* ── 聊天引擎（D-069：引擎与 key 只从工程配置读） ── */
  anthropicKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  anthropicModel: 'claude-sonnet-5',
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

  /* ── OpenAI 兼容语音服务（D-074，可选；识别与合成共用） ── */
  speech: {
    baseUrl: (process.env.EXPO_PUBLIC_SPEECH_BASE_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.EXPO_PUBLIC_SPEECH_API_KEY || '',
    asrModel: process.env.EXPO_PUBLIC_SPEECH_ASR_MODEL || 'whisper-1',
    ttsModel: process.env.EXPO_PUBLIC_SPEECH_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: {
      he: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_HE || 'onyx',
      she: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_SHE || 'nova',
      ta: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_TA || 'alloy',
    },
  },

  /* ── 账号与云端（D-054） ── */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

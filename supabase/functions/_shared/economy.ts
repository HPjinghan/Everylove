/**
 * 流量 / 语音时长 / 订阅的数值与算法（D-132 → D-210 → D-217）——**唯一来源**：
 * 服务端代理（supabase/functions/ai）按它扣账，客户端（lib/traffic.ts）按它显示与预判，两边 import 同一个文件。
 * 纯函数、零依赖（Deno 与 Metro 都能直接 import）；改数值只改这里，tests/economy.test.ts 锁住。
 * 界面上的单位是 RingBit（缩写 RB，D-219）；代码与表里的字段仍叫 mb，1 mb = 1 RB。
 */

export type Plan = 'free' | 'pro' | 'max';
export type Billing = 'user' | 'house' | 'included';
export type MeterKind = 'chat' | 'image' | 'vision' | 'asr' | 'tts';

/* ── 流量（RB；字段名沿用 mb）── */

/** 每天免费多少 MB（不累积，按她所在时区的自然日） */
export const DAILY_FREE_MB = 100;
/** 订阅每月发多少 MB；Max 不限（不扣也不发） */
export const PLAN_MONTHLY_MB: Record<Plan, number> = { free: 0, pro: 6000, max: Infinity };
export const PLAN_GRANT_PERIOD_DAYS = 30;
/** 聊天每千 token 当量折几 MB（D-205：全部文字调用都是 Claude Haiku 5.5；当量见 costTokens） */
export const CHAT_MB_PER_KTOK = 1;
/**
 * 聊天按真实成本折（D-233）：一次调用折成「输入 token 当量」——缓存读 0.1、缓存写 1.25、输出 5（Haiku 5.5 的价目比），
 * 缓存住的前缀也算（供应商的 input_tokens 只是没命中缓存的那一小段）。一千当量约 $0.0001。
 */
export const TOKEN_WEIGHT = { cacheRead: 0.1, cacheWrite: 1.25, output: 5 } as const;
export interface TokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}
export function costTokens(u: TokenUsage): number {
  const n = (u.input ?? 0) + (u.cacheRead ?? 0) * TOKEN_WEIGHT.cacheRead + (u.cacheWrite ?? 0) * TOKEN_WEIGHT.cacheWrite + (u.output ?? 0) * TOKEN_WEIGHT.output;
  return Math.round(n);
}
/** 生图一张（D-219：不分画风、不看供应商怎么计费，一律按张；D-233 起 50） */
export const IMAGE_MB = 50;
export const VISION_MB = 3;
/** 她的语音识别（D-211）：按录音时长折流量 */
export const ASR_SECONDS_PER_MB = 60;
/** 流量包（价格待 #30；收费开关打开前点即到账） */
export const TRAFFIC_PACKS: { id: string; mb: number }[] = [
  { id: 'pack-1000', mb: 1000 },
  { id: 'pack-3000', mb: 3000 },
  { id: 'pack-10000', mb: 10000 },
];

/* ── 语音时长（秒；TA 的语音 + 电话，D-210）── */

/** 订阅每天给几分钟（不累积） */
export const PLAN_VOICE_DAILY_MIN: Record<Plan, number> = { free: 0, pro: 15, max: 60 };
/** 新用户送几分钟通话（只能打电话，不过期） */
export const NEW_USER_CALL_MIN = 5;
/** 语音分钟包（订阅用户才能买，不过期；价格待 #30） */
export const VOICE_PACKS: { id: string; min: number }[] = [
  { id: 'voice-30', min: 30 },
  { id: 'voice-60', min: 60 },
  { id: 'voice-180', min: 180 },
];

/* ── 后台保险丝（平台出的那些每人每天封顶，看不见）── */

/** 后台聊天每天封顶几千 token 当量（D-233 按成本折后约 $0.2 / 天） */
export const HOUSE_DAILY_KTOK = 2000;
/** TA 主动发图每天几张（D-219：按订阅档，后台成本里最大的一块） */
export const HOUSE_DAILY_IMAGES: Record<Plan, number> = { free: 1, pro: 4, max: 8 };
/** TA 自己发起的语音（主动消息里的语音、音色试听）每天封顶几秒（D-217） */
export const HOUSE_DAILY_TTS_SEC = 600;

/*
 * ── Max 的合理使用（D-219 → D-220）：「不限」过了一道看不见的线以后降速，不拦——
 * 聊天：当天她发起的过 3000 千 token 两条至少隔 15 秒、过 6000 隔 60 秒（服务器先等够再生成，她只觉得 TA 回得慢）；
 * 生图：第 31 张起每 5 分钟一张（要等的不超过 45 秒就并进显影里，再久让她过会儿再拍），第 61 张起当天停（一张是真钱）。
 */

export const MAX_SLOW_LANES: { ktok: number; gapSec: number }[] = [
  { ktok: 3000, gapSec: 15 },
  { ktok: 6000, gapSec: 60 },
];
export const MAX_SLOW_IMAGES = 30;
export const MAX_IMAGE_GAP_SEC = 300;
export const MAX_DAILY_IMAGES = 60;
/** 降速时服务器最多替她等几秒（聊天受客户端 90 秒超时管、生图还要留出生成的时间；Edge Function 一次最长约 150 秒） */
export const SLOW_MAX_WAIT_SEC: Record<'chat' | 'image', number> = { chat: 65, image: 45 };

/* ── 通话按服务器时钟计（D-217）── */

/** 两次计时之间最多算几秒（客户端每 10 秒报一次；断了的不往回补） */
export const CALL_TICK_MAX_SEC = 30;
/** 多久没动静就当这通电话已经挂了（included 的调用不再算在通话里） */
export const CALL_ALIVE_SEC = 90;

/** 一段话念出来大约几秒：中日韩文约 4.5 字 / 秒，其余约 14 字符 / 秒 */
export function estimateSpeechSeconds(text: string): number {
  let cjk = 0;
  for (const ch of text) if (isCjk(ch)) cjk++;
  return Math.max(1, Math.round((cjk / 4.5 + (text.length - cjk) / 14) * 10) / 10);
}

/** 粗估 token：中日韩文一字约 1 token，其余约 3.5 字符 1 token */
export function estimateTokens(text: string): number {
  let cjk = 0;
  for (const ch of text) if (isCjk(ch)) cjk++;
  return Math.round(cjk + (text.length - cjk) / 3.5);
}

function isCjk(ch: string): boolean {
  return (ch >= '　' && ch <= '鿿') || (ch >= '가' && ch <= '힯') || (ch >= '＀' && ch <= '￯');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 一笔用量折多少 MB（TA 的语音按分钟另算，这里是 0） */
export function mbFor(u: { kind: MeterKind; tokens?: number; images?: number; seconds?: number }): number {
  switch (u.kind) {
    case 'chat':
      return round2(((u.tokens ?? 0) / 1000) * CHAT_MB_PER_KTOK);
    case 'image':
      return IMAGE_MB * (u.images ?? 1);
    case 'vision':
      return VISION_MB;
    case 'asr':
      return round2(Math.max(0.1, (u.seconds ?? 0) / ASR_SECONDS_PER_MB));
    case 'tts':
      return 0;
  }
}

/** 服务端钱包的一行（public.wallets；当天的计数已按她的时区滚过日） */
export interface WalletRow {
  plan: Plan;
  balance_mb: number;
  free_used_mb: number;
  voice_used_sec: number;
  voice_pack_sec: number;
  call_bonus_sec: number;
  house_ktok: number;
  house_images: number;
  house_tts_sec: number;
  /** 她发起的用量今天累计（所有档都记，只拿来管 Max 的合理使用：降速与生图封顶） */
  fair_ktok: number;
  fair_images: number;
  /** 上一次通话计时（ISO）；null = 没在打电话 */
  call_tick_at: string | null;
}

/** 给客户端看的钱包（代理响应头 x-wallet 与 wallet.* 服务的返回） */
export interface WalletView {
  plan: Plan;
  /** 买来的 / 订阅发的（MB） */
  balance: number;
  /** 今天免费的还剩多少 MB */
  freeLeft: number;
  /** 今天订阅的语音额度还剩几秒 */
  voiceDailyLeft: number;
  /** 分钟包（秒） */
  packSec: number;
  /** 新用户送的通话（秒） */
  callBonusSec: number;
  /** 真收费开关（开了以后订阅 / 流量包只能真买） */
  live: boolean;
}

export function walletView(w: WalletRow, live: boolean): WalletView {
  return {
    plan: w.plan,
    balance: round2(Number(w.balance_mb)),
    freeLeft: round2(Math.max(0, DAILY_FREE_MB - Number(w.free_used_mb))),
    voiceDailyLeft: Math.max(0, PLAN_VOICE_DAILY_MIN[w.plan] * 60 - Number(w.voice_used_sec)),
    packSec: Number(w.voice_pack_sec),
    callBonusSec: Number(w.call_bonus_sec),
    live,
  };
}

/** 这通电话还在不在（included 的调用只在通话里算） */
export function callAlive(w: Pick<WalletRow, 'call_tick_at'>, now: number): boolean {
  return !!w.call_tick_at && now - Date.parse(w.call_tick_at) <= CALL_ALIVE_SEC * 1000;
}

/** 还能用几秒语音：message = TA 的语音；call = 电话（多一笔新用户送的） */
export function voiceLeftOf(v: WalletView, use: 'message' | 'call'): number {
  return v.voiceDailyLeft + v.packSec + (use === 'call' ? v.callBonusSec : 0);
}

/** 还能花的流量；Max 不限 */
export function trafficLeftOf(v: WalletView): number {
  return v.plan === 'max' ? Infinity : v.freeLeft + v.balance;
}

/** 生成前问一声（服务端照这个拦）：返回原因 = 不能花；null = 放行。included 由调用方先确认通话还在 */
export type BlockReason = 'traffic' | 'voice' | 'house' | 'fair' | 'slow' | 'busy';

export function gateReason(w: WalletRow, v: WalletView, kind: MeterKind, billing: Billing): BlockReason | null {
  if (billing === 'included') return voiceLeftOf(v, 'call') > 0 ? null : 'voice';
  if (billing === 'house') {
    if (kind === 'image') return Number(w.house_images) >= HOUSE_DAILY_IMAGES[w.plan] ? 'house' : null;
    if (kind === 'tts') return Number(w.house_tts_sec) >= HOUSE_DAILY_TTS_SEC ? 'house' : null;
    if (kind === 'asr') return null;
    return Number(w.house_ktok) >= HOUSE_DAILY_KTOK ? 'house' : null;
  }
  if (kind === 'tts') return voiceLeftOf(v, 'message') > 0 ? null : 'voice';
  if (w.plan === 'max') return kind === 'image' && Number(w.fair_images ?? 0) >= MAX_DAILY_IMAGES ? 'fair' : null;
  return trafficLeftOf(v) > 0 ? null : 'traffic';
}

/** Max 过线以后走哪条慢车道（D-220）；null = 不降速。车道各自排队：等照片不耽误聊天 */
export function slowLaneOf(w: WalletRow, kind: MeterKind, billing: Billing): { lane: 'chat' | 'image'; gapSec: number; maxWaitSec: number } | null {
  if (billing !== 'user' || w.plan !== 'max') return null;
  if (kind === 'image') {
    return Number(w.fair_images ?? 0) >= MAX_SLOW_IMAGES ? { lane: 'image', gapSec: MAX_IMAGE_GAP_SEC, maxWaitSec: SLOW_MAX_WAIT_SEC.image } : null;
  }
  if (kind !== 'chat' && kind !== 'vision') return null;
  const ktok = Number(w.fair_ktok ?? 0);
  let gapSec = 0;
  for (const l of MAX_SLOW_LANES) if (ktok >= l.ktok) gapSec = l.gapSec;
  return gapSec > 0 ? { lane: 'chat', gapSec, maxWaitSec: SLOW_MAX_WAIT_SEC.chat } : null;
}

/** 订阅档说明里的数字：Pro / Max 每月给多少 MB（Max = Infinity） */
export function planMonthlyMb(plan: Plan): number {
  return PLAN_MONTHLY_MB[plan];
}

/** 传给 SQL 函数的数值（SQL 里不写死任何数字） */
export function sqlEconomy() {
  return {
    daily_free_mb: DAILY_FREE_MB,
    pro_monthly_mb: PLAN_MONTHLY_MB.pro,
    grant_period_days: PLAN_GRANT_PERIOD_DAYS,
    voice_daily_sec: { free: PLAN_VOICE_DAILY_MIN.free * 60, pro: PLAN_VOICE_DAILY_MIN.pro * 60, max: PLAN_VOICE_DAILY_MIN.max * 60 },
    new_user_call_sec: NEW_USER_CALL_MIN * 60,
    call_tick_max_sec: CALL_TICK_MAX_SEC,
    call_alive_sec: CALL_ALIVE_SEC,
  };
}

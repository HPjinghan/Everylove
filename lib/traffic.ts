/**
 * 流量、语音时长与后台保险丝（D-132 → D-133 → D-210）。
 * - 「流量」= 真实消耗的包装，MB 显示：**只记她发起的**（D-210，Harper：「主动找我这些生成不扣流量，在其他的地方多做溢价」）——
 *   她的回合（含 TA 回她的那句）、她按快门 / 生成立绘、她要看的照片、看图、她的语音识别（D-211：1 MB / 60 秒，麦克风人人可用）。TA 自己发起的（主动 / 召回 / 心跳 / 记事本 / 发帖 /
 *   评论区 / 身边的人 / 日程 / 周薪 / 外卖送到 / 爽约后说一句 / 主动发图）和工具调用（记忆提取、描述导入、台词）平台出，不扣她，
 *   只受每人每天的后台保险丝管（看不见，防失控）。底座在 core/usage 报用量并标账单归属，这里换算（features/traffic.ts 扣账）。
 * - 换算：聊天按 token——全部文字调用走 Claude Haiku 5.5（D-205），1 MB / 千 token；生图 15 MB / 张；看图 3 MB / 张。供应商没返回 usage 就按字数估。
 * - 流量来源：每天免费 100 MB（不累积）、订阅每月发（Pro 6000 / Max 不限）、流量包（不订阅也能买）。
 * - **TA 的声音单独按分钟算**（D-210）：TA 的语音、电话都不折流量。每天的额度 Free 0 / Pro 30 / Max 90 分钟（不累积）；
 *   用完了订阅用户能买语音分钟包（不过期）；新用户送 5 分钟只能打电话（不过期，用完为止）。
 * - Coin（零钱）与流量、语音永不打通。数值是试装默认；价格待 Harper（OPEN_QUESTIONS #30）。
 */

import type { UsageEvent } from '@/core/usage';

export type LoveModelId = 'v1' | 'v2';

export interface LoveModel {
  id: LoveModelId;
  /** 对外的名字 */
  label: string;
  /** 一句话（界面） */
  blurb: string;
  /** 对应 core/providers 的供应商 id */
  provider: string;
  /** 每千 token 折多少 MB */
  mbPerKTok: number;
}

/** D-205：两档都是 Claude Haiku 5.5，设置里不再给选（LOVE_MODEL_ORDER 只剩一档 → 不显示）；老存档里的 v2 照样能用 */
export const LOVE_MODELS: Record<LoveModelId, LoveModel> = {
  v1: { id: 'v1', label: 'love-v1', blurb: '轻快，省流量', provider: 'anthropic', mbPerKTok: 1 },
  v2: { id: 'v2', label: 'love-v2', blurb: '更细腻，更懂你', provider: 'anthropic', mbPerKTok: 1 },
};
export const DEFAULT_LOVE_MODEL: LoveModelId = 'v1';
export const LOVE_MODEL_ORDER: LoveModelId[] = ['v1'];

/** 聊天按供应商折算（没列的按 1）；生图 / 看图按件 */
export const CHAT_MB_PER_KTOK: Record<string, number> = { qianfan: 1, anthropic: 1 };
export const IMAGE_MB = 15;
/** 生图模型按 token 计费时（返回 output_tokens）每千 token 折多少 MB */
export const IMAGE_MB_PER_KTOK = 3;
export const VISION_MB = 3;
/** 她的语音识别（D-211）：跟打字一样是她开口，按录音时长折流量 */
export const ASR_SECONDS_PER_MB = 60;

/** 一笔用量折多少 MB（TA 的语音按分钟另算，这里是 0，D-210） */
export function mbForUsage(e: UsageEvent): number {
  switch (e.kind) {
    case 'chat': {
      const rate = CHAT_MB_PER_KTOK[e.provider] ?? 1;
      return (((e.inputTokens ?? 0) + (e.outputTokens ?? 0)) / 1000) * rate;
    }
    case 'image':
      // 千帆按张计费：API 返回几张就记几张；返回的是 token（部分模型）就按 token 折
      if (e.outputTokens && !e.images) return (e.outputTokens / 1000) * IMAGE_MB_PER_KTOK;
      return IMAGE_MB * (e.images ?? 1);
    case 'tts':
      return 0;
    case 'asr':
      return Math.max(0.1, (e.seconds ?? 0) / ASR_SECONDS_PER_MB);
    case 'vision':
      return VISION_MB;
  }
}

/** 每天免费多少 MB（不累积，按自然日） */
export const DAILY_FREE_MB = 100;
/** 订阅每月发多少 MB；Max 不限（Infinity） */
export const PLAN_MONTHLY_MB: Record<'free' | 'pro' | 'max', number> = { free: 0, pro: 6000, max: Infinity };
export const PLAN_GRANT_PERIOD_MS = 30 * 24 * 3600_000;
/** 流量包（试装模拟，点即到账；价格待 #30） */
export const TRAFFIC_PACKS: { id: string; mb: number }[] = [
  { id: 'pack-1000', mb: 1000 },
  { id: 'pack-3000', mb: 3000 },
  { id: 'pack-10000', mb: 10000 },
];

/** 她的流量（store.traffic） */
export interface Traffic {
  /** 买来的 / 订阅发的（MB） */
  balance: number;
  /** 今天免费的用了多少 */
  freeDay: string;
  freeUsed: number;
  /** 订阅上次发流量的时刻（每 30 天一笔） */
  planGrantAt?: number;
}

export const EMPTY_TRAFFIC: Traffic = { balance: 0, freeDay: '', freeUsed: 0 };

export function trafficDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 今天还剩多少免费的 */
export function freeLeft(tr: Traffic, now = Date.now()): number {
  return tr.freeDay === trafficDayKey(now) ? Math.max(0, DAILY_FREE_MB - tr.freeUsed) : DAILY_FREE_MB;
}

/** 还能花的（免费 + 余额）；Max 不限 */
export function available(tr: Traffic, plan: 'free' | 'pro' | 'max', now = Date.now()): number {
  return plan === 'max' ? Infinity : freeLeft(tr, now) + tr.balance;
}

/** 扣一笔：先用今天免费的，再扣余额（扣到 0 为止，最后一笔可以把余额用穿）；Max 不扣。返回扣完的状态与实际扣了多少 */
export function trafficAfterUse(tr: Traffic, cost: number, plan: 'free' | 'pro' | 'max', now = Date.now()): { traffic: Traffic; charged: number } {
  if (plan === 'max' || cost <= 0) return { traffic: tr, charged: 0 };
  const day = trafficDayKey(now);
  const base: Traffic = tr.freeDay === day ? tr : { ...tr, freeDay: day, freeUsed: 0 };
  const free = Math.min(cost, Math.max(0, DAILY_FREE_MB - base.freeUsed));
  const fromBalance = Math.min(cost - free, base.balance);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    traffic: { ...base, freeUsed: round(base.freeUsed + free), balance: round(base.balance - fromBalance) },
    charged: round(free + fromBalance),
  };
}

/** 订阅到期该发的笔数（每 30 天一笔，最多补 2 笔）；Max 与 Free 不发 */
export function planGrantsDue(tr: Traffic, plan: 'free' | 'pro' | 'max', now = Date.now()): number {
  const monthly = PLAN_MONTHLY_MB[plan];
  if (!monthly || !Number.isFinite(monthly)) return 0;
  const last = tr.planGrantAt ?? 0;
  if (!last) return 1;
  return Math.min(2, Math.floor((now - last) / PLAN_GRANT_PERIOD_MS));
}

/* ═══ 语音时长（D-210）：TA 的语音 + 电话，按秒记、按分钟显示（她的语音识别 D-211 起走流量） ═══ */

/** 订阅每天给几分钟（不累积，按自然日） */
export const PLAN_VOICE_DAILY_MIN: Record<'free' | 'pro' | 'max', number> = { free: 0, pro: 30, max: 90 };
/** 新用户送几分钟通话（只能打电话，不过期，用完为止） */
export const NEW_USER_CALL_MIN = 5;
/** 语音分钟包（订阅用户才能买，不过期；价格待 #30） */
export const VOICE_PACKS: { id: string; min: number }[] = [
  { id: 'voice-30', min: 30 },
  { id: 'voice-60', min: 60 },
  { id: 'voice-180', min: 180 },
];
/** 通话剩这么多秒时让 TA 收尾 */
export const CALL_WRAP_UP_SEC = 60;

/** 她的语音时长（store.voice） */
export interface VoiceTime {
  /** 今天的订阅额度用了多少秒 */
  day: string;
  usedSec: number;
  /** 买来的分钟包（秒） */
  packSec: number;
  /** 新用户送的通话（秒，只能打电话） */
  callBonusSec: number;
}

export const START_VOICE: VoiceTime = { day: '', usedSec: 0, packSec: 0, callBonusSec: NEW_USER_CALL_MIN * 60 };

/** message = TA 的语音；call = 电话（多一笔新用户送的） */
export type VoiceUse = 'message' | 'call';

/** 今天订阅额度还剩几秒 */
export function voiceDailyLeft(v: VoiceTime, plan: 'free' | 'pro' | 'max', now = Date.now()): number {
  const total = PLAN_VOICE_DAILY_MIN[plan] * 60;
  return v.day === trafficDayKey(now) ? Math.max(0, total - v.usedSec) : total;
}

/** 这种用途一共还能用几秒 */
export function voiceLeft(v: VoiceTime, plan: 'free' | 'pro' | 'max', use: VoiceUse, now = Date.now()): number {
  return voiceDailyLeft(v, plan, now) + v.packSec + (use === 'call' ? v.callBonusSec : 0);
}

/** 扣一笔：先用今天的额度，电话再用送的，最后扣分钟包（扣到 0 为止）。返回扣完的状态与实际扣了几秒 */
export function voiceAfterUse(
  v: VoiceTime,
  sec: number,
  plan: 'free' | 'pro' | 'max',
  use: VoiceUse,
  now = Date.now()
): { voice: VoiceTime; charged: number } {
  if (sec <= 0) return { voice: v, charged: 0 };
  const day = trafficDayKey(now);
  const base: VoiceTime = v.day === day ? v : { ...v, day, usedSec: 0 };
  let rest = sec;
  const daily = Math.min(rest, voiceDailyLeft(base, plan, now));
  rest -= daily;
  const bonus = use === 'call' ? Math.min(rest, base.callBonusSec) : 0;
  rest -= bonus;
  const pack = Math.min(rest, base.packSec);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    voice: { ...base, usedSec: round(base.usedSec + daily), callBonusSec: round(base.callBonusSec - bonus), packSec: round(base.packSec - pack) },
    charged: round(daily + bonus + pack),
  };
}

/** 「TA 发语音」开关（每段羁绊一个）：没动过 = 订阅开、Free 关；Free 又没买分钟包的打不开 */
export function voiceRepliesAllowed(plan: 'free' | 'pro' | 'max', v: VoiceTime): boolean {
  return plan !== 'free' || v.packSec > 0;
}
export function voiceRepliesOn(bond: { voiceReplies?: boolean }, plan: 'free' | 'pro' | 'max', v: VoiceTime): boolean {
  if (!voiceRepliesAllowed(plan, v)) return false;
  return bond.voiceReplies ?? plan !== 'free';
}

/** 秒 → 整分钟（向下取整，显示用） */
export function voiceMinutes(sec: number): number {
  return Number.isFinite(sec) ? Math.floor(Math.max(0, sec) / 60) : Infinity;
}

/* ═══ 后台保险丝（D-210）：平台出的那些每人每天封顶，看不见；到顶这天的后台生成静默跳过 ═══ */

export const HOUSE_DAILY_KTOK = 400;
export const HOUSE_DAILY_IMAGES = 8;

export interface HouseUsage {
  day: string;
  ktok: number;
  images: number;
}

export function houseAfterUse(h: HouseUsage, add: { ktok?: number; images?: number }, now = Date.now()): HouseUsage {
  const day = trafficDayKey(now);
  const base = h.day === day ? h : { day, ktok: 0, images: 0 };
  return { day, ktok: base.ktok + (add.ktok ?? 0), images: base.images + (add.images ?? 0) };
}

export function houseBlocked(h: HouseUsage, kind: 'chat' | 'image' | 'vision', now = Date.now()): boolean {
  if (h.day !== trafficDayKey(now)) return false;
  return kind === 'image' ? h.images >= HOUSE_DAILY_IMAGES : h.ktok >= HOUSE_DAILY_KTOK;
}

/** 「1,240 MB」（小数只在不足 10 MB 时露一位） */
export function mb(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return `${v.toLocaleString('en-US')} MB`;
}

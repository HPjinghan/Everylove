/**
 * 流量与模型档（D-132 → D-133，Harper：「不要按照回合，按照 token 消耗，因为还涉及到生图、生推特这些行为」）。
 * - 「流量」= 真实消耗的包装，MB 显示：**每一次花钱的调用都记**——她的回合、TA 主动 / 召回 / 记事本 / 发帖 / 身边的人 / 周薪这些后台生成、
 *   生图（立绘 / 外出拍照 / TA 发图）、语音合成、语音识别、看图。底座在 core/usage 报用量，这里换算成 MB（features/traffic.ts 扣账）。
 * - 换算：聊天按 token——love-v1（千帆 deepseek-v4-pro）1 MB / 千 token，love-v2（Claude sonnet-5）5 MB / 千 token（价差约 5 倍）；
 *   生图 15 MB / 张；语音合成 1 MB / 200 字；识别 1 MB / 60 秒；看图 3 MB / 张。供应商没返回 usage 就按字数估。
 * - 模型档玩家自己切（设置），存用户数据随云端走；来源：每天免费 100 MB（不累积）、订阅每月发（Pro 6000 / Max 不限）、流量包（唯一消耗型 SKU）。
 * - Coin（零钱）与流量永不打通。数值是试装默认；价格待 Harper（OPEN_QUESTIONS #30）。
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

export const LOVE_MODELS: Record<LoveModelId, LoveModel> = {
  v1: { id: 'v1', label: 'love-v1', blurb: '轻快，省流量', provider: 'qianfan', mbPerKTok: 1 },
  v2: { id: 'v2', label: 'love-v2', blurb: '更细腻，更懂你', provider: 'anthropic', mbPerKTok: 5 },
};
export const DEFAULT_LOVE_MODEL: LoveModelId = 'v1';
export const LOVE_MODEL_ORDER: LoveModelId[] = ['v1', 'v2'];

/** 聊天按供应商折算（没列的按 1）；其余按件 / 按字 / 按秒 */
export const CHAT_MB_PER_KTOK: Record<string, number> = { qianfan: 1, anthropic: 5 };
export const IMAGE_MB = 15;
/** 生图模型按 token 计费时（返回 output_tokens）每千 token 折多少 MB */
export const IMAGE_MB_PER_KTOK = 3;
export const TTS_CHARS_PER_MB = 200;
export const ASR_SECONDS_PER_MB = 60;
export const VISION_MB = 3;

/** 一笔用量折多少 MB */
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
      return Math.max(0.1, (e.chars ?? 0) / TTS_CHARS_PER_MB);
    case 'asr':
      return Math.max(0.5, (e.seconds ?? 0) / ASR_SECONDS_PER_MB);
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

/** 「1,240 MB」（小数只在不足 10 MB 时露一位） */
export function mb(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return `${v.toLocaleString('en-US')} MB`;
}

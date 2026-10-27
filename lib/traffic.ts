/**
 * 流量、TA 的声音与后台保险丝（D-132 → D-133 → D-210 → D-240）。
 * - 「流量」= 真实消耗的包装，单位 RingBit（RB，D-219；代码字段沿用 mb）：**只记她发起的**（D-210，Harper：「主动找我这些生成不扣流量，在其他的地方多做溢价」）——
 *   她的回合（含 TA 回她的那句）、她按快门 / 生成立绘、她要看的照片、看图、她的语音识别（D-211：麦克风人人可用；D-234：2 RB / 分钟）。TA 自己发起的（主动 / 召回 / 心跳 / 记事本 / 发帖 /
 *   评论区 / 身边的人 / 日程 / 周薪 / 外卖送到 / 爽约后说一句 / 主动发图）和工具调用（记忆提取、描述导入、台词）平台出，不扣她，
 *   只受每人每天的后台保险丝管（看不见，防失控）。底座在 core/usage 报用量并标账单归属，这里换算（features/traffic.ts 扣账）。
 * - 换算：聊天按真实成本——全部文字调用走 Claude Haiku 5.5（D-205），1 RB / 千 token 当量（D-233：缓存读 0.1、缓存写 1.25、输出 5）；生图按张（D-219）：qwen-image 60 RB、动漫（蒸汽机）50 RB（D-234）；看图 3 RB / 张。供应商没返回 usage 就按字数估。
 * - 流量来源：每天免费 100 RB（不累积）、订阅每 30 天发（Pro 5000 / Max 20000）、流量包（不订阅也能买）。
 * - **TA 的声音按分钟，不扣流量**（D-240）：TA 的语音按字数估的秒数、电话按接通时长；订阅每 30 天给 Pro 100 / Max 300 分钟（下一期清零重给），
 *   新用户送 5 分钟（只能打电话，不过期），分钟包所有人都能买（不过期）。
 * - Coin（零钱）与流量、语音永不打通。数值是试装默认；价格待 Harper（OPEN_QUESTIONS #30）。
 * - **余额以服务器为准（D-217）**：数值与算法的唯一来源是 supabase/functions/_shared/economy.ts（代理按它扣账），这里 re-export；
 *   本机 store.traffic / voice / plan 只是服务器钱包的显示缓存（fromServerWallet），下面的本机扣账函数只在没有服务器的时候用（开发直连 / 测试）。
 */

import type { UsageEvent } from '@/core/usage';
import {
  ASR_SECONDS_PER_MB,
  CHAT_MB_PER_KTOK as MB_PER_KTOK,
  costTokens,
  DAILY_FREE_MB,
  HOUSE_DAILY_IMAGES,
  HOUSE_DAILY_KTOK,
  IMAGE_MB,
  imageModelOf,
  mbFor,
  NEW_USER_CALL_MIN,
  PLAN_GRANT_PERIOD_DAYS,
  PLAN_MONTHLY_MB,
  PLAN_VOICE_MONTHLY_MIN,
  TRAFFIC_PACKS,
  VISION_MB,
  VOICE_PACKS,
  type WalletView,
} from '@/supabase/functions/_shared/economy';

export {
  ASR_SECONDS_PER_MB,
  DAILY_FREE_MB,
  HOUSE_DAILY_IMAGES,
  HOUSE_DAILY_KTOK,
  IMAGE_MB,
  NEW_USER_CALL_MIN,
  PLAN_MONTHLY_MB,
  PLAN_VOICE_MONTHLY_MIN,
  TRAFFIC_PACKS,
  VISION_MB,
  VOICE_PACKS,
};
export type { WalletView };

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

/** 聊天按供应商折算（D-205 起都是 1 MB / 千 token）；生图 / 看图按件 */
export const CHAT_MB_PER_KTOK: Record<string, number> = { qianfan: MB_PER_KTOK, anthropic: MB_PER_KTOK };

/** 一笔用量的 token 当量（D-233 按真实成本折，与服务端同一个 costTokens） */
export function usageTokens(e: UsageEvent): number {
  return costTokens({ input: e.inputTokens, output: e.outputTokens, cacheRead: e.cacheReadTokens, cacheWrite: e.cacheWriteTokens });
}

/** 一笔用量折多少 MB（TA 的语音按分钟另算、这里是 0，D-240）——与服务端同一个 mbFor */
export function mbForUsage(e: UsageEvent): number {
  return mbFor({
    kind: e.kind,
    tokens: usageTokens(e),
    images: e.images,
    model: e.kind === 'image' ? imageModelOf(e.provider) : undefined,
    seconds: e.seconds,
  });
}

export const PLAN_GRANT_PERIOD_MS = PLAN_GRANT_PERIOD_DAYS * 24 * 3600_000;

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

/** 还能花的（免费 + 余额；Max 也是一个数） */
export function available(tr: Traffic, now = Date.now()): number {
  return freeLeft(tr, now) + tr.balance;
}

/** 扣一笔：先用今天免费的，再扣余额（扣到 0 为止，最后一笔可以把余额用穿）。返回扣完的状态与实际扣了多少 */
export function trafficAfterUse(tr: Traffic, cost: number, now = Date.now()): { traffic: Traffic; charged: number } {
  if (cost <= 0) return { traffic: tr, charged: 0 };
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

/** 订阅到期该发的笔数（每 30 天一笔，最多补 2 笔）；Free 不发 */
export function planGrantsDue(tr: Traffic, plan: 'free' | 'pro' | 'max', now = Date.now()): number {
  const monthly = PLAN_MONTHLY_MB[plan];
  if (!monthly || !Number.isFinite(monthly)) return 0;
  const last = tr.planGrantAt ?? 0;
  if (!last) return 1;
  return Math.min(2, Math.floor((now - last) / PLAN_GRANT_PERIOD_MS));
}

/* ═══ TA 的声音（D-240）：按分钟、不扣流量——订阅每期给的分钟（Pro 100 / Max 300，下一期清零重给）+ 新用户送的通话 + 分钟包 ═══ */

/** 通话剩这么多秒时让 TA 收尾 */
export const CALL_WRAP_UP_SEC = 60;

/** 她的语音时长（store.voice） */
export interface VoiceTime {
  /** 今天 TA 的声音用了多少秒（只做统计） */
  day: string;
  usedSec: number;
  /** 这一期订阅给的分钟还剩几秒（随订阅发流量时重给） */
  planSec?: number;
  /** 分钟包还剩几秒（不过期） */
  packSec: number;
  /** 新用户送的通话（秒，只能打电话） */
  callBonusSec: number;
}

export const START_VOICE: VoiceTime = { day: '', usedSec: 0, planSec: 0, packSec: 0, callBonusSec: NEW_USER_CALL_MIN * 60 };

/** message = TA 的语音；call = 电话（多一笔新用户送的） */
export type VoiceUse = 'message' | 'call';

/** 这一期订阅的分钟还剩几秒（Free 没有） */
export function planVoiceLeft(v: VoiceTime, plan: 'free' | 'pro' | 'max'): number {
  return plan === 'free' ? 0 : (v.planSec ?? 0);
}

/** 这种用途一共还能用几秒（电话多一笔送的） */
export function voiceLeft(v: VoiceTime, plan: 'free' | 'pro' | 'max', use: VoiceUse): number {
  return planVoiceLeft(v, plan) + v.packSec + (use === 'call' ? v.callBonusSec : 0);
}

/** 扣一笔：电话先用送的，然后这一期订阅的分钟，最后分钟包（扣到 0 为止）。返回扣完的状态与实际扣了几秒 */
export function voiceAfterUse(v: VoiceTime, sec: number, plan: 'free' | 'pro' | 'max', use: VoiceUse, now = Date.now()): { voice: VoiceTime; charged: number } {
  if (sec <= 0) return { voice: v, charged: 0 };
  const round = (n: number) => Math.round(n * 10) / 10;
  const day = trafficDayKey(now);
  let rest = sec;
  const bonus = use === 'call' ? Math.min(rest, v.callBonusSec) : 0;
  rest -= bonus;
  const planned = Math.min(rest, planVoiceLeft(v, plan));
  rest -= planned;
  const pack = Math.min(rest, v.packSec);
  return {
    voice: {
      ...v,
      day,
      usedSec: round((v.day === day ? v.usedSec : 0) + sec),
      callBonusSec: round(v.callBonusSec - bonus),
      planSec: round(planVoiceLeft(v, plan) - planned),
      packSec: round(v.packSec - pack),
    },
    charged: round(bonus + planned + pack),
  };
}

/** 「TA 发语音」开关（每段羁绊一个）：没动过 = 订阅开、Free 关；Free 没买分钟包的打不开 */
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

export function houseBlocked(h: HouseUsage, kind: 'chat' | 'image' | 'vision', plan: 'free' | 'pro' | 'max', now = Date.now()): boolean {
  if (h.day !== trafficDayKey(now)) return false;
  return kind === 'image' ? h.images >= HOUSE_DAILY_IMAGES[plan] : h.ktok >= HOUSE_DAILY_KTOK;
}

/**
 * 服务器钱包 → 本机显示缓存（D-217）：代理每次响应头 x-wallet、wallet.* 的返回都走这里，
 * 换成 store 现有的形状（今天免费的用了多少 = 100 − 还剩多少），界面与本机闸门照旧读 store。
 */
export function fromServerWallet(v: WalletView, now = Date.now()): { plan: 'free' | 'pro' | 'max'; traffic: Traffic; voice: VoiceTime } {
  const day = trafficDayKey(now);
  return {
    plan: v.plan,
    traffic: { balance: v.balance, freeDay: day, freeUsed: Math.max(0, DAILY_FREE_MB - v.freeLeft) },
    voice: { day, usedSec: 0, planSec: v.planVoiceSec ?? 0, packSec: v.packSec, callBonusSec: v.callBonusSec },
  };
}

/** 「1,240 RB」（RingBit，D-219；小数只在不足 10 时露一位） */
export function mb(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n);
  return `${v.toLocaleString('en-US')} RB`;
}

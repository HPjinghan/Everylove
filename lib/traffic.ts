/**
 * 流量与模型档（D-132，Harper：「模型允许玩家自己切换（包装成 love-v1 之类的名字），不订阅的人也可以单独买 token」；
 * 老板：「按 token 卖 + 订阅并行」）。
 * - 「流量」= 把实际 token 消耗包装成的计量单位，MB 显示：她每开口一回合按当前模型档扣（每回合 token 数基本恒定，按回合计 = 按 token 计，
 *   但用户看得懂）。只扣她发起的回合（文字 / 语音 / 照片 / 卡片 / 电话每句 / 外出）；TA 主动来找、召回、记事本、发帖、周薪估算这些后台生成不扣。
 * - 模型档：love-v1（千帆 deepseek-v4-pro，1 MB / 回合）、love-v2（Claude sonnet-5，5 MB / 回合）——玩家在设置里自己切，存用户数据、随云端走。
 * - 来源：每天免费 30 MB（不累积）、订阅每月发一笔（Pro 2000 MB / Max 不限）、流量包（唯一的消耗型 SKU；试装模拟点即到账）。
 * - Coin（零钱）与流量永不打通：Coin 是戏里的钱，流量是真钱买的。
 * 数值是试装默认；价格待 Harper（OPEN_QUESTIONS #30）。
 */

export type LoveModelId = 'v1' | 'v2';

export interface LoveModel {
  id: LoveModelId;
  /** 对外的名字 */
  label: string;
  /** 一句话（界面） */
  blurb: string;
  /** 对应 core/providers 的供应商 id */
  provider: string;
  /** 每回合扣多少 MB */
  costMb: number;
}

export const LOVE_MODELS: Record<LoveModelId, LoveModel> = {
  v1: { id: 'v1', label: 'love-v1', blurb: '轻快，省流量', provider: 'qianfan', costMb: 1 },
  v2: { id: 'v2', label: 'love-v2', blurb: '更细腻，更懂你', provider: 'anthropic', costMb: 5 },
};
export const DEFAULT_LOVE_MODEL: LoveModelId = 'v1';
export const LOVE_MODEL_ORDER: LoveModelId[] = ['v1', 'v2'];

/** 每天免费多少 MB（不累积，按自然日） */
export const DAILY_FREE_MB = 30;
/** 订阅每月发多少 MB；Max 不限（Infinity） */
export const PLAN_MONTHLY_MB: Record<'free' | 'pro' | 'max', number> = { free: 0, pro: 2000, max: Infinity };
export const PLAN_GRANT_PERIOD_MS = 30 * 24 * 3600_000;
/** 流量包（试装模拟，点即到账；价格待 #30） */
export const TRAFFIC_PACKS: { id: string; mb: number }[] = [
  { id: 'pack-500', mb: 500 },
  { id: 'pack-2000', mb: 2000 },
  { id: 'pack-6000', mb: 6000 },
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

/** 这一回合扣多少 */
export function turnCostMb(model: LoveModelId): number {
  return LOVE_MODELS[model].costMb;
}

/** 够不够扣这一回合（Max 不限） */
export function canAfford(tr: Traffic, cost: number, plan: 'free' | 'pro' | 'max', now = Date.now()): boolean {
  if (plan === 'max') return true;
  return freeLeft(tr, now) + tr.balance >= cost;
}

/** 扣一回合：先用今天免费的，再扣余额；Max 不扣。返回扣完的状态与实际扣了多少 */
export function trafficAfterUse(tr: Traffic, cost: number, plan: 'free' | 'pro' | 'max', now = Date.now()): { traffic: Traffic; charged: number } {
  if (plan === 'max') return { traffic: tr, charged: 0 };
  const day = trafficDayKey(now);
  const base: Traffic = tr.freeDay === day ? tr : { ...tr, freeDay: day, freeUsed: 0 };
  const free = Math.min(cost, Math.max(0, DAILY_FREE_MB - base.freeUsed));
  const fromBalance = Math.min(cost - free, base.balance);
  return {
    traffic: { ...base, freeUsed: base.freeUsed + free, balance: base.balance - fromBalance },
    charged: free + fromBalance,
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

/** 「1,240 MB」 */
export function mb(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return `${Math.round(n).toLocaleString('en-US')} MB`;
}

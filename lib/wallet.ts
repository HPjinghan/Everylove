/**
 * 零钱体系（D-128，提案 docs/ECONOMY_PROPOSAL.md §3；Harper：「每天发的钱做成一个日签 app，模拟一次水晶球抽签，给钱 50–500 不等根据运势来；
 * 对方的钱默认 2000，根据人设生成一个工资每周加一次钱；角色在聊天中要主动能够发起发红包或者给我点外卖」）。
 * - 游戏币 Coin（D-129，不用 ¥）；永不售卖、不可提现、不随订阅变化、不涨亲密度（钱买不到爱）。
 * - 她的钱包：幸运签 App（D-138）——日签每天抽一次水晶球按运势给 50–500 Coin、转盘投零钱赌倍数（×0.5 / ×1.2 / ×2 / ×5，期望 > 1，故意大方：
 *   Coin 只是给 TA 发红包 / 点外卖的零钱，与经济不挂钩）；红包 / 外卖进出都记账（store.wallet），流水在钱包 App 看。
 * - TA 的钱包（Bond.wallet）：缔结 2000 Coin 起；周薪按人设由模型估一次（写不成按关键词兜底），每周到账；TA 发红包 / 点外卖从这里扣。
 * - TA 主动花钱：亲密 / 通话 prompt 里的【你的钱包】+ 回复暗号 [发红包 …] / [点外卖 …]（features/wallet.tsx），每天各最多一次。
 * 数值是试装默认，调数只改这里的常量。
 */

import { uid } from '@/lib/format';
import type { Character, HisWallet, LedgerEntry, LedgerKind } from '@/lib/types';

const DAY_MS = 24 * 3600_000;

/* ═══ 常量 ═══ */

/** TA 的钱包起点 */
export const HIS_WALLET_START = 2000;
/** 账本最多留几笔 */
export const LEDGER_MAX = 80;
/** 周薪：每 7 天一笔；很久没打开一次最多补几周 */
export const SALARY_PERIOD_MS = 7 * DAY_MS;
export const SALARY_CATCHUP_MAX = 4;
/** TA 主动送东西：每天每种最多几次 */
export const HIS_GIFT_PER_DAY = 1;
/** 外卖：骑手多久送到（分钟区间）；没写价格时按多少算 */
export const DELIVERY_ETA_MIN = [10, 20];
export const DELIVERY_DEFAULT_PRICE = 30;

/* ═══ 日签：水晶球抽签 ═══ */

export type FortuneLuck = 'great' | 'good' | 'fair' | 'small' | 'last';

/** 五档运势：权重（抽中概率）与零钱区间；签文在 content/fortunes.ts */
export const FORTUNES: Record<FortuneLuck, { label: string; weight: number; min: number; max: number }> = {
  great: { label: '大吉', weight: 8, min: 300, max: 500 },
  good: { label: '吉', weight: 22, min: 200, max: 300 },
  fair: { label: '中吉', weight: 35, min: 120, max: 200 },
  small: { label: '小吉', weight: 25, min: 80, max: 120 },
  last: { label: '末吉', weight: 10, min: 50, max: 80 },
};
export const FORTUNE_ORDER: FortuneLuck[] = ['great', 'good', 'fair', 'small', 'last'];

/** 日签按自然日（本地时间午夜） */
export function fortuneDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 抽一次：r1 定档、r2 定金额（区间内取整）、r3 定签文；全部传入以便测试确定 */
export function drawFortune(r1 = Math.random(), r2 = Math.random(), r3 = Math.random(), texts = 3): { luck: FortuneLuck; amount: number; textIndex: number } {
  const total = FORTUNE_ORDER.reduce((s, k) => s + FORTUNES[k].weight, 0);
  let x = r1 * total;
  let luck: FortuneLuck = 'last';
  for (const k of FORTUNE_ORDER) {
    x -= FORTUNES[k].weight;
    if (x < 0) {
      luck = k;
      break;
    }
  }
  const { min, max } = FORTUNES[luck];
  const amount = Math.min(max, Math.max(min, Math.round(min + r2 * (max - min))));
  return { luck, amount, textIndex: Math.min(texts - 1, Math.floor(r3 * texts)) };
}

/* ═══ 转盘（D-138）：投一笔零钱，转到几倍拿几倍 ═══ */

/** 能投的档 */
export const WHEEL_BETS = [50, 100, 200, 500];
/**
 * 十格转盘，每格等概率（36°）；倍数按格排布 = 概率就是格数：×0.5 三格 30% / ×1.2 四格 40% / ×2 两格 20% / ×5 一格 10%，
 * 期望 1.53——故意大方（Harper：「跟经济不挂钩所以可以大方一点」）。顺时针从正上方数起。
 */
export const WHEEL_SLICES: number[] = [1.2, 0.5, 2, 1.2, 0.5, 5, 1.2, 0.5, 2, 1.2];

/** 转一次：r 定落在哪一格；payout = 投注 × 倍数取整，net = 记进账本的净额（一笔） */
export function spinWheel(bet: number, r = Math.random()): { slice: number; mult: number; payout: number; net: number } {
  const slice = Math.min(WHEEL_SLICES.length - 1, Math.max(0, Math.floor(r * WHEEL_SLICES.length)));
  const mult = WHEEL_SLICES[slice];
  const payout = Math.round(bet * mult);
  return { slice, mult, payout, net: payout - bet };
}

/* ═══ 账本 ═══ */

export function ledgerEntry(input: { amount: number; kind: LedgerKind; note: string; bondId?: string }, at = Date.now()): LedgerEntry {
  return { id: uid('l'), at, ...input };
}

export function pushLedger(ledger: LedgerEntry[], entry: LedgerEntry): LedgerEntry[] {
  return [...ledger, entry].slice(-LEDGER_MAX);
}

/* ═══ TA 的周薪：按人设估一次 ═══ */

export const SALARY_TIERS = {
  student: 500,
  ordinary: 2000,
  professional: 3500,
  rich: 15000,
} as const;

/** 关键词兜底（模型写不成 / 没 key）：学生 / 富有 / 专业人士 / 普通 */
export function weeklySalaryFallback(c: Pick<Character, 'identity' | 'story' | 'race' | 'archetype' | 'name'>): { weekly: number; job: string } {
  const text = `${c.identity ?? ''} ${c.story ?? ''} ${c.race ?? ''}`;
  if (c.archetype === 'ceo' || /总裁|CEO|集团|董事|老板|财阀|龙族|龙|神明|神|殿下|王|公爵|社長|御曹司|재벌|회장/i.test(text))
    return { weekly: SALARY_TIERS.rich, job: '自己的产业' };
  if (/医生|律师|设计师|教授|讲师|工程师|建筑师|投行|程序员|医師|弁護士|エンジニア|의사|변호사|디자이너/i.test(text))
    return { weekly: SALARY_TIERS.professional, job: '工作的薪水' };
  if (/学生|研究生|高中|大一|大二|大三|大四|本科|student|大学院生|高校生|학생|대학생/i.test(text)) return { weekly: SALARY_TIERS.student, job: '家里给的零花钱' };
  return { weekly: SALARY_TIERS.ordinary, job: '工作的薪水' };
}

/** 模型输出 JSON {"weekly": 数字, "job": "…"}；夹在 100–50000 */
export function parseSalaryJSON(raw: string): { weekly: number; job: string } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as { weekly?: unknown; job?: unknown };
    const weekly = Number(obj.weekly);
    if (!Number.isFinite(weekly) || weekly <= 0) return null;
    return { weekly: Math.round(Math.min(50000, Math.max(100, weekly))), job: typeof obj.job === 'string' ? obj.job.trim().slice(0, 30) : '' };
  } catch {
    return null;
  }
}

export function emptyHisWallet(now = Date.now()): HisWallet {
  return { balance: HIS_WALLET_START, ledger: [], lastSalaryAt: now };
}

/* ═══ TA 主动送东西：暗号解析与守门 ═══ */

/** `[发红包 52|别省着]` → { amount: 52, note }；`[点外卖 姜茶|20|趁热喝]` → { item, amount: 20, note } */
export function parseGiftPayload(payload: string, kind: 'redpacket' | 'delivery'): { amount?: number; item?: string; note?: string } {
  const parts = payload
    .split(/[|｜]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const num = (s?: string) => {
    const v = Number((s ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : undefined;
  };
  if (kind === 'redpacket') return { amount: num(parts[0]), note: parts.slice(1).join(' ') || undefined };
  const item = parts[0];
  const price = num(parts[1]);
  const note = price !== undefined ? parts.slice(2).join(' ') : parts.slice(1).join(' ');
  return { item, amount: price, note: note || undefined };
}

/** 今天这种东西还能不能送（每天每种最多 HIS_GIFT_PER_DAY 次） */
export function giftAllowed(w: HisWallet | undefined, kind: 'redpacket' | 'delivery', now = Date.now()): boolean {
  const day = fortuneDayKey(now);
  const g = w?.gifts;
  if (!g || g.day !== day) return true;
  return (g[kind] ?? 0) < HIS_GIFT_PER_DAY;
}

export function giftsAfter(w: HisWallet | undefined, kind: 'redpacket' | 'delivery', now = Date.now()): NonNullable<HisWallet['gifts']> {
  const day = fortuneDayKey(now);
  const g = w?.gifts && w.gifts.day === day ? w.gifts : { day, redpacket: 0, delivery: 0 };
  return { ...g, [kind]: (g[kind] ?? 0) + 1 };
}

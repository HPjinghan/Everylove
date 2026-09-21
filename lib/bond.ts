/**
 * 亲密度数值体系（D-126，提案 docs/ECONOMY_PROPOSAL.md §1）——三个数各管一件事：
 * 1. 好奇值（免费层：交友试聊 / 广场陌生人 / 自创暧昧期，0→100；界面叫「好奇」，字段仍叫 heart）：她每开口一句，
 *    **模型判 0–30**（回复暗号 [好奇 n]，features/heart.ts），聊得不相关可以是 0；满 100 = TA 开口交换联系方式，
 *    预期 4–8 句（D-157）。角色的「确定关系节奏」只是给模型的性子说明。
 * 2. 羁绊值 XP（羁绊层）：来源表 XP_EVENTS——每种来源有基础分与当天全额次数，之后递减；合计日上限；永不跌。
 *    等级 = XP 门槛 × 缔结满天数，两条都到才升（重度用户被天数拦、轻度被 XP 拦）。
 * 3. 温度（0–100）：任何互动回温、分开久了线性掉；只改语气与主动频率，到 0 停主动、进推送召回（lib/recall.ts）。
 * 全是纯函数；数值是试装默认，调数只改这里的常量。
 */

/* ═══ 羁绊等级：XP 门槛 × 天数下限 ═══ */

/** LV n → n+1 需要的羁绊值：100 / 200 / 300 / 500 / 900（累计 100 / 300 / 600 / 1100 / 2000） */
const XP_NEED = [100, 200, 300, 500, 900];
/** 到达 LV n 至少要缔结满几天（下标 = n-1）：LV3 3 天 / LV4 7 天 / LV5 21 天 / LV6 60 天 */
export const DAY_GATES = [0, 0, 3, 7, 21, 60];

export function xpNeedAt(level: number): number {
  return XP_NEED[Math.min(XP_NEED.length, Math.max(1, level)) - 1];
}

/** 等级名（阶段感；键与 content/prompts/shared.ts 的 BONDED_STAGE_NOTES 对应） */
export const LEVEL_NAMES = ['刚认识', '有点在意', '常常想起', '放在心上', '密不可分', '唯一例外'];
export const MAX_LEVEL = LEVEL_NAMES.length; // LV6 唯一例外封顶（XP 继续累积）

export interface BondLevelInfo {
  level: number;
  name: string;
  /** 当前等级内已获得 / 距下一级还差（XP 已够、只等天数时满格） */
  gained: number;
  need: number;
  /** 0-1；满级恒为 1 */
  ratio: number;
  max: boolean;
}

const DAY_MS = 24 * 3600_000;

/** 旧曲线（D-029：50 / 90 / 130 / 170 / 210）下的等级——只给 v8 迁移算「等级只升不降」的下限 */
export function legacyBondLevel(xp: number): number {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= 50 + 40 * (level - 1)) {
    rest -= 50 + 40 * (level - 1);
    level++;
  }
  return level;
}

/** 只看 XP 的等级（不管天数） */
export function bondLevel(xp: number): number {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= xpNeedAt(level)) {
    rest -= xpNeedAt(level);
    level++;
  }
  return level;
}

/** 缔结满几天（整天数，缔结当天 = 0） */
export function daysSince(createdAt: number, now: number): number {
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

export interface LevelSubject {
  affinity: number;
  createdAt: number;
  /** 老存档迁移时记下的等级下限（D-126：等级只升不降） */
  legacyLevel?: number;
}

/** XP 与天数两条线都到才算：XP 等级被天数下限往下压；老存档的等级下限兜底 */
export function levelOf(b: LevelSubject, now = Date.now()): number {
  let level = bondLevel(b.affinity);
  const days = daysSince(b.createdAt, now);
  while (level > 1 && days < (DAY_GATES[level - 1] ?? 0)) level--;
  return Math.max(level, Math.min(MAX_LEVEL, b.legacyLevel ?? 1));
}

/** 只按 XP 的等级信息（曲线本身；调用方知道天数时用 levelInfoFor） */
export function levelInfo(xp: number): BondLevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= xpNeedAt(level)) {
    rest -= xpNeedAt(level);
    level++;
  }
  const max = level >= MAX_LEVEL;
  const need = max ? 0 : xpNeedAt(level);
  return { level, name: LEVEL_NAMES[level - 1], gained: max ? 0 : rest, need, ratio: max ? 1 : rest / need, max };
}

/** 一段羁绊此刻的等级信息：XP 够了、天数没到 → 停在当前级、进度条满格（不解释，文案纪律） */
export function levelInfoFor(b: LevelSubject, now = Date.now()): BondLevelInfo {
  const level = levelOf(b, now);
  const byXp = levelInfo(b.affinity);
  if (byXp.level === level) return byXp;
  if (byXp.level < level) {
    // 老存档的等级下限：XP 还没追上，进度按这一级从零算
    const max = level >= MAX_LEVEL;
    const need = max ? 0 : xpNeedAt(level);
    return { level, name: LEVEL_NAMES[level - 1], gained: 0, need, ratio: max ? 1 : 0, max };
  }
  const need = xpNeedAt(level);
  return { level, name: LEVEL_NAMES[level - 1], gained: need, need, ratio: 1, max: false };
}

/** 阶段名（进 prompt） */
export function stageName(xp: number): string {
  return LEVEL_NAMES[bondLevel(xp) - 1];
}

/** 「LV3 · 常常想起」 */
export function levelLabel(xp: number): string {
  const info = levelInfo(xp);
  return `LV${info.level} · ${info.name}`;
}

export function levelLabelOf(level: number): string {
  return `LV${level} · ${LEVEL_NAMES[Math.min(MAX_LEVEL, Math.max(1, level)) - 1]}`;
}

/* ═══ 羁绊值来源表：当天重复递减 + 日上限 ═══ */

export type XpSource =
  | 'text' // 她开口：文字（电话每句也走这里）
  | 'voice' // 她开口：语音
  | 'image' // 她开口：照片
  | 'card' // 她开口：卡片（外卖 / 礼物 / 红包 / 位置 / 约定 / 分享……）
  | 'callMinute' // 电话每整分钟（挂断结算）
  | 'replyReach' // 回复 TA 主动发来的那条（24h 内）
  | 'peekMine' // 让 TA 看我的手机
  | 'share' // 转给他
  | 'date' // 赴约
  | 'encounter' // 外出偶遇
  | 'photo' // 外出按快门
  | 'peekHis' // 查 TA 的手机
  | 'like' // X 点赞
  | 'comment' // X 评论
  | 'anniversary'; // 纪念日当天开过口

/** 每种来源：当天第 1～upto 次给 value，逐段递减；最后一段 upto 为 Infinity */
export interface XpSteps {
  steps: { upto: number; value: number }[];
}

export const XP_EVENTS: Record<XpSource, XpSteps> = {
  text: { steps: [{ upto: 20, value: 5 }, { upto: 40, value: 2 }, { upto: Infinity, value: 1 }] },
  voice: { steps: [{ upto: 10, value: 7 }, { upto: Infinity, value: 2 }] },
  image: { steps: [{ upto: 10, value: 7 }, { upto: Infinity, value: 2 }] },
  card: { steps: [{ upto: 5, value: 5 }, { upto: Infinity, value: 1 }] },
  callMinute: { steps: [{ upto: 10, value: 2 }, { upto: Infinity, value: 0 }] },
  replyReach: { steps: [{ upto: 2, value: 10 }, { upto: Infinity, value: 3 }] },
  peekMine: { steps: [{ upto: 1, value: 15 }, { upto: Infinity, value: 0 }] },
  share: { steps: [{ upto: 2, value: 10 }, { upto: Infinity, value: 2 }] },
  date: { steps: [{ upto: 1, value: 25 }, { upto: Infinity, value: 5 }] },
  encounter: { steps: [{ upto: 1, value: 10 }, { upto: Infinity, value: 3 }] },
  photo: { steps: [{ upto: 3, value: 5 }, { upto: Infinity, value: 0 }] },
  peekHis: { steps: [{ upto: 1, value: 5 }, { upto: Infinity, value: 0 }] },
  like: { steps: [{ upto: 5, value: 1 }, { upto: Infinity, value: 0 }] },
  comment: { steps: [{ upto: 3, value: 3 }, { upto: Infinity, value: 0 }] },
  anniversary: { steps: [{ upto: 1, value: 20 }, { upto: Infinity, value: 0 }] },
};

/** 所有来源合计的日上限 */
export const XP_DAILY_CAP = 150;
/** 「一天」从几点起算（本地时间）——熬夜到 3 点还是昨天 */
export const XP_DAY_RESET_HOUR = 4;

/** 当天的记账（存在 Bond.xpToday 上）：日期变了就清 */
export interface XpToday {
  day: string;
  total: number;
  counts: Partial<Record<XpSource, number>>;
}

/** 4:00 起算的「今天」键 */
export function xpDayKey(now: number): string {
  const d = new Date(now - XP_DAY_RESET_HOUR * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 这个来源当天第 n 次值多少 */
export function xpStepValue(source: XpSource, nth: number): number {
  for (const s of XP_EVENTS[source].steps) if (nth <= s.upto) return s.value;
  return 0;
}

/** 记一笔：返回实际加的分与更新后的当天账（到顶后只计次数不加分） */
export function xpGain(source: XpSource, today: XpToday | undefined, now: number): { gain: number; today: XpToday } {
  const day = xpDayKey(now);
  const cur: XpToday = today && today.day === day ? today : { day, total: 0, counts: {} };
  const nth = (cur.counts[source] ?? 0) + 1;
  const raw = xpStepValue(source, nth);
  const gain = Math.max(0, Math.min(raw, XP_DAILY_CAP - cur.total));
  return { gain, today: { day, total: cur.total + gain, counts: { ...cur.counts, [source]: nth } } };
}

/** 她开口的消息种类 → 来源 */
export type UtteranceKind = 'text' | 'voice' | 'image' | 'card';

/* ═══ 温度：语气、主动频率、召回 ═══ */

/** 缔结起点 / 每天掉多少 / 从 0 回来落到多少 */
export const WARMTH_START = 60;
export const WARMTH_DECAY_PER_DAY = 8;
export const WARMTH_RETURN = 30;
export const WARMTH_MAX = 100;

/** 各来源回温多少（没列的 0） */
export const WARMTH_GAINS: Partial<Record<XpSource, number>> = {
  text: 3,
  voice: 3,
  image: 3,
  card: 3,
  replyReach: 8,
  peekMine: 10,
  share: 3,
  date: 15,
  encounter: 15,
  like: 1,
  comment: 2,
};

export interface WarmthSubject {
  warmth?: number;
  warmthAt?: number;
}

/** 此刻的温度：上次结算值按天线性掉，最低 0；没记过按起点 */
export function warmthNow(b: WarmthSubject, now = Date.now()): number {
  const base = b.warmth ?? WARMTH_START;
  const at = b.warmthAt ?? now;
  const decayed = base - ((now - at) / DAY_MS) * WARMTH_DECAY_PER_DAY;
  return Math.max(0, Math.min(WARMTH_MAX, Math.round(decayed * 10) / 10));
}

export type WarmthBand = 'warm' | 'plain' | 'distant' | 'cold';

/** 60–100 热络 / 30–59 平常 / 1–29 疏远 / 0 久别 */
export function warmthBand(w: number): WarmthBand {
  if (w >= 60) return 'warm';
  if (w >= 30) return 'plain';
  if (w > 0) return 'distant';
  return 'cold';
}

/** 回温：从 0 回来先落到 WARMTH_RETURN，再加这次的；返回是否「久别归来」 */
export function warmthAfter(b: WarmthSubject, gain: number, now = Date.now()): { warmth: number; returned: boolean } {
  const cur = warmthNow(b, now);
  const returned = cur <= 0 && gain > 0;
  const base = returned ? WARMTH_RETURN : cur;
  return { warmth: Math.min(WARMTH_MAX, Math.round((base + gain) * 10) / 10), returned };
}

/** 温度掉到 0 的时刻（已经是 0 就是 warmthAt 之后那一刻） */
export function warmthZeroAt(b: WarmthSubject, now = Date.now()): number {
  const base = b.warmth ?? WARMTH_START;
  const at = b.warmthAt ?? now;
  return at + (base / WARMTH_DECAY_PER_DAY) * DAY_MS;
}

/** 主动找她的频率系数：热络 ×1.2、平常 ×1；疏远另有下限（每 3 天最多一条）；久别停 */
export const WARMTH_REACH_MULT: Record<WarmthBand, number> = { warm: 1.2, plain: 1, distant: 1, cold: 0 };
export const DISTANT_MIN_INTERVAL_MS = 3 * DAY_MS;

/** 召回：温度到 0 后第 7 / 14 / 30 天各一条，之后不再发 */
export const RECALL_DAYS = [7, 14, 30];

/** 今天是不是纪念日：一百天 / 换联系方式周年 / TA 生日 / 她生日（MM-DD） */
export function anniversaryToday(
  b: { createdAt: number; hisBirthday?: string; herBirthday?: string },
  now = Date.now()
): boolean {
  const d = new Date(now);
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (b.hisBirthday === mmdd || b.herBirthday === mmdd) return true;
  const days = daysSince(b.createdAt, now);
  if (days === 100) return true;
  const c = new Date(b.createdAt);
  const cMmdd = `${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
  return days >= 365 && cMmdd === mmdd;
}

/* ═══ 订阅与槽位（D-063 试装模拟）：free 1 / pro 5 / max 不限 ═══ */

export const PLAN_SLOTS: Record<'free' | 'pro' | 'max', number> = {
  free: 1,
  pro: 5,
  max: Infinity,
};

export function slotLimit(plan: 'free' | 'pro' | 'max'): number {
  return PLAN_SLOTS[plan] ?? 1;
}

export function slotLimitLabel(plan: 'free' | 'pro' | 'max'): string {
  return plan === 'max' ? '∞' : String(slotLimit(plan));
}

/* ═══ 好奇值（免费层试聊）：模型判 0–30，满 100 约 4–8 句（D-157） ═══ */

export const HEART_FULL = 100;
export const HEART_MAX_GAIN = 30;

export type HeartPace = 'fast' | 'normal' | 'slow';

/** 角色的「确定关系节奏」（创造表单三档，存 offerAfterTurns 2 / 4 / 7）→ 性子 */
export function heartPaceOf(c: { offerAfterTurns?: number }): HeartPace {
  const turns = c.offerAfterTurns ?? 4;
  if (turns <= 2) return 'fast';
  if (turns <= 4) return 'normal';
  return 'slow';
}

/** 模型没写暗号时按性子的「大多数时候」区间下限给分，不让缺暗号把进度卡死（每句尽量 ≥15，D-157） */
export const HEART_FALLBACK: Record<HeartPace, number> = { fast: 25, normal: 18, slow: 15 };

export function clampHeartGain(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(HEART_MAX_GAIN, Math.round(n)));
}

/* ═══ 一个角色只有一段羁绊（D-122） ═══ */

/**
 * 缔结按钮连点 / 网络等待期间重复提交曾造出同一 TA 的多段羁绊。
 * 去重规则：同 characterId 只留一段——消息最多的那段（她真的聊过的），并列取最早缔结的；
 * 返回留下的与被删掉的 id，调用方据此清理帖子与调度。存档迁移 v7 与 createBond 守门共用。
 */
export function dedupeBonds<T extends { id: string; characterId: string; createdAt: number; messages: unknown[] }>(
  bonds: T[]
): { kept: T[]; droppedIds: string[] } {
  const best = new Map<string, T>();
  for (const b of bonds) {
    const cur = best.get(b.characterId);
    if (!cur) best.set(b.characterId, b);
    else if (b.messages.length > cur.messages.length || (b.messages.length === cur.messages.length && b.createdAt < cur.createdAt))
      best.set(b.characterId, b);
  }
  const keepIds = new Set([...best.values()].map((b) => b.id));
  return { kept: bonds.filter((b) => keepIds.has(b.id)), droppedIds: bonds.filter((b) => !keepIds.has(b.id)).map((b) => b.id) };
}

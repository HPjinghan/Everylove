/**
 * 心动值 & 羁绊等级系统（D-029）。
 *
 * 两段式关系数值：
 * 1. 心动值（广场试聊，0→100）：每次她开口都会涨（速度由角色的「确定关系节奏」offerAfterTurns 决定，
 *    带随机浮动）。满 100 = 羁绊 LV1 达成——TA 主动交换联系方式，然后说去忙了（广场偶遇的告别），
 *    直到八点开门前不再回消息。
 * 2. 羁绊值（加好友后累积 XP）：从 LV1 / 0 XP 开始，升级门槛线性递增（成长曲线），
 *    等级名进对话 prompt 的「阶段感」。升级瞬间：会话里出现系统提示 + 一格你们的画面（D-024）。
 *
 * 正式版数值另调；这里的曲线以试装节奏为准（几十条消息内能感到成长）。
 */

/** LV n → n+1 需要的羁绊值：50、90、130、170、210…（线性递增的成长曲线） */
export function xpNeedAt(level: number): number {
  return 50 + 40 * (level - 1);
}

/** 等级名（阶段感；键与 content/prompts.ts 的 BONDED_STAGE_NOTES 对应） */
export const LEVEL_NAMES = ['刚认识', '有点在意', '常常想起', '放在心上', '密不可分', '唯一例外'];
export const MAX_LEVEL = LEVEL_NAMES.length; // LV6 唯一例外封顶（XP 继续累积）

export interface BondLevelInfo {
  level: number;
  name: string;
  /** 当前等级内已获得 / 距下一级还差 */
  gained: number;
  need: number;
  /** 0-1；满级恒为 1 */
  ratio: number;
  max: boolean;
}

export function bondLevel(xp: number): number {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= xpNeedAt(level)) {
    rest -= xpNeedAt(level);
    level++;
  }
  return level;
}

export function levelInfo(xp: number): BondLevelInfo {
  let level = 1;
  let rest = Math.max(0, xp);
  while (level < MAX_LEVEL && rest >= xpNeedAt(level)) {
    rest -= xpNeedAt(level);
    level++;
  }
  const max = level >= MAX_LEVEL;
  const need = max ? 0 : xpNeedAt(level);
  return {
    level,
    name: LEVEL_NAMES[level - 1],
    gained: max ? 0 : rest,
    need,
    ratio: max ? 1 : rest / need,
    max,
  };
}

/** 阶段名（进 prompt；等价于 levelInfo(xp).name） */
export function stageName(xp: number): string {
  return LEVEL_NAMES[bondLevel(xp) - 1];
}

/** 「LV3 · 常常想起」 */
export function levelLabel(xp: number): string {
  const info = levelInfo(xp);
  return `LV${info.level} · ${info.name}`;
}

/* ── 羁绊值获取速率（试装）──
 * D-030：目前只有「她发一条消息 +5」这一个来源；开门/画面/心跳的加成已按 Harper 指示移除，
 * 数值体系另行专门设计。 */
export const XP_PER_MESSAGE = 5; // 她发一条消息

/* ── 心动值（广场试聊） ── */
export const HEART_FULL = 100;

/**
 * 她这一句带来的心动值：满 100 约需 offerAfterTurns 句（角色的「确定关系节奏」），±15% 浮动。
 * salt 用于确定性伪随机（同一句不重复计算）。
 */
export function heartGain(paceTurns: number, salt: number): number {
  const base = HEART_FULL / Math.max(1, paceTurns);
  const jitter = 0.85 + ((Math.abs(salt * 2654435761) % 1000) / 1000) * 0.3;
  return Math.max(1, Math.round(base * jitter));
}

/**
 * TA 的手机密码（D-082）：查手机第一次要先拿到密码——在聊天里问 TA（TA 答应就解锁），或在锁屏上自己猜（猜对就开）。
 * 密码**随机**：第一次需要时（她第一次问 / 第一次点开锁屏）生成 4 位并记在这段羁绊上（`Bond.phoneCode`，
 * store.ensurePhoneCode），之后 TA 的 prompt 与锁屏共用同一把；解锁后 `Bond.phoneUnlocked`。
 * 给不给（D-244）：不交给模型临场决定（模型几乎总是答应），每天按羁绊等级 × 她在 TA 心里的分量定一次——
 * 聊天里问、锁屏上问都是同一个答案；今天不给，prompt 里就没有这四位数。
 */

import type { HerShareTier } from '@/lib/her-share';

export const PHONE_PASSCODE_LENGTH = 4;

/** 四位随机数字（允许前导 0，像真的锁屏密码） */
export function randomPasscode(): string {
  let s = '';
  for (let i = 0; i < PHONE_PASSCODE_LENGTH; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** 愿意把手机给她看的概率：按羁绊等级（下标 = LV − 1）；她在 TA 心里分量重的松一些、独立的紧一些 */
const WILLING_BY_LEVEL = [0.15, 0.3, 0.5, 0.7, 0.85, 1];
const WILLING_TIER: Record<HerShareTier, number> = { devoted: 0.15, balanced: 0, independent: -0.15 };
/** 一天从凌晨 4 点算（同 XP 记账） */
const DAY_START_MS = 4 * 3600_000;

/** 0–1 的稳定哈希（FNV-1a）：同一把密码、同一天结果不变 */
function unitHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

export function passcodeWillingChance(level: number, tier: HerShareTier): number {
  const base = WILLING_BY_LEVEL[Math.min(Math.max(level, 1), WILLING_BY_LEVEL.length) - 1];
  return Math.min(1, Math.max(0.05, base + WILLING_TIER[tier]));
}

/** 今天 TA 肯不肯把手机密码给她：一天一个答案（以密码本身作种子，每段羁绊不同） */
export function passcodeWillingToday(code: string, level: number, tier: HerShareTier, now: number): boolean {
  const d = new Date(now - DAY_START_MS);
  return unitHash(`${code}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`) < passcodeWillingChance(level, tier);
}

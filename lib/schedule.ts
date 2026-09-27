/**
 * 「按 MBTI 定频」的公共件（D-188）：发帖 / 记事本 / 主动消息 / 身边的人续写各自的表不同，公式一样。
 */

/** MBTI 表 → 每天几次；没 MBTI 或表里没有 → fallback */
export function perDayOf(mbti: string | undefined, table: Record<string, number>, fallback: number): number {
  return (mbti && table[mbti.trim().toUpperCase()]) || fallback;
}

/** 下一次的间隔：24h / 每天次数，±35% 抖动（别像闹钟一样准点） */
export function jitteredIntervalMs(perDay: number, rand = Math.random()): number {
  return Math.round(((24 * 3600_000) / perDay) * (0.65 + rand * 0.7));
}

/** MBTI 第一个字母：E / I；没有或不认识 → undefined */
export function mbtiAxis(mbti: string | undefined): 'E' | 'I' | undefined {
  const first = mbti?.trim().toUpperCase()[0];
  return first === 'E' || first === 'I' ? first : undefined;
}

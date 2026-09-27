/**
 * 心跳三段式的时间点过勿扰（D-174）：默认 23–8，「当天 7:00 加油」推到 8:00；18:00 / 12:00 不动；勿扰改成 1–6 时 7:00 不动。
 */
import { describe, expect, it } from 'vitest';

import { stageDue } from '@/lib/heartbeat';

const day = new Date(2026, 8, 10, 0, 0, 0, 0); // 2026-09-10
const hm = (ts: number) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('心跳时间点过勿扰', () => {
  it('默认 23–8：当天加油 7:00 → 8:00，前一天 18:00 与次日 12:00 不动', () => {
    const q = { from: 23, to: 8 };
    expect(hm(stageDue(day, 'caredBefore', q))).toBe('9-9 18:00');
    expect(hm(stageDue(day, 'caredDay', q))).toBe('9-10 8:00');
    expect(hm(stageDue(day, 'caredAfter', q))).toBe('9-11 12:00');
  });
  it('勿扰 1–6：7:00 不在静默里，照旧', () => {
    expect(hm(stageDue(day, 'caredDay', { from: 1, to: 6 }))).toBe('9-10 7:00');
  });
  it('勿扰 22–9：18:00 不动、7:00 推到 9:00', () => {
    expect(hm(stageDue(day, 'caredBefore', { from: 22, to: 9 }))).toBe('9-9 18:00');
    expect(hm(stageDue(day, 'caredDay', { from: 22, to: 9 }))).toBe('9-10 9:00');
  });
});

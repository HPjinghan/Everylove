/**
 * TA 主动找她（D-114）：频率按强度 × MBTI × 等级、静默时段顺延、守门（她刚说过话 / 未读堆着不发）、钟的排法。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '@/features';

import { buildReachOutUserLine } from '@/content/prompts';
import { deliverDueReachOuts, HER_RECENT_MS, outsideQuiet, reachAllowed, reachIntervalMs } from '@/lib/reach-out';
import { setLang } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

beforeEach(() => {
  setLang('zh');
  useAppStore.getState().resetAll();
});

const DAY = 24 * 3600_000;

describe('频率', () => {
  it('强度高的比低的勤；E 比 I 勤；越熟越勤（rand 固定为中值）', () => {
    const mid = reachIntervalMs({ initiative: 'mid' }, 0, 0.5);
    expect(reachIntervalMs({ initiative: 'high' }, 0, 0.5)).toBeLessThan(mid);
    expect(reachIntervalMs({ initiative: 'low' }, 0, 0.5)).toBeGreaterThan(mid);
    expect(reachIntervalMs({ initiative: 'mid', mbti: 'ENFP' }, 0, 0.5)).toBeLessThan(mid);
    expect(reachIntervalMs({ initiative: 'mid', mbti: 'INTJ' }, 0, 0.5)).toBeGreaterThan(mid);
    expect(reachIntervalMs({ initiative: 'mid' }, 400, 0.5)).toBeLessThan(mid);
    // 中 1.2 条/天 ≈ 20 小时；抖动 ±35%
    expect(mid).toBeGreaterThan(DAY / 1.2 / 1.4);
    expect(mid).toBeLessThan((DAY / 1.2) * 1.4);
  });
});

describe('静默时段', () => {
  it('23:00–08:00 顺延到早上 8 点之后；白天原样', () => {
    const noon = new Date(2026, 8, 10, 12, 0).getTime();
    expect(outsideQuiet(noon, 0)).toBe(noon);
    const late = new Date(2026, 8, 10, 23, 30).getTime();
    expect(new Date(outsideQuiet(late, 0)).getHours()).toBe(8);
    expect(new Date(outsideQuiet(late, 0)).getDate()).toBe(11);
    const early = new Date(2026, 8, 10, 3, 0).getTime();
    expect(new Date(outsideQuiet(early, 0.5)).getHours()).toBe(8);
    expect(new Date(outsideQuiet(early, 0.5)).getDate()).toBe(10);
  });
});

describe('守门（红线 6）', () => {
  it('她 3 小时内说过话不发；未读堆到 2 条不发', () => {
    const now = Date.now();
    const base = { unread: 0, messages: [{ id: 'a', from: 'me' as const, kind: 'text' as const, text: '嗯', at: now - HER_RECENT_MS + 60_000 }] };
    expect(reachAllowed(base, now)).toBe(false);
    expect(reachAllowed({ ...base, messages: [{ ...base.messages[0], at: now - HER_RECENT_MS - 60_000 }] }, now)).toBe(true);
    expect(reachAllowed({ unread: 2, messages: [] }, now)).toBe(false);
  });
});

describe('调度', () => {
  it('首次只排钟不发；到点 AI 不可用 = 不发但钟照排', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    useAppStore.getState().markBondRead(bondId);
    const now = new Date(2026, 8, 10, 12, 0).getTime();
    expect(await deliverDueReachOuts(now)).toBe(0);
    const due = useAppStore.getState().reachSchedule[bondId];
    expect(due).toBeGreaterThan(now);
    const before = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length;
    expect(await deliverDueReachOuts(due + 1)).toBe(0);
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length).toBe(before);
    expect(useAppStore.getState().reachSchedule[bondId]).toBeGreaterThan(due);
  });
});

describe('温度（D-126）', () => {
  it('疏远时每 3 天最多一条；久别（温度 0）主动停、写好的作废', async () => {
    expect(reachIntervalMs({ initiative: 'high', mbti: 'ENFP' }, 2000, 0, 'distant')).toBe(3 * DAY);
    expect(reachIntervalMs({ initiative: 'mid' }, 0, 0.5, 'warm')).toBeLessThan(reachIntervalMs({ initiative: 'mid' }, 0, 0.5, 'plain'));
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    useAppStore.getState().markBondRead(bondId);
    const now = new Date(2026, 8, 10, 12, 0).getTime();
    await deliverDueReachOuts(now);
    const due = useAppStore.getState().reachSchedule[bondId];
    // 温度掉到 0（起点 60，每天 −8 → 8 天后）
    useAppStore.setState({ bonds: useAppStore.getState().bonds.map((b) => (b.id === bondId ? { ...b, warmthAt: now - 10 * DAY } : b)) });
    const before = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length;
    expect(await deliverDueReachOuts(due + 1)).toBe(0);
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length).toBe(before);
    // 钟留在原地（她回来后按新上下文重排）
    expect(useAppStore.getState().reachSchedule[bondId]).toBe(due);
  });
});

describe('舞台提示', () => {
  it('带此刻、她多久没说话、上一条是谁说的，且要求不问在吗；TA 的日子走系统 prompt（D-158）', () => {
    const line = buildReachOutUserLine({
      now: new Date(2026, 8, 10, 21, 30),
      weather: '今天多云',
      hoursSinceHer: 5,
      last: { from: 'me', text: '晚安' },
    });
    expect(line).toContain('5 hours ago');
    expect(line).not.toContain('notebook');
    expect(line).toContain('was hers: "晚安"');
    expect(line).toContain("Don't ask \"you there?\"");
  });
});

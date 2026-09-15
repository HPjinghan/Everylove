/**
 * TA 主动的额外动作（D-130）：等级门（红包 LV2 / 外卖 LV3 / 发图 LV2）、10 条冷却、确定性概率、暗号落状态时门没过就当没写。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders } from '@/core/providers';
import { sendText } from '@/core/turn';
import { EXTRA_COOLDOWN_TURNS, EXTRA_MIN_LEVEL, extraEligible, extraOffered, extraProb, extraRand, himTurnCount } from '@/lib/extras';
import { useAppStore } from '@/store/app-store';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

let nextReply = '嗯。';
chatProviders.register({ id: 'fake-extras', label: 'fake', localKey: () => 'k', async complete() { return nextReply; } });

beforeEach(() => {
  useAppStore.getState().resetAll();
  nextReply = '嗯。';
});

const DAY = 24 * 3600_000;
const NOW = new Date(2026, 8, 15, 12).getTime();
const him = (n: number) => Array.from({ length: n }, () => ({ from: 'him' as const }));

describe('三道门', () => {
  it('等级门：红包 LV2、外卖 LV3、发图 LV2', () => {
    expect(EXTRA_MIN_LEVEL).toEqual({ redpacket: 2, delivery: 3, photo: 2 });
    const lv1 = { affinity: 0, createdAt: NOW - 5 * DAY };
    const lv2 = { affinity: 100, createdAt: NOW - 5 * DAY };
    const lv3 = { affinity: 300, createdAt: NOW - 5 * DAY };
    expect(extraEligible(lv1, 'redpacket', [], NOW)).toBe(false);
    expect(extraEligible(lv2, 'redpacket', [], NOW)).toBe(true);
    expect(extraEligible(lv2, 'photo', [], NOW)).toBe(true);
    expect(extraEligible(lv2, 'delivery', [], NOW)).toBe(false);
    expect(extraEligible(lv3, 'delivery', [], NOW)).toBe(true);
    // XP 够但天数不够（LV3 要 3 天）
    expect(extraEligible({ affinity: 300, createdAt: NOW - DAY }, 'delivery', [], NOW)).toBe(false);
  });

  it('冷却：触发过之后 TA 再说满 10 条才能再触发（任何一种都算）', () => {
    const b = { affinity: 300, createdAt: NOW - 5 * DAY, extraFired: { count: 4, at: NOW } };
    expect(himTurnCount([{ from: 'him' }, { from: 'me' }, { from: 'system' }, { from: 'him' }])).toBe(2);
    expect(extraEligible(b, 'redpacket', him(4 + EXTRA_COOLDOWN_TURNS - 1), NOW)).toBe(false);
    expect(extraEligible(b, 'photo', him(4 + EXTRA_COOLDOWN_TURNS), NOW)).toBe(true);
  });

  it('概率：确定性伪随机；强度高 / 温度热络更常给，久别不给', () => {
    expect(extraRand('a')).toBe(extraRand('a'));
    expect(extraRand('a')).not.toBe(extraRand('b'));
    const warm = { warmth: 80, warmthAt: NOW };
    expect(extraProb(warm, { initiative: 'high' }, 'photo', NOW)).toBeGreaterThan(extraProb(warm, { initiative: 'mid' }, 'photo', NOW));
    expect(extraProb(warm, { initiative: 'low' }, 'photo', NOW)).toBeLessThan(extraProb(warm, { initiative: 'mid' }, 'photo', NOW));
    expect(extraProb({ warmth: 0, warmthAt: NOW }, { initiative: 'high' }, 'redpacket', NOW)).toBe(0);
    // 大量轮次里给选项的比例接近概率
    const b = { affinity: 300, createdAt: NOW - 5 * DAY, warmth: 50, warmthAt: NOW };
    let offered = 0;
    for (let n = 0; n < 2000; n++) if (extraOffered(b, { initiative: 'mid' }, 'photo', him(n), NOW)) offered++;
    expect(offered / 2000).toBeGreaterThan(0.05);
    expect(offered / 2000).toBeLessThan(0.16);
  });
});

describe('暗号落状态也过门', () => {
  it('LV1 写了 [发红包] 当没写；升到 LV2 才落；落完 10 条内 [点外卖] / [发图] 不落', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const scope = { mode: 'bonded' as const, bondId };
    nextReply = '拿着。\n[发红包 52|去吃点好的]';
    await sendText(scope, '好累', { ui: { pace: 'none' } });
    expect(bond().messages.at(-1)!.kind).toBe('text');
    expect(bond().wallet?.balance).toBe(2000);
    // 升到 LV3（300 XP + 5 天）
    useAppStore.setState({ bonds: useAppStore.getState().bonds.map((b) => (b.id === bondId ? { ...b, affinity: 300, createdAt: Date.now() - 5 * DAY } : b)) });
    await sendText(scope, '真的好累', { ui: { pace: 'none' } });
    expect(bond().messages.at(-1)!.card?.type).toBe('redpacket');
    expect(bond().extraFired?.count).toBe(himTurnCount(bond().messages));
    nextReply = '吃点东西。\n[点外卖 姜茶|20|趁热]';
    await sendText(scope, '嗯', { ui: { pace: 'none' } });
    expect(bond().messages.at(-1)!.kind).toBe('text');
    expect(bond().wallet?.balance).toBe(2000 - 52);
  });
});

/**
 * 流量与模型档（D-132）：先扣免费再扣余额、Max 不扣、按模型档计价、不够就发不出（她的话不落会话）、
 * 订阅每月发流量、后台任务不扣、模型档 → 供应商的选路。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders, currentChatProvider, setUserProviderChoice } from '@/core/providers';
import { sendText } from '@/core/turn';
import { canAfford, DAILY_FREE_MB, freeLeft, LOVE_MODELS, mb, PLAN_MONTHLY_MB, planGrantsDue, trafficAfterUse, trafficDayKey } from '@/lib/traffic';
import { grantPlanTraffic } from '@/features/traffic';
import { useAppStore } from '@/store/app-store';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

chatProviders.register({ id: 'fake-traffic', label: 'fake', localKey: () => 'k', async complete() { return '嗯。'; } });

beforeEach(() => {
  useAppStore.getState().resetAll();
});

const DAY = 24 * 3600_000;
const NOW = new Date(2026, 8, 15, 12).getTime();
const noPace = { pace: 'none' as const };

describe('计量', () => {
  it('先用今天免费的 30 MB，再扣余额；Max 不扣；跨天免费的重置', () => {
    const t0 = { balance: 10, freeDay: '', freeUsed: 0 };
    expect(freeLeft(t0, NOW)).toBe(DAILY_FREE_MB);
    const a = trafficAfterUse(t0, 5, 'free', NOW);
    expect(a).toEqual({ traffic: { balance: 10, freeDay: trafficDayKey(NOW), freeUsed: 5 }, charged: 5 });
    const b = trafficAfterUse({ ...a.traffic, freeUsed: 28 }, 5, 'free', NOW);
    expect(b.traffic.freeUsed).toBe(30);
    expect(b.traffic.balance).toBe(7);
    expect(canAfford({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 30 }, 1, 'free', NOW)).toBe(false);
    expect(canAfford({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 30 }, 1, 'max', NOW)).toBe(true);
    expect(trafficAfterUse({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 30 }, 5, 'max', NOW).charged).toBe(0);
    expect(freeLeft({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 30 }, NOW + DAY)).toBe(DAILY_FREE_MB);
    expect(mb(1240)).toBe('1,240 MB');
    expect(mb(Infinity)).toBe('∞');
  });

  it('模型档：love-v1 1 MB / 回合，love-v2 5 MB / 回合', () => {
    expect(LOVE_MODELS.v1.costMb).toBe(1);
    expect(LOVE_MODELS.v2.costMb).toBe(5);
    expect(LOVE_MODELS.v1.provider).toBe('qianfan');
    expect(LOVE_MODELS.v2.provider).toBe('anthropic');
  });

  it('订阅每月发一笔：Pro 2000 MB，最多补 2 笔；Free / Max 不发', () => {
    expect(planGrantsDue({ balance: 0, freeDay: '', freeUsed: 0 }, 'pro', NOW)).toBe(1);
    expect(planGrantsDue({ balance: 0, freeDay: '', freeUsed: 0, planGrantAt: NOW - 10 * DAY }, 'pro', NOW)).toBe(0);
    expect(planGrantsDue({ balance: 0, freeDay: '', freeUsed: 0, planGrantAt: NOW - 100 * DAY }, 'pro', NOW)).toBe(2);
    expect(planGrantsDue({ balance: 0, freeDay: '', freeUsed: 0 }, 'free', NOW)).toBe(0);
    expect(planGrantsDue({ balance: 0, freeDay: '', freeUsed: 0 }, 'max', NOW)).toBe(0);
    useAppStore.getState().setPlan('pro');
    expect(grantPlanTraffic(NOW)).toBe(1);
    expect(useAppStore.getState().traffic.balance).toBe(PLAN_MONTHLY_MB.pro);
    expect(useAppStore.getState().traffic.planGrantAt).toBe(NOW);
    expect(grantPlanTraffic(NOW + DAY)).toBe(0);
  });
});

describe('回合闸门', () => {
  it('她每开口一回合扣当前模型档；用完发不出、她的话不落会话；换 love-v2 一回合扣 5', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    const s = () => useAppStore.getState();
    await sendText(scope, '在吗', { ui: noPace });
    expect(s().traffic.freeUsed).toBe(1);
    s().setLoveModel('v2');
    await sendText(scope, '今天好累', { ui: noPace });
    expect(s().traffic.freeUsed).toBe(6);
    // 免费用完、余额 0：发不出，她的话不落会话
    useAppStore.setState({ traffic: { ...s().traffic, freeUsed: DAILY_FREE_MB, balance: 0 } });
    const before = s().bonds.find((b) => b.id === bondId)!.messages.length;
    const r = await sendText(scope, '还在吗', { ui: noPace });
    expect(r.reply).toBeNull();
    expect(s().bonds.find((b) => b.id === bondId)!.messages.length).toBe(before);
    // 买了流量包就能发
    s().addTraffic(500);
    await sendText(scope, '买了流量', { ui: noPace });
    expect(s().traffic.balance).toBe(495);
    // Max 不扣
    s().setPlan('max');
    await sendText(scope, '订了 Max', { ui: noPace });
    expect(s().traffic.balance).toBe(495);
  });
});

describe('选路', () => {
  it('玩家的模型档只在那家有路时生效；没有路就跟随原来的顺序（测试里落到假供应商）', () => {
    // 测试环境两家都没 key、代理不通：选了也落回假供应商
    setUserProviderChoice('anthropic');
    expect(currentChatProvider().id).not.toBe('anthropic');
    setUserProviderChoice('');
  });
});

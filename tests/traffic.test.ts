/**
 * 流量与模型档（D-132 / D-133）：按真实用量折 MB（聊天按 token × 供应商倍率、生图按张、合成按字、识别按秒）、先扣免费再扣余额、Max 不扣、
 * 用完她发不出、后台生成也被闸门拦下、订阅每月发流量、模型档 → 供应商的选路。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders, completeChat, currentChatProvider, setUserProviderChoice } from '@/core/providers';
import { estimateTokens, GenerationBlockedError } from '@/core/usage';
import { sendText } from '@/core/turn';
import { grantPlanTraffic } from '@/features/traffic';
import { available, DAILY_FREE_MB, freeLeft, IMAGE_MB, LOVE_MODELS, mb, mbForUsage, PLAN_MONTHLY_MB, planGrantsDue, trafficAfterUse, trafficDayKey } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

/** 假供应商：带真实 usage 回来 */
let usage: { inputTokens: number; outputTokens: number } | undefined = { inputTokens: 3000, outputTokens: 80 };
chatProviders.register({
  id: 'fake-traffic',
  label: 'fake',
  localKey: () => 'k',
  async complete() {
    return usage ? { text: '嗯。', usage } : '嗯。';
  },
});

beforeEach(() => {
  useAppStore.getState().resetAll();
  usage = { inputTokens: 3000, outputTokens: 80 };
});

const DAY = 24 * 3600_000;
const NOW = new Date(2026, 8, 15, 12).getTime();
const noPace = { pace: 'none' as const };

describe('换算', () => {
  it('聊天按 token × 供应商倍率；生图按张；合成按字；识别按秒；看图固定', () => {
    expect(mbForUsage({ kind: 'chat', provider: 'qianfan', inputTokens: 3000, outputTokens: 80 })).toBeCloseTo(3.08);
    expect(mbForUsage({ kind: 'chat', provider: 'anthropic', inputTokens: 3000, outputTokens: 80 })).toBeCloseTo(15.4);
    expect(mbForUsage({ kind: 'chat', provider: 'fake', inputTokens: 1000 })).toBe(1);
    expect(mbForUsage({ kind: 'image', provider: 'qwen-image', images: 1 })).toBe(IMAGE_MB);
    expect(mbForUsage({ kind: 'image', provider: 'qwen-image', images: 2 })).toBe(IMAGE_MB * 2);
    expect(mbForUsage({ kind: 'image', provider: 'musesteamer', outputTokens: 2000 })).toBe(6);
    expect(mbForUsage({ kind: 'tts', provider: 'baidu', chars: 400 })).toBe(2);
    expect(mbForUsage({ kind: 'asr', provider: 'baidu', seconds: 30 })).toBe(0.5);
    expect(mbForUsage({ kind: 'vision', provider: 'x' })).toBe(3);
    expect(LOVE_MODELS.v1.mbPerKTok).toBe(1);
    expect(LOVE_MODELS.v2.mbPerKTok).toBe(5);
    expect(estimateTokens('今天好累啊')).toBe(5);
    expect(estimateTokens('hello world')).toBe(3);
  });

  it('先用今天免费的 100 MB，再扣余额；Max 不扣；跨天免费的重置', () => {
    const t0 = { balance: 10, freeDay: '', freeUsed: 0 };
    expect(freeLeft(t0, NOW)).toBe(DAILY_FREE_MB);
    const a = trafficAfterUse(t0, 5, 'free', NOW);
    expect(a).toEqual({ traffic: { balance: 10, freeDay: trafficDayKey(NOW), freeUsed: 5 }, charged: 5 });
    const b = trafficAfterUse({ ...a.traffic, freeUsed: 98 }, 5, 'free', NOW);
    expect(b.traffic.freeUsed).toBe(100);
    expect(b.traffic.balance).toBe(7);
    expect(available({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 100 }, 'free', NOW)).toBe(0);
    expect(available({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 100 }, 'max', NOW)).toBe(Infinity);
    expect(trafficAfterUse({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 100 }, 5, 'max', NOW).charged).toBe(0);
    expect(freeLeft({ balance: 0, freeDay: trafficDayKey(NOW), freeUsed: 100 }, NOW + DAY)).toBe(DAILY_FREE_MB);
    expect(mb(1240)).toBe('1,240 MB');
    expect(mb(3.08)).toBe('3.1 MB');
    expect(mb(Infinity)).toBe('∞');
  });

  it('订阅每月发一笔：Pro 6000 MB，最多补 2 笔；Free / Max 不发', () => {
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

describe('扣账与闸门', () => {
  it('每次调用按供应商返回的 usage 扣；没 usage 按字数估；用完她发不出、话不落会话；买了包能发；Max 不扣', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    const s = () => useAppStore.getState();
    await sendText(scope, '在吗', { ui: noPace });
    // 假供应商不在换算表里按 1 MB / 千 token：3080 token → 3.08；流水记一笔
    expect(s().traffic.freeUsed).toBeCloseTo(3.08);
    expect(s().trafficLog.at(-1)).toMatchObject({ kind: 'reply', provider: 'fake-traffic', mb: 3.08, tokens: 3080, estimated: false });
    usage = undefined;
    await sendText(scope, '今天好累', { ui: noPace });
    // 按字数估：系统 prompt 两千多 token
    expect(s().traffic.freeUsed).toBeGreaterThan(4);
    expect(s().traffic.freeUsed).toBeLessThan(10);
    // 免费用完、余额 0：发不出，她的话不落会话
    useAppStore.setState({ traffic: { ...s().traffic, freeUsed: DAILY_FREE_MB, balance: 0 } });
    const before = s().bonds.find((b) => b.id === bondId)!.messages.length;
    const r = await sendText(scope, '还在吗', { ui: noPace });
    expect(r.reply).toBeNull();
    expect(s().bonds.find((b) => b.id === bondId)!.messages.length).toBe(before);
    // 后台生成也被拦下
    await expect(completeChat({ system: 'x', turns: [{ role: 'user', content: 'y' }], maxTokens: 10, kind: 'task' })).rejects.toBeInstanceOf(GenerationBlockedError);
    // 买了流量包就能发；一笔可以把余额用穿
    usage = { inputTokens: 3000, outputTokens: 80 };
    s().addTraffic(2);
    await sendText(scope, '买了流量', { ui: noPace });
    expect(s().traffic.balance).toBe(0);
    expect((await sendText(scope, '再来', { ui: noPace })).reply).toBeNull();
    // Max 不扣
    s().setPlan('max');
    await sendText(scope, '订了 Max', { ui: noPace });
    expect(s().traffic.balance).toBe(0);
    expect(s().bonds.find((b) => b.id === bondId)!.messages.at(-1)!.text).toBe('嗯');
  });
});

describe('选路', () => {
  it('玩家的模型档只在那家有路时生效；没有路就跟随原来的顺序（测试里落到假供应商）', () => {
    setUserProviderChoice('anthropic');
    expect(currentChatProvider().id).not.toBe('anthropic');
    setUserProviderChoice('');
  });
});

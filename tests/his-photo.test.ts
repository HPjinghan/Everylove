/**
 * TA 发图（D-130 / D-135）：她要看 / 东西送到 → 任何等级都能发；主动拍一张 → 过三道门才落；外卖送到 → TA 主动报到并拍一张。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders } from '@/core/providers';
import { sendText } from '@/core/turn';
import { deliverDueArrivals, placeOrder } from '@/lib/delivery';
import { useAppStore } from '@/store/app-store';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

vi.mock('@/lib/imagegen', () => ({
  QIANFAN_IMAGE_MODEL: 'qwen-image',
  imageKeyReady: () => true,
  generateScenePhoto: async () => 'file:///tmp/photo.jpg',
  portraitSource: () => undefined,
  portraitFor: () => undefined,
  generatePortraitFor: async () => '',
  ensurePortrait: async () => undefined,
}));

let nextReply = '嗯。';
chatProviders.register({ id: 'fake-photo', label: 'fake', localKey: () => 'k', async complete() { return nextReply; } });

beforeEach(() => {
  useAppStore.getState().resetAll();
  nextReply = '嗯。';
});

const noPace = { pace: 'none' as const };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('她要看', () => {
  it('LV1 她说「拍给我看」，TA 写 [发图] 就落一张照片（先冲洗中再回填）；不记主动冷却', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    nextReply = '喏。\n[发图 东西|桌上一杯冒着热气的姜茶]';
    await sendText(scope, '你桌上的那杯拍给我看', { ui: noPace });
    await wait(20);
    const photo = bond().messages.at(-1)!;
    expect(photo.from).toBe('him');
    expect(photo.kind).toBe('image');
    expect(photo.caption).toBe('桌上一杯冒着热气的姜茶');
    expect(photo.imageUri).toBe('file:///tmp/photo.jpg');
    expect(bond().extraFired).toBeUndefined();
  });

  it('她要看他本人：写「自拍」那段 → 主角入镜；缺省只拍东西；两种都不能有别人', async () => {
    const { buildHisPhotoPrompt, parseHisPhotoPayload } = await import('@/content/prompts');
    const { CHARACTERS } = await import('@/content/characters');
    expect(parseHisPhotoPayload('自拍|举着一串糖葫芦')).toEqual({ withHim: true, desc: '举着一串糖葫芦' });
    expect(parseHisPhotoPayload('东西|桌上的姜茶')).toEqual({ withHim: false, desc: '桌上的姜茶' });
    expect(parseHisPhotoPayload('桌上的姜茶')).toEqual({ withHim: false, desc: '桌上的姜茶' });
    const him = buildHisPhotoPrompt(CHARACTERS[0], { desc: '举着一串糖葫芦', withHim: true });
    expect(him).toContain('主角本人入镜');
    expect(him).toContain('没有第二个人');
    const thing = buildHisPhotoPrompt(CHARACTERS[0], { desc: '桌上的姜茶' });
    expect(thing).toContain('没有任何人');
    // 不带时段 / 温度这类字（「天气图标」那句是禁令，不算）
    expect(thing).not.toMatch(/°C|今天|上午|下午|晚上|深夜/);
  });

  it('没要、也没东西送到：LV1 写了 [发图] 当没写', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    nextReply = '在喝咖啡。\n[发图 一杯咖啡]';
    await sendText(scope, '在干嘛', { ui: noPace });
    await wait(20);
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.at(-1)!.kind).toBe('text');
  });
});

describe('外卖送到', () => {
  it('她给 TA 点的到了：TA 主动说一句并拍一张，计未读；一单只报到一次', async () => {
    const s = () => useAppStore.getState();
    s().creditWallet({ amount: 100, kind: 'fortune', note: '日签' });
    const bondId = s().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    s().markBondRead(bondId);
    nextReply = '收到了，你倒是会点。';
    const r = await placeOrder({ storeId: 'store', items: [{ itemId: 'ginger-tea', qty: 1 }], to: bondId });
    expect(r.ok).toBe(true);
    await wait(20);
    const order = s().orders[0];
    // 还没到：不报到
    expect(await deliverDueArrivals(order.arriveAt - 60_000)).toBe(0);
    nextReply = '到了，还烫着。\n[发图 东西|一杯姜茶，杯壁上有水汽]';
    expect(await deliverDueArrivals(order.arriveAt + 60_000)).toBe(1);
    await wait(20);
    const msgs = s().bonds.find((b) => b.id === bondId)!.messages;
    expect(msgs.at(-2)!.text).toBe('到了，还烫着。');
    expect(msgs.at(-1)!.kind).toBe('image');
    expect(s().bonds.find((b) => b.id === bondId)!.unread).toBeGreaterThan(0);
    expect(s().orders[0].reacted).toBe(true);
    expect(await deliverDueArrivals(order.arriveAt + 120_000)).toBe(0);
  });
});

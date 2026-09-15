/**
 * 零钱体系（D-128）：日签抽签区间与权重、周薪兜底 / JSON 解析、暗号解析、每天一次的守门、她的钱包不能负、TA 发红包 / 点外卖走回合管线。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders } from '@/core/providers';
import { sendText } from '@/core/turn';
import { orderStatus, orderTitle, placeOrder } from '@/lib/delivery';
import { money } from '@/lib/format';
import { drawFortune, FORTUNES, giftAllowed, giftsAfter, HIS_WALLET_START, parseGiftPayload, parseSalaryJSON, weeklySalaryFallback } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

let nextReply = '嗯。';
chatProviders.register({ id: 'fake-wallet', label: 'fake', localKey: () => 'k', async complete() { return nextReply; } });

beforeEach(() => {
  useAppStore.getState().resetAll();
  nextReply = '嗯。';
});

const noPace = { pace: 'none' as const };

describe('Coin', () => {
  it('显示整数 + Coin，不用 ¥', () => {
    expect(money(120)).toBe('120 Coin');
    expect(money(5.2)).toBe('5 Coin');
    expect(money(2000)).not.toContain('¥');
  });
});

describe('外卖模拟（D-129）', () => {
  it('状态按时间推：接单 → 取餐 → 在路上 → 送达', () => {
    const at = 1_000_000;
    const o = { at, arriveAt: at + 15 * 60_000 };
    expect(orderStatus(o, at + 60_000)).toBe('accepted');
    expect(orderStatus(o, at + 3 * 60_000)).toBe('pickup');
    expect(orderStatus(o, at + 10 * 60_000)).toBe('riding');
    expect(orderStatus(o, at + 15 * 60_000)).toBe('delivered');
    expect(orderTitle({ items: [{ name: '珍珠奶茶', qty: 2, price: 18 }, { name: '饭团', qty: 1, price: 8 }] })).toBe('珍珠奶茶 ×2、饭团');
  });

  it('给自己点：扣 Coin、进订单；零钱不够下不了；给 TA 点：会话里多一张外卖卡片、TA 回一句', async () => {
    const s = () => useAppStore.getState();
    expect((await placeOrder({ storeId: 'tea', items: [{ itemId: 'milk-tea', qty: 1 }], to: 'me' })).ok).toBe(false);
    s().creditWallet({ amount: 100, kind: 'fortune', note: '日签' });
    const r = await placeOrder({ storeId: 'tea', items: [{ itemId: 'milk-tea', qty: 2 }], note: '奖励自己', to: 'me' });
    expect(r.ok).toBe(true);
    expect(s().wallet.balance).toBe(100 - 36);
    expect(s().orders).toHaveLength(1);
    expect(s().orders[0].items[0]).toEqual({ name: '珍珠奶茶', qty: 2, price: 18 });
    expect(s().orders[0].from).toBe('me');
    expect(s().orders[0].arriveAt).toBeGreaterThan(s().orders[0].at);
    const bondId = s().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const before = s().bonds.find((b) => b.id === bondId)!.messages.length;
    nextReply = '姜茶？你倒是记得我怕冷。';
    const r2 = await placeOrder({ storeId: 'store', items: [{ itemId: 'ginger-tea', qty: 1 }], to: bondId });
    expect(r2.ok).toBe(true);
    // 卡片与回复是异步落的：等一拍
    await new Promise((res) => setTimeout(res, 50));
    const msgs = s().bonds.find((b) => b.id === bondId)!.messages;
    expect(msgs.length).toBe(before + 2);
    expect(msgs[before].card?.type).toBe('delivery');
    expect(msgs[before].card?.fromHim).toBeFalsy();
    expect(msgs[before + 1].text).toBe('姜茶？你倒是记得我怕冷。');
    expect(s().orders).toHaveLength(2);
    expect(s().orders[1].bondId).toBe(bondId);
    expect(s().wallet.balance).toBe(100 - 36 - 10);
  });
});

describe('日签', () => {
  it('五档按权重抽；金额落在各档区间；r1 = 0 大吉、r1 → 1 末吉', () => {
    expect(drawFortune(0, 0, 0)).toEqual({ luck: 'great', amount: 300, textIndex: 0 });
    expect(drawFortune(0.999, 1, 0.99).luck).toBe('last');
    expect(drawFortune(0.999, 1, 0.99).amount).toBe(80);
    for (let i = 0; i < 200; i++) {
      const r = drawFortune(Math.random(), Math.random(), Math.random());
      const { min, max } = FORTUNES[r.luck];
      expect(r.amount).toBeGreaterThanOrEqual(min);
      expect(r.amount).toBeLessThanOrEqual(max);
      expect(r.amount).toBeGreaterThanOrEqual(50);
      expect(r.amount).toBeLessThanOrEqual(500);
    }
  });
});

describe('TA 的周薪', () => {
  it('关键词兜底四档；JSON 解析夹在 100–50000', () => {
    expect(weeklySalaryFallback({ identity: '大学中文系讲师 · 32', archetype: 'gentle', name: 'x' }).weekly).toBe(3500);
    expect(weeklySalaryFallback({ identity: '建筑系研究生 · 24', archetype: 'sharp', name: 'x' }).weekly).toBe(500);
    expect(weeklySalaryFallback({ identity: '集团继承人', archetype: 'ceo', name: 'x' }).weekly).toBe(15000);
    expect(weeklySalaryFallback({ identity: '便利店店员', archetype: 'gentle', name: 'x' }).weekly).toBe(2000);
    expect(parseSalaryJSON('好的：{"weekly": 2600, "job": "书店的薪水"}')).toEqual({ weekly: 2600, job: '书店的薪水' });
    expect(parseSalaryJSON('{"weekly": 999999}')?.weekly).toBe(50000);
    expect(parseSalaryJSON('没有')).toBeNull();
  });
});

describe('TA 主动送东西', () => {
  it('暗号解析：红包 金额|留言；外卖 东西|价格|留言（价格可省）', () => {
    expect(parseGiftPayload('52|别省着', 'redpacket')).toEqual({ amount: 52, note: '别省着' });
    expect(parseGiftPayload('¥5.20', 'redpacket')).toEqual({ amount: 5.2, note: undefined });
    expect(parseGiftPayload('姜茶|20|趁热喝', 'delivery')).toEqual({ item: '姜茶', amount: 20, note: '趁热喝' });
    expect(parseGiftPayload('热粥｜别饿着', 'delivery')).toEqual({ item: '热粥', amount: undefined, note: '别饿着' });
  });

  it('每天每种最多一次', () => {
    const now = new Date(2026, 8, 15, 12).getTime();
    expect(giftAllowed(undefined, 'redpacket', now)).toBe(true);
    const g = giftsAfter(undefined, 'redpacket', now);
    expect(giftAllowed({ balance: 1, ledger: [], gifts: g }, 'redpacket', now)).toBe(false);
    expect(giftAllowed({ balance: 1, ledger: [], gifts: g }, 'delivery', now)).toBe(true);
    expect(giftAllowed({ balance: 1, ledger: [], gifts: g }, 'redpacket', now + 24 * 3600_000)).toBe(true);
  });

  it('聊天里 [发红包] → TA 钱包扣、她收到一张待点开的红包；[点外卖] → 外卖卡片、同一天第二次不再给', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    expect(bond().wallet?.balance).toBe(HIS_WALLET_START);
    nextReply = '别熬了。\n[发红包 52|去买杯热的]';
    await sendText({ mode: 'bonded', bondId }, '加班到现在', { ui: noPace });
    const packet = bond().messages.at(-1)!;
    expect(packet.from).toBe('him');
    expect(packet.card?.type).toBe('redpacket');
    expect(packet.card?.fromHim).toBe(true);
    expect(packet.card?.amount).toBe(52);
    expect(packet.card?.claimed).toBeFalsy();
    expect(bond().wallet?.balance).toBe(HIS_WALLET_START - 52);
    // 她还没点开：零钱不变
    expect(useAppStore.getState().wallet.balance).toBe(0);
    // 同一天第二个红包不给（守门）
    nextReply = '再给你一个。\n[发红包 520|拿着]';
    await sendText({ mode: 'bonded', bondId }, '还有吗', { ui: noPace });
    expect(bond().wallet?.balance).toBe(HIS_WALLET_START - 52);
    expect(bond().messages.at(-1)!.text).toBe('再给你一个。');
    // 外卖
    nextReply = '先吃点东西。\n[点外卖 姜茶|20|趁热]';
    await sendText({ mode: 'bonded', bondId }, '有点冷', { ui: noPace });
    const food = bond().messages.at(-1)!;
    expect(food.card?.type).toBe('delivery');
    expect(food.card?.title).toBe('姜茶');
    expect(food.card?.arriveAt).toBeGreaterThan(Date.now());
    expect(bond().wallet?.balance).toBe(HIS_WALLET_START - 52 - 20);
    expect(bond().wallet?.ledger.map((e) => e.kind)).toEqual(['redpacket', 'delivery']);
  });

  it('她的红包：零钱不够发不出；TA 没拆退回；余额不能负', async () => {
    const { sendRedPacket } = await import('@/features/red-packet');
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const before = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length;
    await sendRedPacket(bondId, 52, '给你', noPace);
    // 零钱 0：没发出去
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length).toBe(before);
    useAppStore.getState().creditWallet({ amount: 100, kind: 'fortune', note: '日签' });
    nextReply = '不要。';
    await sendRedPacket(bondId, 52, '给你', noPace);
    const w = useAppStore.getState().wallet;
    expect(w.balance).toBe(100); // 扣了又退回
    expect(w.ledger.map((e) => e.kind)).toEqual(['fortune', 'redpacket', 'refund']);
    expect(useAppStore.getState().creditWallet({ amount: -500, kind: 'redpacket', note: 'x' })).toBe(-100);
    expect(useAppStore.getState().wallet.balance).toBe(0);
  });
});

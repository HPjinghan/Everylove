/**
 * 回合管线（D-086）：用一个假供应商 + 真 store 走一遍「她说一句、TA 回一句」，
 * 验证：模式记账（心动 / XP）、暗号落状态、钩子（心动满的 offer）、失败露出原因。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders, type ChatRequest } from '@/core/providers';
import { sendText } from '@/core/turn';
import { HEART_FALLBACK, HEART_FULL, heartPaceOf } from '@/lib/bond';
import { findCharacter, useAppStore } from '@/store/app-store';

// vitest 会把 vi.mock 提升到文件顶部，写在 import 之后只是为了过 import/first
vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

let lastReq: ChatRequest | null = null;
let nextReply = '嗯，我在。';
let fail = false;

chatProviders.register({
  id: 'fake',
  label: 'fake',
  localKey: () => 'test-key',
  async complete(req) {
    lastReq = req;
    if (fail) throw new Error('boom 503');
    return nextReply;
  },
});

beforeEach(() => {
  useAppStore.getState().resetAll();
  lastReq = null;
  fail = false;
  nextReply = '嗯，我在。';
});

const noPace = { pace: 'none' as const };

describe('亲密会话', () => {
  it('她的话落会话 +XP；TA 的话按空行拆两条；暗号剥掉并解锁手机', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const before = useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    nextReply = '密码是 4821，别乱翻。\n\n看完记得给我说一声。\n[解锁手机]';

    const r = await sendText({ mode: 'bonded', bondId }, '你的手机密码多少呀', { ui: noPace });

    const bond = useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    expect(r.reply?.flags).toEqual({ unlockPhone: true });
    expect(bond.affinity).toBe(before.affinity + 5);
    expect(bond.phoneUnlocked).toBe(true);
    const tail = bond.messages.slice(-4).map((m) => [m.from, m.text]);
    expect(tail).toEqual([
      ['me', '你的手机密码多少呀'],
      ['him', '密码是 4821，别乱翻'],
      ['him', '看完记得给我说一声'],
      ['system', 'TA 同意让你看手机了'],
    ]);
    // 模型看到的：系统 prompt 带手机密码；最后一轮是她这句
    expect(lastReq?.system).toContain(`Your phone passcode is ${bond.phoneCode}`);
    expect(lastReq?.turns.at(-1)).toEqual({ role: 'user', content: '你的手机密码多少呀' });
    expect(lastReq?.kind).toBe('reply');
  });

  it('模型失败：原因走轻提示，不写进会话（D-110）', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    fail = true;
    const before = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.length;
    const r = await sendText({ mode: 'bonded', bondId }, '在吗', { ui: noPace });
    expect(r.reply).toBeNull();
    expect(String(r.error)).toContain('boom 503');
    const msgs = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages;
    // 只多了她那一句；没有系统条
    expect(msgs.length).toBe(before + 1);
    expect(msgs.at(-1)!.from).toBe('me');
  });

  it('暗面路由绕过模型：不调供应商，回温柔模式', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const r = await sendText({ mode: 'bonded', bondId }, '我不想活了', { ui: noPace });
    expect(lastReq).toBeNull();
    expect(r.reply?.darkSide).toBe(true);
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.at(-1)!.text).toContain('12356');
  });
});

describe('初识试聊', () => {
  it('心动值由模型判（[心动 n] 暗号，D-126）；满 100 后 TA 开口要联系方式（产品触发器，不由模型决定）', async () => {
    const id = 'shen-zhiyan';
    useAppStore.getState().ensureSquareChat(id);
    const scope = { mode: 'square' as const, characterId: id };
    nextReply = '嗯，我在。\n\n[心动 12]';
    let turns = 0;
    while ((useAppStore.getState().squareChats[id]?.heart ?? 0) < HEART_FULL && turns < 20) {
      await sendText(scope, `第 ${turns} 句`, { ui: noPace });
      turns++;
    }
    const chat = useAppStore.getState().squareChats[id]!;
    expect(turns).toBe(9); // 12 × 9 = 108 ≥ 100
    expect(chat.heart).toBe(HEART_FULL);
    expect(chat.lastHeartGain).toBe(12);
    expect(chat.adoptionOffered).toBe(true);
    expect(chat.userTurns).toBe(turns);
    // 暗号剥掉、不上屏；offer 台词在 TA 的回复之后
    const texts = chat.messages.map((m) => m.text);
    expect(texts.some((t) => t.includes('心动'))).toBe(false);
    expect(texts.indexOf('嗯，我在。')).toBeLessThan(texts.length - 1);
    expect(lastReq?.system).toContain('[Right now] You two just matched on a dating app');
    expect(lastReq?.system).toContain('[How much this line moved you]');
    expect(lastReq?.system).not.toContain('[What you remember]');
  });

  it('判 0 就是 0；超过 15 夹到 15；没写暗号按性子保底；暗面回合不涨', async () => {
    const id = 'shen-zhiyan';
    useAppStore.getState().ensureSquareChat(id);
    const scope = { mode: 'square' as const, characterId: id };
    const heart = () => useAppStore.getState().squareChats[id]!.heart ?? 0;
    nextReply = '哦。\n[心动 0]';
    await sendText(scope, '今天天气', { ui: noPace });
    expect(heart()).toBe(0);
    expect(useAppStore.getState().squareChats[id]!.lastHeartGain).toBe(0);
    nextReply = '……\n[心动 99]';
    await sendText(scope, '我记得你说过喜欢雨天', { ui: noPace });
    expect(heart()).toBe(15);
    nextReply = '嗯。';
    await sendText(scope, '随便聊聊', { ui: noPace });
    expect(heart()).toBe(15 + HEART_FALLBACK[heartPaceOf(findCharacter(id)!)]);
    const before = heart();
    await sendText(scope, '我不想活了', { ui: noPace });
    expect(heart()).toBe(before);
  });
});

describe('羁绊记账（D-126）', () => {
  it('文字 +5、当天第 21 句起 +2；回 TA 主动那条 +10；温度回温', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const scope = { mode: 'bonded' as const, bondId };
    for (let i = 0; i < 20; i++) await sendText(scope, `第 ${i} 句`, { ui: noPace });
    expect(bond().affinity).toBe(100);
    expect(bond().xpToday?.counts.text).toBe(20);
    await sendText(scope, '第 21 句', { ui: noPace });
    expect(bond().affinity).toBe(102);
    // 温度：起点 60，每句 +3
    expect(bond().warmth).toBe(Math.min(100, 60 + 21 * 3));
    // TA 主动发过一条，她 24h 内回 → 多 +10（只算一次）
    useAppStore.getState().markReachDelivered(bondId, Date.now());
    await sendText(scope, '在的', { ui: noPace });
    expect(bond().affinity).toBe(102 + 2 + 10);
    await sendText(scope, '嗯嗯', { ui: noPace });
    expect(bond().affinity).toBe(102 + 2 + 10 + 2);
  });
});

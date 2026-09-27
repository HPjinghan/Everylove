/**
 * 回合管线（D-086）：用一个假供应商 + 真 store 走一遍「她说一句、TA 回一句」，
 * 验证：模式记账（心动 / XP）、暗号落状态、钩子（心动满的 offer）、失败标在她那条上可重发、同一段会话串行（D-169）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders, type ChatRequest } from '@/core/providers';
import { landReply, resendTurn, sendText, turnHooks } from '@/core/turn';
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
/** 假供应商的延时与按请求回话（串行用例用） */
let delayMs = 0;
let onReply: ((req: ChatRequest) => string) | null = null;

chatProviders.register({
  id: 'fake',
  label: 'fake',
  localKey: () => 'test-key',
  async complete(req) {
    lastReq = req;
    if (fail) throw new Error('boom 503');
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return onReply ? onReply(req) : nextReply;
  },
});

beforeEach(() => {
  useAppStore.getState().resetAll();
  lastReq = null;
  fail = false;
  nextReply = '嗯，我在。';
  delayMs = 0;
  onReply = null;
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

  it('模型失败：不写进会话，她那条标「没送到」；重发不再记账、回上后清掉（D-110 / D-169）', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    fail = true;
    const before = bond().messages.length;
    const xp = bond().affinity;
    const r = await sendText({ mode: 'bonded', bondId }, '在吗', { ui: noPace });
    expect(r.reply).toBeNull();
    expect(String(r.error)).toContain('boom 503');
    // 只多了她那一句；没有系统条；失败原因记在她那条上
    expect(bond().messages.length).toBe(before + 1);
    const hers = bond().messages.at(-1)!;
    expect(hers.from).toBe('me');
    expect(hers.failed).toContain('boom 503');
    expect(bond().affinity).toBe(xp + 5);
    // 重发：TA 回上，failed 清掉，XP 不再加，模型看到的最后一轮仍是她这句、不重复
    fail = false;
    nextReply = '在的';
    const r2 = await resendTurn({ mode: 'bonded', bondId }, hers.id, noPace);
    expect(r2.reply?.texts).toEqual(['在的']);
    expect(bond().messages.find((m) => m.id === hers.id)!.failed).toBeUndefined();
    expect(bond().messages.at(-1)!.text).toBe('在的');
    expect(bond().affinity).toBe(xp + 5);
    const users = lastReq!.turns.filter((x) => x.role === 'user');
    expect(users.at(-1)!.content).toBe('在吗');
    expect(users.filter((x) => x.content.includes('在吗')).length).toBe(1);
  });

  it('同一段会话串行（D-169）：TA 在回的时候她连发两条 → 等这轮落完合成一轮一起回，历史不重复', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    // 只数 TA 回话的请求（记忆提取这类后台任务也走假供应商，不算）
    const reqs: ChatRequest[] = [];
    delayMs = 20;
    onReply = (req) => {
      if (req.kind !== 'reply') return '{}';
      reqs.push(req);
      return `回 ${reqs.length}`;
    };
    const p1 = sendText(scope, '第一句', { ui: noPace });
    const p2 = sendText(scope, '第二句', { ui: noPace });
    const p3 = sendText(scope, '第三句', { ui: noPace });
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1.reply?.texts).toEqual(['回 1']);
    expect(r2.reply?.texts).toEqual(['回 2']);
    expect(r3.reply?.texts).toEqual(['回 2']);
    // 只调了两次模型：第一轮她的第一句；第二轮她后两句合成一条
    expect(reqs.length).toBe(2);
    expect(reqs[1].turns.at(-1)).toEqual({ role: 'user', content: '第二句\n第三句' });
    expect(reqs[1].turns.filter((x) => x.role === 'user' && x.content.includes('第二句')).length).toBe(1);
    // 屏上顺序：她三句都先在，TA 的两条在后
    const tail = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.slice(-5).map((m) => m.text);
    expect(tail).toEqual(['第一句', '第二句', '第三句', '回 1', '回 2']);
  });

  it('暗面路由绕过模型：不调供应商，回温柔模式', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const r = await sendText({ mode: 'bonded', bondId }, '我不想活了', { ui: noPace });
    expect(lastReq).toBeNull();
    expect(r.reply?.darkSide).toBe(true);
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.at(-1)!.text).toContain('12356');
  });
});

describe('X 回帖走管线（D-178）', () => {
  it('她的评论落评论线 + 记 comment XP → TA 回一句落评论线；模型看到整条线', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const postId = useAppStore.getState().posts.find((p) => p.bondId === bondId)?.id;
    expect(postId).toBeTruthy();
    const xp = bond().affinity;
    nextReply = '在阳台。';
    const r = await sendText({ mode: 'post', bondId, postId }, '在哪看的？', { ui: noPace });
    expect(r.reply?.texts).toEqual(['在阳台']);
    const post = useAppStore.getState().posts.find((p) => p.id === postId)!;
    expect(post.comments.slice(-2).map((c) => [c.from, c.text])).toEqual([
      ['me', '在哪看的？'],
      ['him', '在阳台'],
    ]);
    expect(bond().affinity).toBe(xp + 3);
    expect(lastReq?.system).toContain('left a comment under it');
    expect(lastReq?.turns.at(-1)?.content).toContain('her: 在哪看的？');
    expect(lastReq?.turns.at(-1)?.content).toContain('Reply to her latest comment.');
  });
});

describe('后台落消息走同一条管线（D-177）', () => {
  it('landReply：bubble 钩子照跑、extra 标记落在消息上、计未读；TA 正在回她时排在那轮之后', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const scope = { mode: 'bonded' as const, bondId };
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const off = turnHooks.bubble.on(async (m) => ({ ...m, text: `${m.text}!` }));
    try {
      const unreadBefore = bond().unread ?? 0;
      await landReply(scope, { texts: ['早'] }, { at: 123, unread: true, extra: { reach: true } });
      const last = bond().messages.at(-1)!;
      expect(last.text).toBe('早!');
      expect(last.reach).toBe(true);
      expect(last.at).toBe(123);
      expect(bond().unread ?? 0).toBe(unreadBefore + 1);
      // 她正在等 TA 回：后台落的排在 TA 那轮之后
      delayMs = 20;
      nextReply = '在的';
      const p = sendText(scope, '在吗', { ui: noPace });
      await landReply(scope, { texts: ['顺便说一句'] }, { at: 456 });
      await p;
      expect(bond().messages.slice(-3).map((m) => m.text)).toEqual(['在吗', '在的!', '顺便说一句!']);
    } finally {
      off();
    }
  });
});

describe('初识试聊', () => {
  it('好奇值由模型判（[好奇 n] 暗号，D-126 / D-157）；满 100 后 TA 开口要联系方式（产品触发器，不由模型决定）', async () => {
    const id = 'shen-zhiyan';
    useAppStore.getState().ensureSquareChat(id);
    const scope = { mode: 'square' as const, characterId: id };
    nextReply = '嗯，我在。\n\n[好奇 22]';
    let turns = 0;
    while ((useAppStore.getState().squareChats[id]?.heart ?? 0) < HEART_FULL && turns < 20) {
      await sendText(scope, `第 ${turns} 句`, { ui: noPace });
      turns++;
    }
    const chat = useAppStore.getState().squareChats[id]!;
    expect(turns).toBe(5); // 22 × 5 = 110 ≥ 100（D-157：4–8 句）
    expect(chat.heart).toBe(HEART_FULL);
    expect(chat.lastHeartGain).toBe(22);
    expect(chat.adoptionOffered).toBe(true);
    expect(chat.userTurns).toBe(turns);
    // 暗号剥掉、不上屏；offer 台词在 TA 的回复之后
    const texts = chat.messages.map((m) => m.text);
    expect(texts.some((t) => t.includes('好奇'))).toBe(false);
    expect(texts.indexOf('嗯，我在。')).toBeLessThan(texts.length - 1);
    expect(lastReq?.system).toContain('[Right now] You two just matched on a dating app');
    expect(lastReq?.system).toContain('[How curious this line made you]');
    expect(lastReq?.system).not.toContain('[What you remember]');
  });

  it('低于 15 夹到 15；超过 30 夹到 30；没写暗号按性子保底；暗面回合不涨', async () => {
    const id = 'shen-zhiyan';
    useAppStore.getState().ensureSquareChat(id);
    const scope = { mode: 'square' as const, characterId: id };
    const heart = () => useAppStore.getState().squareChats[id]!.heart ?? 0;
    nextReply = '哦。\n[好奇 0]';
    await sendText(scope, '今天天气', { ui: noPace });
    expect(heart()).toBe(15);
    expect(useAppStore.getState().squareChats[id]!.lastHeartGain).toBe(15);
    nextReply = '……\n[好奇 99]';
    await sendText(scope, '我记得你说过喜欢雨天', { ui: noPace });
    expect(heart()).toBe(45);
    nextReply = '嗯。';
    await sendText(scope, '随便聊聊', { ui: noPace });
    expect(heart()).toBe(45 + HEART_FALLBACK[heartPaceOf(findCharacter(id)!)]);
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

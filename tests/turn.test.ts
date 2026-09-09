/**
 * 回合管线（D-086）：用一个假供应商 + 真 store 走一遍「她说一句、TA 回一句」，
 * 验证：模式记账（心动 / XP）、暗号落状态、钩子（心动满的 offer）、失败露出原因。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/features';

import { chatProviders, type ChatRequest } from '@/core/providers';
import { sendText } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { useAppStore } from '@/store/app-store';

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
      ['him', '密码是 4821，别乱翻。'],
      ['him', '看完记得给我说一声。'],
      ['system', 'TA 同意让你看手机了'],
    ]);
    // 模型看到的：系统 prompt 带手机密码；最后一轮是她这句
    expect(lastReq?.system).toContain(`你的手机密码是 ${bond.phoneCode}`);
    expect(lastReq?.turns.at(-1)).toEqual({ role: 'user', content: '你的手机密码多少呀' });
    expect(lastReq?.kind).toBe('reply');
  });

  it('模型失败：原因作为系统消息落在会话里，不吞', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    fail = true;
    const r = await sendText({ mode: 'bonded', bondId }, '在吗', { ui: noPace });
    expect(r.reply).toBeNull();
    const last = useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.at(-1)!;
    expect(last.from).toBe('system');
    expect(last.text).toContain('boom 503');
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
  it('心动值随她每句上涨；满 100 后 TA 开口要联系方式（产品触发器，不由模型决定）', async () => {
    const id = 'shen-zhiyan';
    useAppStore.getState().ensureSquareChat(id);
    const scope = { mode: 'square' as const, characterId: id };
    let turns = 0;
    while ((useAppStore.getState().squareChats[id]?.heart ?? 0) < HEART_FULL && turns < 20) {
      await sendText(scope, `第 ${turns} 句`, { ui: noPace });
      turns++;
    }
    const chat = useAppStore.getState().squareChats[id]!;
    expect(chat.heart).toBe(HEART_FULL);
    expect(chat.adoptionOffered).toBe(true);
    expect(chat.userTurns).toBe(turns);
    // offer 台词在 TA 的回复之后
    const texts = chat.messages.map((m) => m.text);
    expect(texts.indexOf('嗯，我在。')).toBeLessThan(texts.length - 1);
    expect(lastReq?.system).toContain('【此刻的情境】你们刚在交友软件上配对成功');
    expect(lastReq?.system).not.toContain('【你记得的事】');
  });
});

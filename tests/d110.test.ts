/**
 * D-110 一组：世界书注入 / 身边的人注入 / 广场偶遇记忆 / X 互动解析 / 日历任何年份 / 外出开场白不重复。
 * 模型看到的字有变动时，这里和 prompts 快照一起红。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '@/features';

import { dateKey, holidayFor } from '@/content/calendar';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import {
  buildChatSystemPrompt,
  buildPostReactionsSystem,
  circleBlock,
  encountersBlock,
  parseCircleJSON,
  hisScheduleBlock,
  parseHisScheduleJSON,
  parseReactionsJSON,
  pickOutingOpener,
  worldBlock,
} from '@/content/prompts';
import { dedupeBonds } from '@/lib/bond';
import { outsideQuiet } from '@/lib/reach-out';
import { setLang } from '@/lib/i18n';
import { canPublishCharacter, selectableFrom, worldOf, worldSnapshot } from '@/lib/worlds';
import { findCharacter, useAppStore } from '@/store/app-store';

import { bondedCtx, custom, NOW, squareCtx } from './fixtures';

beforeEach(() => {
  setLang('zh');
  useAppStore.getState().resetAll();
});

describe('世界书', () => {
  it('现实世界不出段；别的世界带名字、一句话、设定与认知规则', () => {
    expect(worldBlock(custom)).toEqual([]);
    useAppStore.getState().addWorldBook({
      id: 'w1',
      name: '云海之上',
      summary: '漂浮在云海上的城邦。',
      rules: '没有手机，靠传信鸟联络\n人人都有一只灵兽',
      createdAt: 1,
      updatedAt: 1,
    });
    const lines = worldBlock({ worldId: 'w1' });
    expect(lines[0]).toBe('【你所在的世界】云海之上：漂浮在云海上的城邦。');
    expect(lines).toContain('- 没有手机，靠传信鸟联络');
    expect(lines.join('\n')).toContain('只知道这个世界里有的东西');
    // 找不到的世界 = 现实世界
    expect(worldBlock({ worldId: 'gone' })).toEqual([]);
  });
  it('系统 prompt 里紧跟角色设定', () => {
    useAppStore.getState().addWorldBook({ id: 'w1', name: '云海之上', summary: '云上城邦。', createdAt: 1, updatedAt: 1 });
    const text = buildChatSystemPrompt({ ...squareCtx, character: { ...squareCtx.character, worldId: 'w1' } }, NOW);
    expect(text).toContain('【你所在的世界】云海之上：云上城邦。');
    expect(text.indexOf('【你所在的世界】')).toBeGreaterThan(text.indexOf('【你是谁】'));
  });
});

describe('世界书共享（D-111）', () => {
  const w = (id: string, visibility?: 'private' | 'public') => ({ id, name: id, summary: '', createdAt: 1, updatedAt: 1, visibility });
  it('绑定了别人看不见的世界的角色不能公开；公开 / 共享 / 现实世界可以', () => {
    useAppStore.getState().addWorldBook(w('mine-private'));
    useAppStore.getState().addWorldBook(w('mine-public', 'public'));
    useAppStore.getState().setSharedWorlds([{ ...w('theirs', 'public'), shared: true }]);
    expect(canPublishCharacter({})).toBe(true);
    expect(canPublishCharacter({ worldId: 'mine-private' })).toBe(false);
    expect(canPublishCharacter({ worldId: 'mine-public' })).toBe(true);
    expect(canPublishCharacter({ worldId: 'theirs' })).toBe(true);
  });
  it('绑定即快照（D-112）：角色带着当时的设定与版本，世界之后更新 / 删除都不影响；没快照的旧存档按 id 找，找不到回落现实世界', () => {
    useAppStore.getState().addWorldBook({ ...w('w1', 'public'), summary: '第一版' });
    const snap = worldSnapshot('w1')!;
    expect(snap.version).toBe(1);
    useAppStore.getState().updateWorldBook({ ...useAppStore.getState().worldBooks[0], summary: '第二版' });
    expect(useAppStore.getState().worldBooks[0].version).toBe(2);
    expect(worldOf({ worldId: 'w1', world: snap }).summary).toBe('第一版');
    expect(worldOf({ worldId: 'w1' }).summary).toBe('第二版');
    useAppStore.getState().removeWorldBook('w1');
    expect(worldOf({ worldId: 'w1', world: snap }).summary).toBe('第一版');
    expect(worldOf({ worldId: 'w1' }).id).toBe('real');
    // 世界删了 = 别人看不见 → 不能再新公开
    expect(canPublishCharacter({ worldId: 'w1', world: snap })).toBe(false);
    const shared = [{ ...w('theirs', 'public'), shared: true }];
    expect(selectableFrom([], shared, ['theirs']).map((x) => x.id)).toEqual(['real', 'theirs']);
  });
});

describe('身边的人', () => {
  it('解析模型 JSON：名单 + 聊天；坏结构返回 null', () => {
    const parsed = parseCircleJSON(
      '好的：{"people":[{"name":"阿哲","relation":"发小","note":"损友"},{"name":"妈","relation":"妈妈"}],"chats":[{"name":"阿哲","lines":[{"from":"them","text":"晚上打球？"},{"from":"me","text":"不去"}]}]}'
    );
    expect(parsed?.people.map((p) => p.name)).toEqual(['阿哲', '妈']);
    expect(parsed?.chats[0].lines).toHaveLength(2);
    expect(parseCircleJSON('没有 json')).toBeNull();
  });
  it('【你身边的人】进亲密 prompt，没有圈子不出段', () => {
    expect(circleBlock(undefined)).toEqual([]);
    const circle = [{ id: 'p1', name: '阿哲', relation: '发小', note: '损友' }];
    const text = buildChatSystemPrompt({ ...bondedCtx, bond: { ...bondedCtx.bond!, circle } }, NOW);
    expect(text).toContain('【你身边的人】');
    expect(text).toContain('- 阿哲（发小）：损友');
  });
});

describe('广场偶遇的记忆', () => {
  it('初识 prompt 带上次在广场聊过的话', () => {
    const encounters = [{ at: 1, placeName: '广场', summary: '她：排队的人好多\n沈之言：应该很好吃吧' }];
    expect(encountersBlock({ ...squareCtx, encounters: [] })).toEqual([]);
    const text = buildChatSystemPrompt({ ...squareCtx, encounters }, NOW);
    expect(text).toContain('【你们见过】');
    expect(text).toContain('- 在广场：她：排队的人好多');
  });
  it('store：偶遇记录最多留 5 条', () => {
    for (let i = 0; i < 7; i++) useAppStore.getState().addEncounter('shen-zhiyan', { at: i, placeName: '广场', summary: `第 ${i} 次` });
    expect(useAppStore.getState().squareChats['shen-zhiyan'].encounters).toHaveLength(5);
  });
});

describe('X 里别人的互动', () => {
  it('反应 prompt 列出名单；解析评论与 TA 的回复', () => {
    const sys = buildPostReactionsSystem(custom, [{ name: '阿哲', who: '林知夏的发小' }]);
    expect(sys).toContain('- 阿哲：林知夏的发小');
    const parsed = parseReactionsJSON('{"comments":[{"by":"阿哲","text":"又熬夜"}],"reply":"少管"}');
    expect(parsed).toEqual({ comments: [{ by: '阿哲', text: '又熬夜' }], reply: '少管' });
    expect(parseReactionsJSON('{"comments":[],"reply":""}')).toEqual({ comments: [], reply: undefined });
  });
  it('store：别人的评论落到帖子上并标记已互动', () => {
    useAppStore.getState().ensureSeedPosts();
    const post = useAppStore.getState().posts[0];
    useAppStore.getState().addPostComments(post.id, [{ id: 'c1', from: 'other', name: '阿哲', text: '哈哈', at: 1 }]);
    const after = useAppStore.getState().posts.find((p) => p.id === post.id)!;
    expect(after.reacted).toBe(true);
    expect(after.comments[0].name).toBe('阿哲');
  });
});

describe('日历任何年份都有内容', () => {
  it('公历固定日子按规则、农历节日按年查表', () => {
    expect(holidayFor('2027-01-01')).toBe('元旦');
    expect(holidayFor('2030-12-25')).toBe('圣诞节');
    expect(holidayFor('2027-02-06')).toBe('春节');
    expect(holidayFor('2028-10-03')).toBe('中秋');
    expect(holidayFor('2026-08-19')).toBe('七夕');
    expect(holidayFor('2040-03-15')).toBeUndefined();
  });
});

describe('缔结即快照（D-116）', () => {
  it('缔结后角色库里的修改不动这段关系；没缔结的照常取现行', () => {
    useAppStore.getState().addCustomCharacter({ ...custom, id: 'c-snap' });
    const bondId = useAppStore.getState().createBond({ characterId: 'c-snap', name: '林知夏', nickname: '小满' });
    expect(useAppStore.getState().bonds.find((b) => b.id === bondId)!.character?.identity).toBe(custom.identity);
    useAppStore.getState().updateCustomCharacter({ ...custom, id: 'c-snap', identity: '改过的身份' });
    expect(findCharacter('c-snap')!.identity).toBe(custom.identity);
    expect(useAppStore.getState().customCharacters.find((c) => c.id === 'c-snap')!.identity).toBe('改过的身份');
  });
});

describe('一个角色只有一段羁绊（D-122）', () => {
  it('重复缔结返回已有的那段', () => {
    useAppStore.getState().addCustomCharacter({ ...custom, id: 'c-once' });
    const a = useAppStore.getState().createBond({ characterId: 'c-once', name: '澜' });
    const b = useAppStore.getState().createBond({ characterId: 'c-once', name: '澜' });
    expect(b).toBe(a);
    expect(useAppStore.getState().bonds.filter((x) => x.characterId === 'c-once')).toHaveLength(1);
  });
  it('dedupeBonds 留消息最多的那段，并列取最早的', () => {
    const mk = (id: string, createdAt: number, n: number) => ({ id, characterId: 'c', createdAt, messages: new Array(n).fill(0) });
    const { kept, droppedIds } = dedupeBonds([mk('b1', 1, 2), mk('b2', 2, 5), mk('b3', 3, 5), { ...mk('b4', 4, 0), characterId: 'd' }]);
    expect(kept.map((b) => b.id)).toEqual(['b2', 'b4']);
    expect(droppedIds).toEqual(['b1', 'b3']);
  });
});

describe('创造去重（D-121）', () => {
  it('同一个 id 只进角色库一次', () => {
    const before = useAppStore.getState().customCharacters.length;
    useAppStore.getState().addCustomCharacter({ ...custom, id: 'c-dup' });
    useAppStore.getState().addCustomCharacter({ ...custom, id: 'c-dup' });
    expect(useAppStore.getState().customCharacters.length).toBe(before + 1);
  });
});

describe('她的日历是私密的（D-113）', () => {
  it('没看过她手机的 TA 不会来关心日程；看过之后心跳照投（AI 不可用回落模板）', async () => {
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    useAppStore.getState().addUserEvent({ id: 'ev1', date: dateKey(tomorrow), title: '面试' });
    const before = new Date(tomorrow);
    before.setHours(19, 0, 0, 0); // 事前关心窗口内
    const eve = before.getTime() - 86400_000;
    const count = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!.messages.filter((m) => m.text.includes('面试')).length;
    expect(await deliverDueHeartbeats(eve)).toBe(0);
    expect(count()).toBe(0);
    useAppStore.getState().markEventsKnown(['ev1'], bondId);
    expect(await deliverDueHeartbeats(eve)).toBe(1);
    expect(count()).toBe(1);
    // 同一段不重复
    expect(await deliverDueHeartbeats(eve)).toBe(0);
  });
});

describe('TA 自己的作息（D-119）', () => {
  it('解析 JSON、注入【你的日程】按今天 / 明天标注', () => {
    const parsed = parseHisScheduleJSON('{"events":[{"date":"2026-09-11","time":"9:00","title":"早会"},{"date":"bad","title":"x"}]}');
    expect(parsed).toEqual([{ date: '2026-09-11', time: '09:00', title: '早会' }]);
    const block = hisScheduleBlock([{ id: 'a', date: '2026-09-11', time: '09:00', title: '早会' }, { id: 'b', date: '2026-09-09', title: '过去的' }], '2026-09-10');
    expect(block[1]).toBe('- 明天 09:00：早会');
    expect(block).toHaveLength(2);
  });
});

describe('勿扰时段读设置（D-120）', () => {
  it('改成 1–6 点后，凌晨 3 点顺延到 6 点，23 点照发', () => {
    useAppStore.getState().setQuietHours({ from: 1, to: 6 });
    const three = new Date(2026, 8, 10, 3, 0).getTime();
    expect(new Date(outsideQuiet(three, 0)).getHours()).toBe(6);
    const late = new Date(2026, 8, 10, 23, 0).getTime();
    expect(outsideQuiet(late, 0)).toBe(late);
  });
});

describe('外出开场白模板', () => {
  it('同一情形连抽不重复上一条', () => {
    const a = pickOutingOpener('stranger');
    const b = pickOutingOpener('stranger');
    expect(a).not.toBe(b);
  });
});

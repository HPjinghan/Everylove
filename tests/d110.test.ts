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
  parseCircleChatsJSON,
  buildCircleRefreshUser,
  buildCircleSystem,
  hisScheduleBlock,
  isNonhumanCharacter,
  parseHisScheduleJSON,
  parseReactionsJSON,
  pickOutingOpener,
} from '@/content/prompts';
import { dedupeBonds } from '@/lib/bond';
import { circleLastAt, circleRefreshIntervalMs, fallbackCircle, mergeCircleChats } from '@/lib/circle';
import { outsideQuiet } from '@/lib/reach-out';
import { setLang } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

import { bondedCtx, custom, NOW, squareCtx } from './fixtures';

beforeEach(() => {
  setLang('zh');
  useAppStore.getState().resetAll();
});

describe('身边的人', () => {
  it('非人类的名单不硬安「妈妈」（D-161）：prompt 分人类 / 非人类两句；通用回落也有非人类版', () => {
    const human = buildCircleSystem({ ...custom, archetype: 'gentle', race: undefined }, undefined);
    expect(human).toContain('至少一个家人');
    expect(human).not.toContain('不要硬安一个「妈妈」');
    const dragon = buildCircleSystem({ ...custom, archetype: 'nonhuman', race: '龙族' }, undefined);
    expect(dragon).toContain('不要硬安一个「妈妈」');
    expect(dragon).not.toContain('至少一个家人');
    expect(isNonhumanCharacter({ archetype: 'gentle', race: '人类' })).toBe(false);
    expect(isNonhumanCharacter({ archetype: 'gentle', race: '机器人' })).toBe(true);
    for (const lang of ['zh', 'en', 'ja', 'ko'] as const) {
      const fb = fallbackCircle(lang, true);
      expect(fb.circle).toHaveLength(4);
      expect(fb.circle.some((p) => /妈|mother|母|엄마/i.test(p.relation))).toBe(false);
      expect(Object.keys(fb.chats)).toHaveLength(3);
      expect(fallbackCircle(lang).circle.some((p) => /妈|mother|母|엄마/i.test(p.relation))).toBe(true);
    }
  });
  it('补投的帖子 / 记事本按到点那一刻落时间（D-162）', () => {
    const s = useAppStore.getState();
    const at = NOW.getTime() - 5 * 3600_000;
    s.addCharacterPost('shen-zhiyan', 'b1', '补投的一条', at);
    expect(useAppStore.getState().posts.at(-1)?.at).toBe(at);
    s.addCharacterPost('shen-zhiyan', 'b1', '现在的一条');
    expect(useAppStore.getState().posts.at(-1)!.at).toBeGreaterThan(at);
  });
  it('解析模型 JSON：名单 + 聊天；坏结构返回 null', () => {
    const parsed = parseCircleJSON(
      '好的：{"people":[{"name":"阿哲","relation":"发小","note":"损友"},{"name":"妈","relation":"妈妈"}],"chats":[{"name":"阿哲","lines":[{"from":"them","text":"晚上打球？"},{"from":"me","text":"不去"}]}]}'
    );
    expect(parsed?.people.map((p) => p.name)).toEqual(['阿哲', '妈']);
    expect(parsed?.chats[0].lines).toHaveLength(2);
    expect(parseCircleJSON('没有 json')).toBeNull();
  });
  it('续写（D-124）：只认名单里的人、时间落在区间内且晚于已有、每人最多 40 句', () => {
    const circle = [
      { id: 'p1', name: '阿哲', relation: '发小' },
      { id: 'p2', name: '妈', relation: '妈妈' },
    ];
    const since = NOW.getTime() - 12 * 3600_000;
    const now = NOW.getTime();
    const existing = { p1: Array.from({ length: 39 }, (_, i) => ({ from: 'them' as const, text: `老${i}`, at: since - 3600_000 + i * 1000 })) };
    const merged = mergeCircleChats(
      circle,
      existing,
      [
        { name: '阿哲', lines: [{ from: 'them', text: '周末打球？' }, { from: 'me', text: '行' }] },
        { name: '路人', lines: [{ from: 'them', text: '不在名单里' }] },
        { name: '妈', lines: [{ from: 'them', text: '吃了没' }] },
      ],
      { since, now }
    )!;
    expect(Object.keys(merged).sort()).toEqual(['p1', 'p2']);
    expect(merged.p1).toHaveLength(40);
    expect(merged.p1.at(-1)!.text).toBe('行');
    expect(merged.p1.at(-2)!.at).toBeGreaterThan(existing.p1.at(-1)!.at);
    for (const l of [...merged.p1.slice(-2), ...merged.p2]) {
      expect(l.at).toBeGreaterThan(since);
      expect(l.at).toBeLessThanOrEqual(now);
    }
    expect(circleLastAt(merged)).toBeLessThanOrEqual(now);
    expect(mergeCircleChats(circle, {}, [{ name: '路人', lines: [{ from: 'me', text: 'x' }] }], { since, now })).toBeNull();
    expect(parseCircleChatsJSON('{"chats":[{"name":"妈","lines":[{"from":"them","text":"吃了没"}]}]}')?.[0].name).toBe('妈');
    expect(parseCircleChatsJSON('{"people":[]}')).toBeNull();
    expect(circleRefreshIntervalMs({ mbti: 'ENFP' })).toBeLessThan(circleRefreshIntervalMs({ mbti: 'INFJ' }));
    const user = buildCircleRefreshUser({
      now: NOW,
      weather: '今天晴',
      hoursSinceLast: 30,
      recentNotes: ['加班到十点'],
      recentPosts: [],
      upcoming: ['09-06 19:00 和阿哲打球'],
      tails: [{ name: '阿哲', relation: '发小', lines: [{ from: 'them', text: '周末打球？', at: 1 }] }],
      hisName: '林知夏',
      herTier: 'independent',
    });
    expect(user).toContain('1 天前');
    expect(user).toContain('阿哲（发小）：阿哲「周末打球？」');
    expect(user).toContain('不提她');
  });
  it('【你身边的人】进亲密 prompt，没有圈子不出段', () => {
    expect(circleBlock(undefined)).toEqual([]);
    const circle = [{ id: 'p1', name: '阿哲', relation: '发小', note: '损友' }];
    const text = buildChatSystemPrompt({ ...bondedCtx, bond: { ...bondedCtx.bond!, circle } }, NOW);
    expect(text).toContain('[People around you]');
    expect(text).toContain('- 阿哲 (发小): 损友');
  });
});

describe('广场偶遇的记忆', () => {
  it('初识 prompt 带上次在广场聊过的话', () => {
    const encounters = [{ at: 1, placeName: '广场', summary: '她：排队的人好多\n沈之言：应该很好吃吧' }];
    expect(encountersBlock({ ...squareCtx, encounters: [] })).toEqual([]);
    const text = buildChatSystemPrompt({ ...squareCtx, encounters }, NOW);
    expect(text).toContain("[You've met]");
    expect(text).toContain('- At 广场: 她：排队的人好多');
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
    expect(block[1]).toBe('- tomorrow 09:00: 早会');
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

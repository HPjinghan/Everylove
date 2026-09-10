/**
 * D-110 一组：世界书注入 / 身边的人注入 / 广场偶遇记忆 / X 互动解析 / 日历任何年份 / 外出开场白不重复。
 * 模型看到的字有变动时，这里和 prompts 快照一起红。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '@/features';

import { holidayFor } from '@/content/calendar';
import {
  buildChatSystemPrompt,
  buildPostReactionsSystem,
  circleBlock,
  encountersBlock,
  parseCircleJSON,
  parseReactionsJSON,
  pickOutingOpener,
  worldBlock,
} from '@/content/prompts';
import { setLang } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

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

describe('外出开场白模板', () => {
  it('同一情形连抽不重复上一条', () => {
    const a = pickOutingOpener('stranger');
    const b = pickOutingOpener('stranger');
    expect(a).not.toBe(b);
  });
});

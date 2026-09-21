/**
 * 本地检索与【你最近的日子】（D-158）：不整本塞 prompt——底是各最近一条，她提到什么再按词面相似度捞出来。
 */
import { describe, expect, it } from 'vitest';

import { HIS_DAYS_RETRIEVE, hisDaysBlock } from '@/content/prompts';
import { retrieve, shingles, similarity } from '@/lib/retrieval';

import { bondedCtx, history, NOW } from './fixtures';

const DAY = 86_400_000;

describe('lib/retrieval', () => {
  it('中文两字一组、拉丁词按空格、虚词不算；命中数 / √查询片段数', () => {
    expect([...shingles('桂花开了吗')]).toEqual(['桂花', '花开', '开了']);
    expect([...shingles('Miss you, ok?')]).toEqual(['miss', 'you', 'ok']);
    expect(similarity(shingles('桂花开了吗'), shingles('楼下的桂花开了，晚上备课时窗户一直开着'))).toBeCloseTo(3 / Math.sqrt(3));
    expect(similarity(shingles('今天好累'), shingles('今天的茶泡过头了'))).toBe(0);
    expect(similarity(shingles('今天好累'), shingles('楼下的桂花开了'))).toBe(0);
  });
  it('分数 ≥ min 的按分数取前 k 个', () => {
    const items = ['老周借的那本《陶庵梦忆》还没还我', '楼下的桂花开了', '今天的茶泡过头了'];
    const hits = retrieve('你那本书还回来了吗', items, (s) => s, { k: 2, min: 0.25 });
    expect(hits.map((h) => h.item)).toEqual(['老周借的那本《陶庵梦忆》还没还我']);
    expect(retrieve('', items, (s) => s, { k: 2, min: 0.25 })).toEqual([]);
  });
});

describe('【你最近的日子】', () => {
  const notes = [
    { id: 'n0', text: '老周借的那本《陶庵梦忆》还没还我，明天上课前去问他。', at: NOW.getTime() - 12 * DAY },
    { id: 'n1', text: '系里开会开到很晚，回来路上买了两个橘子。', at: NOW.getTime() - 5 * DAY },
    { id: 'n2', text: '楼下的桂花开了，晚上备课时窗户一直开着。', at: NOW.getTime() - DAY },
  ];
  const hisPosts = [
    { text: '系里的樱花开了半树，拍给你们看。', at: NOW.getTime() - 20 * DAY },
    { text: '今天的茶泡过头了。', at: NOW.getTime() - 3 * 3600_000 },
  ];
  const ctx = { ...bondedCtx, bond: { ...bondedCtx.bond!, notes }, hisPosts };

  it('她没提到什么：只有最近一条记事本 + 最近一条帖，按时间排', () => {
    const lines = hisDaysBlock({ ...ctx, userText: '好累，想听你说说话。' }, NOW);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('- yesterday (notebook): 楼下的桂花开了，晚上备课时窗户一直开着。');
    expect(lines[2]).toBe('- today (post): 今天的茶泡过头了。');
  });
  it('她提到了：把相关的旧条目捞出来（12 天前的记事本、20 天前的帖），日期写绝对', () => {
    const lines = hisDaysBlock({ ...ctx, userText: '老周那本书还回来了吗？樱花还开着吗' }, NOW);
    expect(lines.some((l) => l.includes('(notebook): 老周借的那本'))).toBe(true);
    expect(lines.some((l) => l.includes('(post): 系里的樱花开了半树'))).toBe(true);
    expect(lines.some((l) => /^- \d{2}-\d{2} \(/.test(l))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(1 + 2 + HIS_DAYS_RETRIEVE);
  });
  it('她上一句也算进查询；没记事本没帖不出段', () => {
    const lines = hisDaysBlock({ ...ctx, history: [...ctx.history, ...history([['me', '你买的橘子甜吗']])], userText: '嗯？' }, NOW);
    expect(lines.some((l) => l.includes('买了两个橘子'))).toBe(true);
    expect(hisDaysBlock({ ...ctx, bond: { ...ctx.bond!, notes: [] }, hisPosts: [] }, NOW)).toEqual([]);
  });
});

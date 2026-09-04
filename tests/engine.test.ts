/**
 * 引擎工具函数：历史整理 / 气泡拆分 / 舞台提示剥离 / 回复标记。
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

import '@/features';

import { applyReplyMarkers, buildTurns, HISTORY_ROUNDS, splitBubbles, stripStageDirections } from '@/lib/engine';
import { history, NOW } from './fixtures';

describe('buildTurns', () => {
  it('系统条不进；同角色合并；首条必须是 user；本轮消息去重', () => {
    const h = history([
      ['him', '你好'],
      ['him', '在吗'],
      ['system', '羁绊升级'],
      ['me', '在'],
      ['me', '刚回来'],
    ]);
    expect(buildTurns(h, '刚回来')).toEqual([
      { role: 'user', content: '（她点开了和你的对话）' },
      { role: 'assistant', content: '你好\n在吗' },
      { role: 'user', content: '在\n刚回来' },
    ]);
  });
  it('历史只留最近 HISTORY_ROUNDS 轮，再加本轮', () => {
    const lines: [('me' | 'him'), string][] = [];
    for (let i = 0; i < HISTORY_ROUNDS + 5; i++) lines.push(['me', `q${i}`], ['him', `a${i}`]);
    const turns = buildTurns(history(lines), 'last');
    expect(turns.filter((t) => t.role === 'user')).toHaveLength(HISTORY_ROUNDS + 1);
    expect(turns[0]).toEqual({ role: 'user', content: 'q5' });
    expect(turns[turns.length - 1]).toEqual({ role: 'user', content: 'last' });
  });
});

describe('splitBubbles / stripStageDirections', () => {
  it('空行拆条、去名字前缀与引号、封顶', () => {
    expect(splitBubbles('沈之言：「到家了？」\n\n嗯，我也刚到。\n\n第三条', 2, '沈之言')).toEqual(['到家了？', '嗯，我也刚到。']);
  });
  it('剥（）提示，全剥空则退回原文', () => {
    expect(stripStageDirections(['（笑）晚安。', '（沉默）'])).toEqual(['晚安。']);
    expect(stripStageDirections(['（沉默）'])).toEqual(['（沉默）']);
  });
});

describe('applyReplyMarkers', () => {
  it('剥掉标记并置位；全剥空留省略号', () => {
    expect(applyReplyMarkers({ texts: ['密码是 4821', '[解锁手机]'] })).toEqual({
      texts: ['密码是 4821'],
      flags: { unlockPhone: true },
    });
    expect(applyReplyMarkers({ texts: ['[拆红包]'] })).toEqual({ texts: ['……'], flags: { openRedPacket: true } });
    expect(applyReplyMarkers({ texts: ['没有标记'] })).toEqual({ texts: ['没有标记'] });
  });
});

describe('fixtures', () => {
  it('NOW 固定在 2026-09-04 周五 21:30', () => {
    expect(NOW.getDay()).toBe(5);
  });
});

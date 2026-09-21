/**
 * 引擎工具函数：历史整理 / 气泡拆分 / 舞台提示剥离 / 回复标记。
 */
import { describe, expect, it, vi } from 'vitest';

import '@/features';

import { applyReplyMarkers, bubbleStyleOf, buildTurns, HISTORY_ROUNDS, splitBubbles, splitByClauses, splitBySpaces, stripStageDirections } from '@/lib/engine';
import { stripTrailingPeriod } from '@/lib/text';
import { history, NOW } from './fixtures';

// vitest 会把 vi.mock 提升到文件顶部，写在 import 之后只是为了过 import/first
vi.mock('@/lib/proxy', () => ({
  proxyAvailable: async () => false,
  proxyReadySync: () => false,
  proxyJson: async () => {
    throw new Error('no proxy in tests');
  },
}));

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
      { role: 'user', content: '(She opened the chat with you.)' },
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

describe('客户端分段（D-137）', () => {
  it('两句以上按句末标点拆成两条、长度均衡；一句不拆；模型自己空行分的照用；max 1 不拆', () => {
    expect(splitBubbles('到家了？我也刚到，猫在门口等我。', 2)).toEqual(['到家了？', '我也刚到，猫在门口等我。']);
    expect(splitBubbles('嗯，我刚到家，猫在门口等我。你呢，还在画？别熬太晚。', 2)).toEqual(['嗯，我刚到家，猫在门口等我。', '你呢，还在画？别熬太晚。']);
    expect(splitBubbles('我也刚到，猫在门口等我。', 2)).toEqual(['我也刚到，猫在门口等我。']);
    expect(splitBubbles('嗯。', 2)).toEqual(['嗯。']);
    expect(splitBubbles('到家了？我也刚到。', 1)).toEqual(['到家了？我也刚到。']);
    expect(splitBubbles('Just got home. The cat was waiting at the door! You?', 2)).toEqual(['Just got home.', 'The cat was waiting at the door! You?']);
    expect(splitBubbles('版本 5.20 出了。你更新了吗？', 2)).toEqual(['版本 5.20 出了。', '你更新了吗？']);
    expect(splitBubbles('第一句。第二句。第三句。', 3)).toEqual(['第一句。', '第二句。', '第三句。']);
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

describe('说话节奏：连发（D-155）', () => {
  it('每个标点都断一条，条末逗号 / 句号去掉、问号感叹号留着；一个字的碎片并回前一条', () => {
    expect(splitByClauses('哈哈哈，我知道了，下次。')).toEqual(['哈哈哈', '我知道了', '下次']);
    expect(splitByClauses('到家了？我也刚到，猫在门口等我。')).toEqual(['到家了？', '我也刚到', '猫在门口等我']);
    expect(splitByClauses('哈哈哈，嗯')).toEqual(['哈哈哈嗯']);
    expect(splitByClauses('haha, got it, next time.')).toEqual(['haha', 'got it', 'next time']);
    expect(splitByClauses('花了 5.20 块，还行')).toEqual(['花了 5.20 块', '还行']);
  });
  it('超过上限并进最后一条；一句话不拆', () => {
    expect(splitByClauses('好啊，行吧，可以，没问题，走吧，明天', 4)).toEqual(['好啊', '行吧', '可以', '没问题 走吧 明天']);
    expect(splitByClauses('今天有点累')).toEqual(['今天有点累']);
  });
  it('splitBubbles 按节奏走：连发时模型分好的段再拆、总数封顶四条；整句照旧最多两条', () => {
    expect(splitBubbles('哈哈哈，我知道了，下次。\n\n你呢，还在画？别熬太晚。', 4, undefined, 'burst')).toEqual(['哈哈哈', '我知道了', '下次', '你呢 还在画？ 别熬太晚']);
    expect(splitBubbles('哈哈哈，我知道了，下次。', 2)).toEqual(['哈哈哈，我知道了，下次。']);
  });
  it('空格断句（D-159）：中文 / 日文之间的空格每个一条、上限四条并进最后一条；英文与韩语词间、数字旁的空格不动；一条气泡的模式不拆', () => {
    expect(splitBySpaces('哈哈哈 我知道了 下次')).toEqual(['哈哈哈', '我知道了', '下次']);
    expect(splitBySpaces('到家了？ 嗯　我也刚到')).toEqual(['到家了？', '嗯', '我也刚到']);
    expect(splitBySpaces('花了 5.20 块 还行')).toEqual(['花了 5.20 块', '还行']);
    expect(splitBySpaces('Just got home, the cat was waiting')).toEqual(['Just got home, the cat was waiting']);
    expect(splitBySpaces('我在看 Dune 第二部')).toEqual(['我在看 Dune 第二部']);
    expect(splitBySpaces('はは わかった 今度ね')).toEqual(['はは', 'わかった', '今度ね']);
    expect(splitBySpaces('오늘 뭐 했어? 나는 집에 왔어')).toEqual(['오늘 뭐 했어? 나는 집에 왔어']);
    expect(splitBubbles('哈哈哈 我知道了 下次', 2)).toEqual(['哈哈哈', '我知道了', '下次']);
    expect(splitBubbles('好啊 行吧 可以 没问题 走吧 明天', 2)).toEqual(['好啊', '行吧', '可以', '没问题 走吧 明天']);
    expect(splitBubbles('哈哈哈 我知道了，下次', 4, undefined, 'burst')).toEqual(['哈哈哈', '我知道了', '下次']);
    expect(splitBubbles('哈哈哈 我知道了 下次', 1)).toEqual(['哈哈哈 我知道了 下次']);
    expect(splitBubbles('嗯，我刚到家，猫在门口等我。你呢，还在画？别熬太晚。', 2)).toEqual(['嗯，我刚到家，猫在门口等我。', '你呢，还在画？别熬太晚。']);
  });
  it('节奏判定：角色自己设的 > 恋爱类型 > 原型（毒舌家族连发）', () => {
    expect(bubbleStyleOf({ archetype: 'gentle' })).toBe('flow');
    expect(bubbleStyleOf({ archetype: 'sharp' })).toBe('burst');
    expect(bubbleStyleOf({ archetype: 'gentle', loveStyle: '小狗系年下' })).toBe('burst');
    expect(bubbleStyleOf({ archetype: 'sharp', loveStyle: '高冷禁欲' })).toBe('flow');
    expect(bubbleStyleOf({ archetype: 'sharp', loveStyle: '小狗系年下', bubbleStyle: 'flow' })).toBe('flow');
  });
});

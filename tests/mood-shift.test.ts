/** 她的回复变短了（D-153）：只在刚变短的那一轮提示；问句不提示；之前没多少话或本来就短不提示 */
import { describe, expect, it } from 'vitest';

import { moodShiftLines, moodShiftReason } from '@/content/prompts';
import type { ChatMessage } from '@/lib/types';

const hers = (texts: string[]): ChatMessage[] =>
  texts.flatMap((text, i) => [
    { id: `m${i}`, from: 'me', kind: 'text', text, at: i * 2 } as ChatMessage,
    { id: `h${i}`, from: 'him', kind: 'text', text: '嗯', at: i * 2 + 1 } as ChatMessage,
  ]);
const long = '今天去了趟美术馆，人不多，看了一下午的水彩，回来路上买了杯热的';

describe('mood-shift', () => {
  it('之前六条都挺长、最近三条突然很短 → 提示；再往后一轮不再提示', () => {
    const history = hers([long, long, long, long, long, long, '嗯', '哦']);
    expect(moodShiftReason({ userText: '没事', history })).toBe('shorter');
    expect(moodShiftLines({ userText: '没事', history })[0]).toContain('[This turn]');
    // 下一轮：最近三条之前的那条（「嗯」）已经短了 → 不是转折，不提示
    const next = hers([long, long, long, long, long, long, '嗯', '哦', '没事']);
    expect(moodShiftReason({ userText: '哦', history: next })).toBeNull();
  });
  it('问句 / 舞台提示不提示；聊得不多或她本来就话少不提示', () => {
    const history = hers([long, long, long, long, long, long, '嗯', '哦']);
    expect(moodShiftReason({ userText: '你呢？', history })).toBeNull();
    expect(moodShiftReason({ userText: '（她把手机递给你）', history })).toBeNull();
    expect(moodShiftReason({ userText: '没事', history: hers([long, long, '嗯', '哦']) })).toBeNull();
    expect(moodShiftReason({ userText: '没事', history: hers(['好', '嗯', '在', '哦', '好的', '嗯嗯', '嗯', '哦']) })).toBeNull();
  });
});

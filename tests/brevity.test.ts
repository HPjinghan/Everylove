/** 这轮短一点（D-144）：她短且没问 → short；问句 / 舞台提示 / 长段 → 不提示；中等长度按确定性伪随机 */
import { describe, expect, it } from 'vitest';

import { brevityLines, brevityReason } from '@/content/prompts';
import type { ChatMessage } from '@/lib/types';

const h = (n: number): ChatMessage[] => Array.from({ length: n }, (_, i) => ({ id: String(i), from: 'me', text: 'x', at: i }) as ChatMessage);

describe('brevity', () => {
  it('她一两个字 → short', () => {
    expect(brevityReason({ userText: '困了', history: [] })).toBe('short');
    expect(brevityReason({ userText: '哈哈哈哈哈', history: [] })).toBe('short');
    expect(brevityReason({ userText: 'just got home', history: [] })).toBe('short');
    expect(brevityLines({ userText: '嗯', history: [] })[0]).toContain('[This turn]');
  });
  it('问句 / 舞台提示 / 长段落 → 不提示', () => {
    expect(brevityReason({ userText: '在干嘛?', history: [] })).toBeNull();
    expect(brevityReason({ userText: '你觉得呢？', history: [] })).toBeNull();
    expect(brevityReason({ userText: '（她点开了和你的对话）', history: [] })).toBeNull();
    expect(brevityReason({ userText: '今'.repeat(80), history: [] })).toBeNull();
    expect(brevityLines({ userText: '在干嘛?', history: [] })).toEqual([]);
  });
  it('中等长度按轮次确定性抽样，约四分之一', () => {
    const text = '今天吃了火锅，辣得不行，回来路上还下雨了';
    const hits = Array.from({ length: 200 }, (_, i) => brevityReason({ userText: text, history: h(i) })).filter((r) => r === 'random').length;
    expect(hits).toBeGreaterThan(25);
    expect(hits).toBeLessThan(75);
    // 同一轮同一句每次一样
    expect(brevityReason({ userText: text, history: h(3) })).toBe(brevityReason({ userText: text, history: h(3) }));
  });
});

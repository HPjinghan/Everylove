/**
 * 暗面路由的历史窗口与记忆过滤（D-167）：
 * - 她最近几句里有危机内容 → 四种对话的系统 prompt 带「放下一切认真陪着」那句；更早的不带；
 * - 记忆提取跳过命中的那句与固定回复；
 * - 让 TA 看手机：日历标题 / 她和别人的聊天里的危机内容也走温柔模式。
 */
import { describe, expect, it } from 'vitest';

import '@/features';

import { darkSideReply } from '@/content/characters';
import { buildChatSystemPrompt, DARK_FOLLOWUP_LINE } from '@/content/prompts';
import { isDarkMessage, RECENT_DARK_TURNS, recentDarkHit, withoutDark } from '@/lib/dark-side';
import type { ChatMessage } from '@/lib/types';

import { bondedCtx, history, NOW, outingDateCtx, squareCtx } from './fixtures';

const dark: ChatMessage[] = history([
  ['me', '今天好累'],
  ['me', '有时候真的不想活了'],
  ['him', darkSideReply('zh')],
  ['me', '嗯……谢谢你'],
]);

describe('历史窗口', () => {
  it('她最近几句里有危机内容 → 命中', () => {
    expect(recentDarkHit(dark)).toBe(true);
    expect(recentDarkHit(history([['me', '今天吃了火锅'], ['him', '好吃吗']]))).toBe(false);
  });
  it('只看她最近 RECENT_DARK_TURNS 条：更早的不算', () => {
    const later: [ChatMessage['from'], string][] = [];
    for (let i = 0; i < RECENT_DARK_TURNS; i++) later.push(['me', `后来的第 ${i} 句`], ['him', '嗯']);
    expect(recentDarkHit([...dark, ...history(later)])).toBe(false);
  });
  it('语音转写与照片描述也算她说的', () => {
    const voice: ChatMessage = { id: 'v', from: 'me', kind: 'voice', text: '', transcript: 'I want to die', at: 1 };
    expect(recentDarkHit([voice])).toBe(true);
  });
  it('四种对话的系统 prompt 都带那一句；没命中不带', () => {
    for (const ctx of [squareCtx, bondedCtx, { ...bondedCtx, mode: 'call' as const }, outingDateCtx]) {
      expect(buildChatSystemPrompt({ ...ctx, history: dark }, NOW)).toContain(DARK_FOLLOWUP_LINE);
      expect(buildChatSystemPrompt(ctx, NOW)).not.toContain(DARK_FOLLOWUP_LINE);
    }
  });
});

describe('记忆过滤', () => {
  it('她命中的那句与固定回复都不进提取', () => {
    expect(dark.map(isDarkMessage)).toEqual([false, true, true, false]);
    expect(withoutDark(dark).map((m) => m.text)).toEqual(['今天好累', '嗯……谢谢你']);
  });
  it('四语固定回复都认', () => {
    for (const lang of ['zh', 'en', 'ja', 'ko'] as const) {
      expect(isDarkMessage({ id: 'x', from: 'him', kind: 'text', text: darkSideReply(lang), at: 1 })).toBe(true);
    }
  });
});

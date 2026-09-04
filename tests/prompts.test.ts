/**
 * Prompt 快照（D-086）：四种对话模式 + TA 的记事本，装配出的系统 prompt 逐字锁定。
 * 目的：底座重构（分段表装配）必须与旧的手工拼接逐字一致；之后任何改动只要碰到模型看到的字，快照就会红。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildChatSystemPrompt, buildHisNoteSystem, messageContextText } from '@/content/prompts';
import { setLang } from '@/lib/i18n';
import {
  bondedCtx,
  bondedUnlockedCustomCtx,
  callCtx,
  NOW,
  noteCtx,
  outingDateCtx,
  outingDateNoTimeCtx,
  outingEarlyCtx,
  outingEncounterCtx,
  outingLateCtx,
  outingStrangerCtx,
  squareCtx,
  squareCustomCtx,
} from './fixtures';

beforeEach(() => setLang('zh'));
afterEach(() => setLang('zh'));

describe('系统 prompt 装配', () => {
  it('初识（种子角色）', () => {
    expect(buildChatSystemPrompt(squareCtx, NOW)).toMatchSnapshot();
  });
  it('初识（自创角色，暧昧期）', () => {
    expect(buildChatSystemPrompt(squareCustomCtx, NOW)).toMatchSnapshot();
  });
  it('亲密（种子角色，手机未解锁）', () => {
    expect(buildChatSystemPrompt(bondedCtx, NOW)).toMatchSnapshot();
  });
  it('亲密（自创角色，字段填满，手机已解锁，LV 高）', () => {
    expect(buildChatSystemPrompt(bondedUnlockedCustomCtx, NOW)).toMatchSnapshot();
  });
  it('通话', () => {
    expect(buildChatSystemPrompt(callCtx, NOW)).toMatchSnapshot();
  });
  it('TA 的记事本', () => {
    expect(buildHisNoteSystem(noteCtx, NOW)).toMatchSnapshot();
  });
  it('外出：赴约准时', () => {
    expect(buildChatSystemPrompt(outingDateCtx, NOW)).toMatchSnapshot();
  });
  it('外出：赴约迟到', () => {
    expect(buildChatSystemPrompt(outingLateCtx, NOW)).toMatchSnapshot();
  });
  it('外出：赴约早到', () => {
    expect(buildChatSystemPrompt(outingEarlyCtx, NOW)).toMatchSnapshot();
  });
  it('外出：赴约（没定时间）', () => {
    expect(buildChatSystemPrompt(outingDateNoTimeCtx, NOW)).toMatchSnapshot();
  });
  it('外出：偶遇（自创角色）', () => {
    expect(buildChatSystemPrompt(outingEncounterCtx, NOW)).toMatchSnapshot();
  });
  it('外出：广场陌生人', () => {
    expect(buildChatSystemPrompt(outingStrangerCtx, NOW)).toMatchSnapshot();
  });
  it('语言行跟随界面语言（en / ja）', () => {
    setLang('en');
    const en = buildChatSystemPrompt(bondedCtx, NOW);
    setLang('ja');
    const ja = buildChatSystemPrompt(bondedCtx, NOW);
    expect(en).toContain('English');
    expect(ja).toContain('日本語');
    expect(en.replace(/^- 始终用.*$/m, '')).toBe(ja.replace(/^- 始终用.*$/m, ''));
  });
});

describe('消息进模型上下文的文字', () => {
  const at = NOW.getTime();
  it('卡片', () => {
    expect(
      [
        { id: '1', from: 'me', kind: 'card', text: '', at, card: { type: 'invite', title: '明天 15:00 · 街角咖啡馆' } },
        { id: '2', from: 'me', kind: 'card', text: '', at, card: { type: 'redpacket', title: '¥5.20', subtitle: '买杯咖啡' } },
        { id: '3', from: 'me', kind: 'card', text: '', at, card: { type: 'redpacket', title: '¥5.20', claimed: true } },
        { id: '4', from: 'me', kind: 'card', text: '', at, card: { type: 'redpacket', title: '¥5.20', declined: true } },
        { id: '5', from: 'me', kind: 'card', text: '', at, card: { type: 'phoneRequest', title: '想看看你的手机' } },
        { id: '6', from: 'me', kind: 'card', text: '', at, card: { type: 'location', title: '西湖', subtitle: '杭州市西湖区' } },
      ].map((m) => messageContextText(m as never))
    ).toMatchSnapshot();
  });
  it('语音 / 照片 / 引用 / 撤回 / 系统', () => {
    expect(
      [
        { id: '1', from: 'me', kind: 'voice', text: '', at, transcript: '晚安呀' },
        { id: '2', from: 'me', kind: 'voice', text: '', at, mediaStatus: 'pending' },
        { id: '3', from: 'me', kind: 'image', text: '看', at, caption: '一只三花猫趴在窗台上' },
        { id: '4', from: 'me', kind: 'text', text: '好啊', at, replyTo: { from: 'him', text: '周末去看海？' } },
        { id: '5', from: 'me', kind: 'text', text: '', at, recalled: true },
        { id: '6', from: 'system', kind: 'system', text: '羁绊升级', at },
        { id: '7', from: 'him', kind: 'image', text: '', at, spoken: '给你看个东西' },
      ].map((m) => messageContextText(m as never))
    ).toMatchSnapshot();
  });
});

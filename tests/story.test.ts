/**
 * 传记（D-149）：章节读角色的现行版本（种子 = 内容包、共享池 = 云端那份、自己的 = 角色库，快照只回落）；
 * 开不开按这段羁绊现在的等级；打赏从零钱扣、记 tip、按章累计，不够不扣。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { chaptersFor } from '@/content/characters';
import { chapterOpen, chaptersForBond, chapterText, liveCharacterFor } from '@/lib/story';
import type { Character, StoryChapter } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

import { custom, seed } from './fixtures';

const chapter = (id: string, unlockLevel: number, text = '正文'): StoryChapter => ({
  id,
  title: `章 ${id}`,
  unlockLevel,
  blocks: [{ type: 'text', text }],
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(() => useAppStore.getState().resetAll());

describe('传记：章节从哪来', () => {
  it('种子角色读内容包；中文六位各两章，第二章 LV3 开', () => {
    const chs = chaptersFor(seed);
    expect(chs).toHaveLength(2);
    expect(chs[0].unlockLevel).toBe(1);
    expect(chs[1].unlockLevel).toBe(3);
    expect(chapterText(chs[0]).length).toBeGreaterThan(100);
  });

  it('自创角色读自己的章节；羁绊快照里的旧章节不算数（内容不是设定）', () => {
    const s = () => useAppStore.getState();
    s().addCustomCharacter({ ...custom, chapters: [chapter('a', 1)] });
    const bondId = s().createBond({ characterId: custom.id, name: custom.name, nickname: '小满' });
    const bond = () => s().bonds.find((b) => b.id === bondId)!;
    expect(chaptersForBond(bond()).map((c) => c.id)).toEqual(['a']);
    // 作者续写一章：读者立刻看到，不用换设定
    s().updateCustomCharacter({ ...custom, chapters: [chapter('a', 1), chapter('b', 4)] });
    expect(bond().character?.chapters?.map((c) => c.id)).toEqual(['a']);
    expect(chaptersForBond(bond()).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('共享池角色以云端那份为准；找不到现行版本时回落快照', () => {
    const pooled: Character = { ...custom, id: 'c-pool', shared: true, chapters: [chapter('cloud', 1)] };
    const s = () => useAppStore.getState();
    s().setSharedPool([pooled]);
    const bondId = s().createBond({ characterId: pooled.id, name: pooled.name, nickname: '小满' });
    const bond = () => s().bonds.find((b) => b.id === bondId)!;
    expect(liveCharacterFor(bond())?.chapters?.[0].id).toBe('cloud');
    s().setSharedPool([{ ...pooled, chapters: [chapter('cloud', 1), chapter('cloud-2', 2)] }]);
    expect(chaptersForBond(bond()).map((c) => c.id)).toEqual(['cloud', 'cloud-2']);
    // 下架了：本地缓存里没了 → 快照
    s().setSharedPool([]);
    expect(chaptersForBond(bond()).map((c) => c.id)).toEqual(['cloud']);
  });

  it('开不开按这段羁绊现在的等级', () => {
    const now = Date.now();
    const fresh = { characterId: 'x', affinity: 0, createdAt: now };
    expect(chapterOpen(fresh, chapter('a', 1), now)).toBe(true);
    expect(chapterOpen(fresh, chapter('b', 3), now)).toBe(false);
    const old = { characterId: 'x', affinity: 5000, createdAt: now - 100 * 86_400_000 };
    expect(chapterOpen(old, chapter('b', 3), now)).toBe(true);
  });
});

describe('传记：打赏', () => {
  it('从零钱扣、记 tip、按章累计；不够不扣', () => {
    const s = () => useAppStore.getState();
    s().creditWallet({ amount: 60, kind: 'fortune', note: '日签' });
    expect(s().tipChapter('ch-1', 50, '第一章')).toBe(true);
    expect(s().wallet.balance).toBe(10);
    expect(s().wallet.ledger.find((e) => e.kind === 'tip')).toMatchObject({ kind: 'tip', amount: -50, note: '第一章' });
    expect(s().storyTips['ch-1']).toBe(50);
    expect(s().tipChapter('ch-1', 50, '第一章')).toBe(false);
    expect(s().wallet.balance).toBe(10);
    expect(s().tipChapter('ch-1', 10, '第一章')).toBe(true);
    expect(s().storyTips['ch-1']).toBe(60);
  });
});

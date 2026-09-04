/**
 * 三语本地化（D-093）：每种语言六位种子角色只分发给自己语言的用户；脚本 / 兜底 / 动态 / 暗面路由 / 心跳 / 开场白按语言取。
 */
import { afterEach, describe, expect, it } from 'vitest';

import '@/features';

import { bondedPostsFor, CHARACTERS, DARK_SIDE_PATTERN, darkSideReply, scriptFor, seedCharactersFor } from '@/content/characters';
import { heartbeatLine, outingOpeners } from '@/content/prompts';
import { darkSideCheck } from '@/lib/engine';
import { setLang } from '@/lib/i18n';
import type { Character } from '@/lib/types';

afterEach(() => setLang('zh'));

describe('种子角色按语言分发', () => {
  it('三种语言各六位，id 互不相同，查找表含全部', () => {
    for (const lang of ['zh', 'en', 'ja'] as const) {
      const seeds = seedCharactersFor(lang);
      expect(seeds).toHaveLength(6);
      expect(seeds.every((c) => c.lang === lang)).toBe(true);
    }
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(18);
    expect(seedCharactersFor('en').map((c) => c.id)).toEqual(seedCharactersFor('zh').map((c) => `${c.id}-en`));
    expect(seedCharactersFor('ja').map((c) => c.id)).toEqual(seedCharactersFor('zh').map((c) => `${c.id}-ja`));
  });
  it('缺省按界面语言', () => {
    setLang('ja');
    expect(seedCharactersFor()[0].name).toBe('篠宮 湊');
  });
  it('脚本与动态跟着角色的语言走，自创角色回落该语言的原型兜底', () => {
    const [ethan] = seedCharactersFor('en');
    expect(scriptFor(ethan).persona).toContain('Ethan Shaw');
    expect(scriptFor(ethan).offer).toHaveLength(3);
    expect(bondedPostsFor(ethan)).toHaveLength(2);
    const custom: Character = {
      id: 'c1',
      name: 'X',
      archetype: 'sharp',
      loveTag: 'male',
      identity: '',
      hook: '',
      intro: '',
      tags: [],
      adoptedCount: 0,
      color: '#000',
      colorSoft: '#fff',
      custom: true,
      lang: 'ja',
    };
    expect(scriptFor(custom).opening[0]).toBe('ああ、君があの……いや、いい。話せば。');
    expect(bondedPostsFor(custom)[0].text).toContain('関係ないだろ');
    // 旧存档没有 lang：按当前界面语言
    setLang('en');
    expect(scriptFor({ ...custom, lang: undefined }).persona).toContain('childhood-friend');
  });
});

describe('系统层与模板按语言', () => {
  it('暗面路由三语触发，回复按界面语言', () => {
    expect(DARK_SIDE_PATTERN.test('我不想活了')).toBe(true);
    expect(DARK_SIDE_PATTERN.test("I want to kill myself")).toBe(true);
    expect(DARK_SIDE_PATTERN.test('もう死にたい')).toBe(true);
    expect(DARK_SIDE_PATTERN.test('今天好累')).toBe(false);
    expect(DARK_SIDE_PATTERN.test('I killed it at karaoke')).toBe(false);
    setLang('en');
    expect(darkSideCheck('honestly I just want to die')?.texts[0]).toContain('988');
    setLang('ja');
    expect(darkSideReply()).toContain('0120-279-338');
  });
  it('心跳与外出开场白', () => {
    expect(heartbeatLine('day', 'finals', 'Mia', 1, 'en')).toBe("Mia, go get it. Tell me first the moment 'finals' is over.");
    setLang('ja');
    expect(heartbeatLine('before', '期末試験', '小春', 0)).toContain('「期末試験」');
    expect(outingOpeners().stranger).toHaveLength(2);
    expect(outingOpeners('en').dateLate[1]).toContain('{minutes}');
  });
});

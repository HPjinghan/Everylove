/**
 * 角色更新通道（D-140）：快照与现行版本不同才算有更新；换了只动快照；共享池角色以云端那份为准。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { characterFingerprint, characterUpdateFor, liveCharacter } from '@/lib/character-update';
import type { Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

const custom: Character = {
  id: 'c-upd',
  name: '林知夏',
  archetype: 'gentle',
  loveTag: 'male',
  hook: 'x',
  intro: 'x',
  identity: '书店店员',
  tags: [],
  adoptedCount: 0,
  color: '#000',
  colorSoft: '#fff',
  custom: true,
};

beforeEach(() => useAppStore.getState().resetAll());

describe('角色更新通道', () => {
  it('指纹不看热度 / 来源 / 可见性；设定变了才不同', () => {
    expect(characterFingerprint({ ...custom, adoptedCount: 99, visibility: 'public', shared: true })).toBe(characterFingerprint(custom));
    expect(characterFingerprint({ ...custom, identity: '改了' })).not.toBe(characterFingerprint(custom));
    expect(characterFingerprint({ ...custom, voiceId: 'v1' })).not.toBe(characterFingerprint(custom));
  });

  it('作者改了 → 有更新；换成最新只动快照，聊天与等级不动；换完就是最新', () => {
    const s = () => useAppStore.getState();
    s().addCustomCharacter(custom);
    const bondId = s().createBond({ characterId: 'c-upd', name: '林知夏', nickname: '小满' });
    const bond = () => s().bonds.find((b) => b.id === bondId)!;
    expect(characterUpdateFor(bond())).toBeUndefined();
    s().updateCustomCharacter({ ...custom, identity: '改过的身份' });
    const live = characterUpdateFor(bond());
    expect(live?.identity).toBe('改过的身份');
    expect(findCharacter('c-upd')!.identity).toBe(custom.identity);
    const msgs = bond().messages.length;
    s().syncBondCharacter(bondId, live!);
    expect(findCharacter('c-upd')!.identity).toBe('改过的身份');
    expect(bond().messages.length).toBe(msgs);
    expect(bond().nickname).toBe('小满');
    expect(characterUpdateFor(bond())).toBeUndefined();
  });

  it('共享池角色：现行版本以云端拉回来的为准，本地那份抄件不算', () => {
    const s = () => useAppStore.getState();
    const shared = { ...custom, id: 'c-shared', custom: undefined, shared: true };
    s().setSharedPool([shared]);
    const bondId = s().createBond({ characterId: 'c-shared', name: '林知夏', nickname: '小满' });
    expect(s().customCharacters.some((c) => c.id === 'c-shared')).toBe(true);
    expect(characterUpdateFor(s().bonds.find((b) => b.id === bondId)!)).toBeUndefined();
    s().setSharedPool([{ ...shared, identity: '作者改了' }]);
    expect(liveCharacter('c-shared')?.identity).toBe('作者改了');
    expect(characterUpdateFor(s().bonds.find((b) => b.id === bondId)!)?.identity).toBe('作者改了');
  });
});

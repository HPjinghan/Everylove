/**
 * 消息归档（D-201）与路径修复（D-203）的纯函数。
 */
import { describe, expect, it } from 'vitest';

import { ARCHIVE_KEEP, ARCHIVE_TRIGGER, archiveCut } from '@/lib/archive';
import { repairStoreJson } from '@/lib/media-paths';
import { useAppStore } from '@/store/app-store';

describe('archiveCut', () => {
  it('不到阈值不动；超了只搬已折进摘要的、且留够 KEEP', () => {
    expect(archiveCut(ARCHIVE_TRIGGER, 999)).toBe(0);
    expect(archiveCut(ARCHIVE_TRIGGER + 1, 999)).toBe(ARCHIVE_TRIGGER + 1 - ARCHIVE_KEEP);
    expect(archiveCut(300, 30)).toBe(30);
    expect(archiveCut(300, 0)).toBe(0);
  });
  it('trimBondMessages 去掉最早 n 条，记忆下标一起挪', () => {
    useAppStore.getState().resetAll();
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const base = bond().messages.length;
    useAppStore.getState().setBondMemory(bondId, { facts: [], summary: '', summarizedUpTo: 2, factsUpTo: base, updatedAt: 0 });
    useAppStore.getState().trimBondMessages(bondId, 2);
    expect(bond().messages.length).toBe(base - 2);
    expect(bond().memory.summarizedUpTo).toBe(0);
    expect(bond().memory.factsUpTo).toBe(base - 2);
  });
});

describe('repairStoreJson', () => {
  const now = 'file:///var/mobile/Containers/Data/Application/NEW-UUID/Documents/';
  it('旧前缀全换成现在的；已经是现在的不动、没有路径返回 null', () => {
    const raw = '{"album":[{"uri":"file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/photos/a.jpg"}],"portraits":{"x":"file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/portraits/x.jpg"}}';
    const fixed = repairStoreJson(raw, now)!;
    expect(fixed).toContain(`${now}photos/a.jpg`);
    expect(fixed).toContain(`${now}portraits/x.jpg`);
    expect(fixed).not.toContain('OLD-UUID');
    expect(repairStoreJson(fixed, now)).toBeNull();
    expect(repairStoreJson('{"a":1}', now)).toBeNull();
  });
});

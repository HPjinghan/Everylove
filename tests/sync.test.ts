/**
 * 云同步对账决策（D-057 + D-096）：纯函数 planReconcile 与「本机是否空的」判定。
 * 锁定的规则：新手机 / 换账号登录时本机不许覆盖云端——本机空 → 拉云端；本机有关系 → conflict 交给界面问。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { localIsFresh, planReconcile } from '@/lib/sync';
import { useAppStore } from '@/store/app-store';

import { bondBase, custom, seed } from './fixtures';

const A = 'user-a';
const B = 'user-b';

describe('planReconcile', () => {
  it('云端没有备份：把本机第一份传上去（不管本机脏不脏）', () => {
    expect(planReconcile({ cloudAt: null, meta: { lastSyncedAt: 0, dirty: true }, userId: A, localFresh: true })).toBe('push-first');
    expect(planReconcile({ cloudAt: null, meta: { lastSyncedAt: 5, dirty: false, userId: A }, userId: A, localFresh: false })).toBe('push-first');
  });

  it('新手机（从没对过账）：本机空 → 拉云端；本机已有关系 → conflict，哪怕本机是脏的也不推', () => {
    const fresh = { lastSyncedAt: 0, dirty: true };
    expect(planReconcile({ cloudAt: 100, meta: fresh, userId: A, localFresh: true })).toBe('pull');
    expect(planReconcile({ cloudAt: 100, meta: fresh, userId: A, localFresh: false })).toBe('conflict');
  });

  it('换账号登录：对新账号而言是新手机', () => {
    const syncedWithA = { lastSyncedAt: 200, dirty: true, userId: A };
    expect(planReconcile({ cloudAt: 100, meta: syncedWithA, userId: B, localFresh: false })).toBe('conflict');
    expect(planReconcile({ cloudAt: 100, meta: syncedWithA, userId: B, localFresh: true })).toBe('pull');
  });

  it('同一账号、同一台手机（D-057）：本机脏 → 推；云端更新 → 拉；否则不动', () => {
    expect(planReconcile({ cloudAt: 100, meta: { lastSyncedAt: 200, dirty: true, userId: A }, userId: A, localFresh: false })).toBe('push');
    expect(planReconcile({ cloudAt: 5000, meta: { lastSyncedAt: 200, dirty: false, userId: A }, userId: A, localFresh: false })).toBe('pull');
    expect(planReconcile({ cloudAt: 1000, meta: { lastSyncedAt: 200, dirty: false, userId: A }, userId: A, localFresh: false })).toBe('noop');
  });

  it('D-096 之前的旧存档（没记账号）视为同一账号，不打扰老用户', () => {
    expect(planReconcile({ cloudAt: 100, meta: { lastSyncedAt: 200, dirty: true }, userId: A, localFresh: false })).toBe('push');
    expect(planReconcile({ cloudAt: 100, meta: { lastSyncedAt: 200, dirty: false }, userId: A, localFresh: false })).toBe('noop');
  });
});

describe('localIsFresh', () => {
  beforeEach(() => {
    useAppStore.getState().resetAll();
  });

  it('还没 onboarding 的新装机是空的', () => {
    expect(localIsFresh()).toBe(true);
  });

  it('onboarding 过但没建过关系也算空（试聊记录属于免费层，不算）', () => {
    useAppStore.setState({ onboarded: true, squareChats: { [seed.id]: { characterId: seed.id, messages: [], heart: 30, createdAt: 1, lastActiveAt: 1 } as never } });
    expect(localIsFresh()).toBe(true);
  });

  it('有羁绊就不空', () => {
    useAppStore.setState({
      onboarded: true,
      bonds: [{ id: 'b1', characterId: seed.id, messages: [], unread: 0, ...bondBase } as never],
    });
    expect(localIsFresh()).toBe(false);
  });

  it('有自己创造的角色就不空；只缓存了别人共享的不算', () => {
    useAppStore.setState({ onboarded: true, customCharacters: [{ ...custom, shared: true }] });
    expect(localIsFresh()).toBe(true);
    useAppStore.setState({ customCharacters: [{ ...custom, shared: false }] });
    expect(localIsFresh()).toBe(false);
  });
});

/**
 * 记忆合并（D-191）：模型返回的表为主、去重、骤降时补旧的；删消息时进度下标一起挪。
 */
import { describe, expect, it } from 'vitest';

import { MEMORY_MAX_FACTS, mergeFacts } from '@/lib/memory';
import { useAppStore } from '@/store/app-store';

describe('mergeFacts', () => {
  it('以模型的为主并去重（空白 / 末尾标点 / 大小写不算差别）', () => {
    expect(mergeFacts(['[她] 她怕黑'], ['[她] 她怕黑。', '[她] 她不吃香菜', ' [她] 她不吃香菜 '])).toEqual(['[她] 她怕黑。', '[她] 她不吃香菜']);
  });
  it('模型这次明显变短（多半只写了新增）→ 旧的补回来；平时不补，删得掉过时条目', () => {
    const old = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    expect(mergeFacts(old, ['new1'])).toEqual(['new1', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
    expect(mergeFacts(old, ['a1', 'a2', 'a3', 'a4', 'new1'])).toEqual(['a1', 'a2', 'a3', 'a4', 'new1']);
  });
  it('封顶', () => {
    const many = Array.from({ length: MEMORY_MAX_FACTS + 5 }, (_, i) => `f${i}`);
    expect(mergeFacts([], many)).toHaveLength(MEMORY_MAX_FACTS);
  });
});

describe('删消息时记忆进度下标一起挪', () => {
  it('删了进度之前的一条，factsUpTo / summarizedUpTo 各减一；之后的不动', () => {
    useAppStore.getState().resetAll();
    const bondId = useAppStore.getState().createBond({ characterId: 'shen-zhiyan', name: '沈之言', nickname: '小满' });
    const bond = () => useAppStore.getState().bonds.find((b) => b.id === bondId)!;
    const base = bond().messages.length;
    useAppStore.getState().appendBond(bondId, [
      { id: 'x1', from: 'me', kind: 'text', text: '1', at: 1 },
      { id: 'x2', from: 'him', kind: 'text', text: '2', at: 2 },
      { id: 'x3', from: 'me', kind: 'text', text: '3', at: 3 },
    ]);
    useAppStore.getState().setBondMemory(bondId, { facts: [], summary: '', summarizedUpTo: base + 1, factsUpTo: base + 2, updatedAt: 0 });
    useAppStore.getState().deleteMessage({ bondId }, 'x1');
    expect(bond().memory?.summarizedUpTo).toBe(base);
    expect(bond().memory?.factsUpTo).toBe(base + 1);
    useAppStore.getState().deleteMessage({ bondId }, 'x3');
    expect(bond().memory?.factsUpTo).toBe(base + 1);
  });
});

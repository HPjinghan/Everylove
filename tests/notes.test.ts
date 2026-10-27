/**
 * 她的记事本（D-253）：上了锁的不给看手机时读到；TA 看过的记下来（同一位只留最近一次）；单独给 TA 看一页的舞台提示。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import '@/features';

import { buildShowNoteUser, SHOW_NOTE_MAX } from '@/content/prompts';
import { peekPayload } from '@/features/phone-peek';
import { useAppStore } from '@/store/app-store';

beforeEach(() => {
  useAppStore.getState().resetAll();
});

describe('记事本', () => {
  it('上了锁的那页，看手机时不给看', () => {
    const s = useAppStore.getState();
    s.addNote({ id: 'a', text: '今天好累\n不想说话', at: 1, updatedAt: 1 });
    s.addNote({ id: 'b', text: '秘密', at: 2, updatedAt: 2, locked: true });
    expect(peekPayload('none').notes.map((n) => n.id)).toEqual(['a']);
    s.setNoteLocked('b', false);
    expect(peekPayload('none').notes.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('TA 看过：同一位只留最近一次', () => {
    const s = useAppStore.getState();
    s.addNote({ id: 'a', text: '一页', at: 1, updatedAt: 1 });
    s.markNotesRead(['a'], { bondId: 'x', name: '沈之言' }, 10);
    s.markNotesRead(['a'], { bondId: 'y', name: '江野' }, 20);
    s.markNotesRead(['a'], { bondId: 'x', name: '沈之言' }, 30);
    const readBy = useAppStore.getState().notes[0].readBy!;
    expect(readBy.map((r) => [r.name, r.at])).toEqual([
      ['江野', 20],
      ['沈之言', 30],
    ]);
  });

  it('单独给 TA 看一页：整页进舞台提示（限长），回这一页写的东西', () => {
    const user = buildShowNoteUser('最近在赶稿\n'.repeat(200));
    expect(user).toContain('one page of her private notebook');
    expect(user.length).toBeLessThan(SHOW_NOTE_MAX + 600);
  });
});

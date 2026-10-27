/**
 * 给 TA 看这一页（D-253）：她在记事本里挑一条、选一位 TA，这页以卡片进你们的会话，TA 读了回她——
 * 比「让 TA 看我的手机」轻：只给这一页，别的都不给。她发起的，扣她的流量（同发一条消息）；亲密度按「转给他」算。
 * 这页从此记作 TA 看过（记事本里显示）；内容并进 TA 的记忆——但先过暗面路由（红线 3：命中的不进记忆，D-167）。
 */

import { CardShell } from '@/components/card-bubble';
import { buildShowNoteUser } from '@/content/prompts';
import { cardKinds } from '@/core/cards';
import { sendCard, type TurnUi } from '@/core/turn';
import { darkSideCheck } from '@/lib/engine';
import { t } from '@/lib/i18n';
import { absorbNotesMemory } from '@/lib/memory';
import { useAppStore } from '@/store/app-store';

/** 卡片上露几个字 */
const PREVIEW_CHARS = 60;

cardKinds.register({
  type: 'note',
  contextText: (c) => `(She showed you a page from her notebook: "${c.title}"${c.subtitle ? ` — ${c.subtitle}` : ''})`,
  render: (c, dark) => <CardShell emoji="📒" kicker={t('记事本')} title={c.title} subtitle={c.subtitle} dark={dark} />,
});

/** 把一页给这位 TA 看；返回是否送出（流量不够等被拦下 = false） */
export async function showNote(noteId: string, bondId: string, ui?: TurnUi): Promise<boolean> {
  const store = useAppStore.getState();
  const note = store.notes.find((n) => n.id === noteId);
  const bond = store.bonds.find((b) => b.id === bondId);
  if (!note || !bond) return false;
  const [title = '', ...rest] = note.text.split('\n');
  const body = rest.join(' ').replace(/\s+/g, ' ').trim();
  const { id } = await sendCard(
    { mode: 'bonded', bondId },
    { type: 'note', title: title.slice(0, PREVIEW_CHARS), ...(body ? { subtitle: body.slice(0, PREVIEW_CHARS) } : {}) },
    buildShowNoteUser(note.text),
    ui
  );
  if (!id) return false;
  const now = Date.now();
  useAppStore.getState().markNotesRead([note.id], { bondId, name: bond.name }, now);
  useAppStore.getState().creditBond(bondId, 'share');
  if (!darkSideCheck(note.text)) void absorbNotesMemory(bondId, [{ at: note.updatedAt, text: note.text }]);
  return true;
}

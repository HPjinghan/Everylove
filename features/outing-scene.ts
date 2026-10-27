/**
 * 外出的跑团规则（D-254）：
 * - 纸条：安静的地方（和任何地方）她可以递一张纸条，在场的人读了用纸条回她；纸条不算出声。
 * - 被请出去：安静的地方她说出声三次（features/modes.ts 记数），这一轮落完后这一场结束、只能离开。
 * - 多人场里的陌生人好奇满 100：那个人当场开口要联系方式（同 features/adoption.ts，台词用他的脚本，说话人是他）。
 */

import { scriptFor } from '@/content/characters';
import { placeById } from '@/content/places';
import { modeOf } from '@/core/modes';
import { respond, turnHooks, wait, type TurnUi } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { sessionScope } from '@/lib/chat';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 安静的地方被制止几次请出去 */
export const STRIKES_OUT = 3;

/** 递一张纸条：落一条她的纸条，在场的人按这一场的规矩回（多人场 / 一人场同一条管线） */
export async function sendNote(text: string, ui?: TurnUi): Promise<void> {
  const session = useAppStore.getState().outingSession;
  const body = text.trim();
  if (!session || session.ended || !body) return;
  const scope = sessionScope(session);
  const mode = modeOf(scope);
  const msg: ChatMessage = { id: uid('m'), from: 'me', kind: 'text', text: body, note: true, at: Date.now() };
  const contextText = `(She passes a note: "${body}")`;
  mode.append(scope, [msg]);
  mode.creditUserTurn(scope, contextText, 'text');
  await respond(scope, contextText, ui, { her: true, msgId: msg.id });
}

turnHooks.after.on(async ({ scope, mode, darkSide, ui }) => {
  if (scope.mode !== 'outing' && scope.mode !== 'scene') return;
  const store = useAppStore.getState();
  const session = store.outingSession;
  if (!session || session.ended) return;

  // 第三次出声：请出去（旁白已经在这一轮写了工作人员过来；这里收场）
  if ((session.strikes ?? 0) >= STRIKES_OUT) {
    const place = placeById(session.placeId);
    store.patchOuting({ ended: true });
    mode.append(scope, [
      { id: uid('m'), from: 'system', kind: 'system', text: t('你们被请出了{place}', { place: place ? t(place.name) : '' }), at: Date.now() },
    ]);
    return;
  }

  // 多人场里好奇满了的陌生人：当场开口要联系方式
  if (scope.mode !== 'scene' || darkSide) return;
  for (const cid of session.cast ?? []) {
    if (store.bonds.some((b) => b.characterId === cid)) continue;
    const chat = useAppStore.getState().squareChats[cid];
    const c = findCharacter(cid);
    if (!c || !chat || chat.adoptionOffered || (chat.heart ?? 0) < HEART_FULL) continue;
    const natural = (ui.pace ?? 'natural') === 'natural';
    for (const line of scriptFor(c).offer) {
      ui.typing?.(true);
      if (natural) await wait(800);
      ui.typing?.(false);
      useAppStore.getState().appendOuting([{ id: uid('m'), from: 'him', kind: 'text', text: line, at: Date.now(), speaker: cid, speakerName: c.name }]);
    }
    useAppStore.getState().appendSquare(cid, [], { offered: true });
  }
});

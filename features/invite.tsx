/**
 * 外出邀请（D-081/D-084）：会话「+」→ 选地点 → 选时间 → 卡片「明天 15:00 · 街角咖啡馆」→ 立即成带时间的约定，TA 一定答应。
 * 一个玩法一个文件：卡片种类（进上下文的一句 + 气泡怎么画）+ 她发出时的动作。
 */

import { CardShell } from '@/components/card-bubble';
import type { Place } from '@/content/places';
import { cardKinds } from '@/core/cards';
import { sendCard, type TurnUi } from '@/core/turn';
import { appointmentAtLabel, planTimeLabel } from '@/lib/appointments';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

cardKinds.register({
  type: 'invite',
  contextText: (c) => `（她发来一张外出邀请：${c.title}）`,
  render: (c, dark) => <CardShell emoji="🚶" kicker={t('外出邀请')} title={c.title} subtitle={c.subtitle} dark={dark} />,
});

/** 她约 TA：卡片上屏 → 立即成一条带时间的约定（羁绊会话留「你们约好了…」）→ TA 用引擎回一句 */
export async function sendInvite(bondId: string, place: Place, at: number, ui?: TurnUi): Promise<void> {
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  if (!bond) return;
  const pending = sendCard(
    { mode: 'bonded', bondId },
    { type: 'invite', title: `${planTimeLabel(at)} · ${t(place.name)}`, subtitle: t(place.hook), placeId: place.id },
    `（她发来一张外出邀请：${appointmentAtLabel(at)} 去${place.name}。你答应下来，用你的口吻回她。）`,
    ui
  );
  useAppStore.getState().addOutingPlan(bond.characterId, place.id, { at, source: 'manual' });
  await pending;
}

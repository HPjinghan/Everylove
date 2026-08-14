/**
 * 开门同步：投递到点的「他来了」，并为下一次开门排本地通知。
 * App 启动、回前台、通知点开、测试改点后都走这里。
 */

import { scriptFor } from '@/content/characters';
import { scheduleArrivalNotification } from '@/lib/notifications';
import { findCharacter, useAppStore } from '@/store/app-store';

export async function deliverAndSyncArrivals(): Promise<string[]> {
  const delivered = useAppStore.getState().deliverDueArrivals();

  const { bonds, setBondNotif } = useAppStore.getState();
  for (const b of bonds) {
    if (!b.arrivalAt || b.notifId) continue;
    const character = findCharacter(b.characterId);
    if (!character) continue;
    const script = scriptFor(character);
    const id = await scheduleArrivalNotification(
      b.name,
      script.notifBody,
      new Date(b.arrivalAt),
      b.id
    );
    if (id) setBondNotif(b.id, id);
  }
  return delivered;
}

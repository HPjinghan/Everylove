/**
 * 心跳调度器（D-020/D-021）：日历用户层日程的三段式关怀——
 * 事前关心（前一天 18:00 起）、当天加油（当天 7:00 起）、事后回访（次日 12:00 起）。
 * 与「开门」同机制：App 启动 / 回前台时补投（deliverDueHeartbeats）。
 * 她的日历是私密的（D-113）：只有她让 TA 看过手机、TA 读到过的日程（event.knownBy）才会有人来关心，投进每一位知道的 TA 的会话；
 * 没人知道就没人来。台词模板在 content/prompts/heartbeat.ts。
 */

import { dateKey, parseDateKey } from '@/content/calendar';
import { heartbeatLine } from '@/content/prompts';
import { uid } from '@/lib/format';
import { useAppStore } from '@/store/app-store';

type Stage = 'caredBefore' | 'caredDay' | 'caredAfter';

/** 某段的可投递起点 */
function stageDue(eventDate: Date, stage: Stage): number {
  const d = new Date(eventDate);
  if (stage === 'caredBefore') {
    d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
  } else if (stage === 'caredDay') {
    d.setHours(7, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
  }
  return d.getTime();
}

/** 过了下一段的起点就不再补投上一段（错过就是错过——与「他有作息」一致；错过回溯是付费点，D-020） */
function stageExpiry(eventDate: Date, stage: Stage): number {
  if (stage === 'caredBefore') return stageDue(eventDate, 'caredDay');
  if (stage === 'caredDay') return stageDue(eventDate, 'caredAfter');
  const d = new Date(eventDate);
  d.setDate(d.getDate() + 3);
  return d.getTime();
}

const STAGE_KEY: Record<Stage, 'before' | 'day' | 'after'> = {
  caredBefore: 'before',
  caredDay: 'day',
  caredAfter: 'after',
};

/** 补投所有到点的心跳；返回投递条数 */
export function deliverDueHeartbeats(now = Date.now()): number {
  const state = useAppStore.getState();
  if (!state.bonds.length) return 0;

  let delivered = 0;
  for (const event of state.userEvents) {
    // 只有看过她手机的 TA 知道这条日程（D-113）
    const knowers = state.bonds.filter((b) => (event.knownBy ?? []).includes(b.id));
    if (!knowers.length) continue;
    const eventDate = parseDateKey(event.date);
    for (const stage of ['caredBefore', 'caredDay', 'caredAfter'] as Stage[]) {
      if (event[stage]) continue;
      if (now < stageDue(eventDate, stage) || now >= stageExpiry(eventDate, stage)) continue;
      for (const bond of knowers) {
        const text = heartbeatLine(
          STAGE_KEY[stage],
          event.title,
          bond.nickname,
          event.id.length + event.title.length + stage.length + bond.id.length
        );
        useAppStore.getState().appendBond(
          bond.id,
          [{ id: uid('m'), from: 'him', kind: 'text', text, at: now }],
          { unreadDelta: 1 }
        );
        delivered++;
      }
      useAppStore.getState().markEventStage(event.id, stage);
    }
  }
  return delivered;
}

/** 今天是否有用户日程（桌面角标等用得上） */
export function eventsOn(key: string): number {
  return useAppStore.getState().userEvents.filter((e) => e.date === key).length;
}

export { dateKey };

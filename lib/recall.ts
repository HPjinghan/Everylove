/**
 * 推送召回（D-126）：温度（lib/bond.ts warmthNow）到 0 之后，主动找她的钟停（lib/reach-out.ts），改由这里在
 * 第 7 / 14 / 30 天各发一条本地通知，之后不再发（红线 6：不纠缠）。
 * - 只发通知不落会话：她点开 App 那一刻（launch / foreground 任务）到点的那一条才落进会话、计未读——不刷屏、不堆未读。
 * - 预写预排：Expo Go 只有本地通知，温度降到「疏远」档时就按这次「到 0」的时刻把三条写好、排好；她一开口温度回到 30，
 *   记账那一刻取消全部（features/modes.ts creditBondedUtterance → cancelRecall）。
 * - AI 不可用 / 写不成 = 这条不发；三条都写不成也记一份空的，免得每次回前台重试轰炸。
 */

import { buildRecallUserLine } from '@/content/prompts';
import { RECALL_DAYS, warmthBand, warmthNow, warmthZeroAt } from '@/lib/bond';
import { bondedContext } from '@/lib/chat';
import { generateReply, stripStageDirections } from '@/lib/engine';
import { uid } from '@/lib/format';
import { cancelScheduled, hasNotificationPermission, scheduleArrivalNotification } from '@/lib/notifications';
import { outsideQuiet } from '@/lib/reach-out';
import type { Bond, Character, RecallState } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

const DAY_MS = 24 * 3600_000;
/** 给模型看 TA 最近几条记事本 / 帖 */
const RECENT = 3;
const inflight = new Set<string>();

/** 取消已排的召回通知并清状态；recall 传入时用它（store 里可能已经清掉） */
export async function cancelRecall(bondId: string, recall?: RecallState): Promise<void> {
  const cur = recall ?? useAppStore.getState().bonds.find((b) => b.id === bondId)?.recall;
  if (cur) for (const item of cur.items) await cancelScheduled(item.notifId);
  if (useAppStore.getState().bonds.find((b) => b.id === bondId)?.recall) useAppStore.getState().setRecall(bondId, undefined);
}

/** 到点该落进会话的那一条：只落最近到点的一条，之前到点没落的一起标掉 */
export function landableRecall(recall: RecallState, now: number): RecallState['items'][number] | undefined {
  const due = recall.items.filter((i) => i.due <= now && !i.landed && i.texts.length);
  return due[due.length - 1];
}

/** 启动 / 回前台：疏远的排好三条、久别的把到点那条落进会话；热络 / 平常的清掉旧排的 */
export async function deliverDueRecalls(now = Date.now()): Promise<number> {
  let landed = 0;
  for (const bond of useAppStore.getState().bonds) {
    const character = findCharacter(bond.characterId);
    if (!character || inflight.has(bond.id)) continue;
    inflight.add(bond.id);
    try {
      const band = warmthBand(warmthNow(bond, now));
      if (band === 'warm' || band === 'plain') {
        if (bond.recall) await cancelRecall(bond.id, bond.recall);
        continue;
      }
      const zeroAt = warmthZeroAt(bond, now);
      if (!bond.recall || Math.abs(bond.recall.zeroAt - zeroAt) > 60_000) {
        await cancelRecall(bond.id, bond.recall);
        await scheduleRecall(bond, character, zeroAt);
      }
      if (band !== 'cold') continue;
      const fresh = useAppStore.getState().bonds.find((b) => b.id === bond.id);
      const item = fresh?.recall ? landableRecall(fresh.recall, now) : undefined;
      if (!fresh?.recall || !item) continue;
      useAppStore.getState().appendBond(
        bond.id,
        item.texts.map((text, i) => ({ id: uid('m'), from: 'him' as const, kind: 'text' as const, text, at: now + i })),
        { unreadDelta: item.texts.length }
      );
      // 她回这条也算「回复 TA 主动」
      useAppStore.getState().markReachDelivered(bond.id, now);
      useAppStore.getState().setRecall(bond.id, {
        ...fresh.recall,
        items: fresh.recall.items.map((i) => (i.due <= now ? { ...i, landed: true } : i)),
      });
      landed++;
    } finally {
      inflight.delete(bond.id);
    }
  }
  return landed;
}

/** 按这次「到 0」的时刻写好三条并排通知；写不成的那条跳过 */
async function scheduleRecall(bond: Bond, character: Character, zeroAt: number): Promise<void> {
  const ok = await hasNotificationPermission().catch(() => false);
  const items: RecallState['items'] = [];
  for (const [i, days] of RECALL_DAYS.entries()) {
    const due = outsideQuiet(zeroAt + days * DAY_MS);
    const texts = await generateRecall(bond, character, i + 1, days);
    if (!texts) continue;
    const notifId = ok ? await scheduleArrivalNotification(bond.name, texts.join(' '), new Date(due), bond.id) : null;
    items.push({ due, texts, notifId: notifId ?? undefined });
  }
  useAppStore.getState().setRecall(bond.id, { zeroAt, items });
}

async function generateRecall(bond: Bond, character: Character, nth: number, daysAfterZero: number): Promise<string[] | null> {
  const posts = useAppStore.getState().posts;
  const her = [...bond.messages].reverse().find((m) => m.from === 'me');
  const zeroAt = warmthZeroAt(bond);
  const daysAway = Math.max(1, Math.round((zeroAt - (her?.at ?? bond.createdAt)) / DAY_MS) + daysAfterZero);
  const line = buildRecallUserLine({
    daysAway,
    nth,
    recentNotes: (bond.notes ?? []).slice(-RECENT).map((n) => n.text),
    recentPosts: posts.filter((p) => p.characterId === character.id).slice(-RECENT).map((p) => p.text),
  });
  const ctx = bondedContext(bond, line);
  if (!ctx) return null;
  try {
    const reply = await generateReply(ctx);
    const texts = stripStageDirections(reply.texts).filter(Boolean).slice(0, 1);
    return texts.length ? texts : null;
  } catch (e) {
    console.warn('[recall] 召回消息没写成，这条跳过：', e);
    return null;
  }
}

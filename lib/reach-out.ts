/**
 * TA 主动找她（D-114）：每段羁绊一只钟，到点 TA 自己先开口——机制照发帖调度器。
 * - 频率：按创造表单的「主动联系强度」定每天几条（高 2.5 / 中 1.2 / 低 0.4），乘 MBTI（E ×1.2 / I ×0.85）
 *   与羁绊等级（LV1 ×0.8 … LV5+ ×1.2），±35% 抖动；勿扰时段（默认 23:00–08:00，设置里可改 D-120）静默，落进去的顺延到结束后。
 * - 守门（红线 6：不纠缠、不刷屏）：她 3 小时内说过话不发；会话里已有 2 条未读不发；守门没过就往后挪 2–4 小时。
 * - 内容：亲密模式整套 prompt + 舞台提示（此刻 / 天气 / 她多久没说话 / TA 的记事本与帖子 / 上一条是谁说的，content/prompts/reach-out.ts），
 *   TA 从自己的日子说起，不问「在吗」。
 * - 送达：到点前先把下一条写好（pending）并排一条本地通知（App 没开着也能「来找你」）；启动 / 回前台时到点的落进会话、计未读。
 *   她在写好之后又说过话 → 那条作废、到点时按新上下文重写。AI 不可用 / 失败 = 这次不发，钟照排。
 */

import { buildReachOutUserLine } from '@/content/prompts';
import { applyMarkers } from '@/core/turn';
import { bondedContext, bondScope } from '@/lib/chat';
import { bondLevel, DISTANT_MIN_INTERVAL_MS, WARMTH_REACH_MULT, warmthBand, warmthNow, type WarmthBand } from '@/lib/bond';
import { generateReply, stripStageDirections } from '@/lib/engine';
import { uid } from '@/lib/format';
import { cancelScheduled, hasNotificationPermission, scheduleArrivalNotification } from '@/lib/notifications';
import type { Bond, Character, ChatMessage, EngineReply } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 每天几条（基准），按主动联系强度；没填按中 */
export const REACH_PER_DAY: Record<NonNullable<Character['initiative']>, number> = { high: 2.5, mid: 1.2, low: 0.4 };
/** MBTI 外向 / 内向系数 */
export const REACH_MBTI = { E: 1.2, I: 0.85 };
/** 羁绊等级系数：越熟越常来（LV1 起） */
export const REACH_LEVEL = [0.8, 0.9, 1, 1.1, 1.2, 1.2];
/** 静默时段默认值（不发）：23:00 起到次日 08:00；实际读 store.quietHours（D-120） */
export const QUIET_FROM = 23;
export const QUIET_TO = 8;
/** 她刚说过话（小时内）不主动；会话里已有几条未读就不再加 */
export const HER_RECENT_MS = 3 * 3600_000;
export const MAX_UNREAD = 2;
/** 守门没过：往后挪 2–4 小时 */
const DEFER_MIN_MS = 2 * 3600_000;
const DEFER_MAX_MS = 4 * 3600_000;
/** 给模型看 TA 最近几条记事本 / 帖 */
const RECENT = 3;

/** 下一条的间隔：24h / 每日条数（强度 × MBTI × 等级 × 温度），±35% 抖动；疏远时每 3 天最多一条（D-126） */
export function reachIntervalMs(
  c: Pick<Character, 'initiative' | 'mbti'>,
  affinity: number,
  rand = Math.random(),
  band: WarmthBand = 'plain'
): number {
  const perDay = REACH_PER_DAY[c.initiative ?? 'mid'];
  const mbti = c.mbti?.toUpperCase().startsWith('E') ? REACH_MBTI.E : c.mbti?.toUpperCase().startsWith('I') ? REACH_MBTI.I : 1;
  const level = REACH_LEVEL[Math.min(REACH_LEVEL.length, bondLevel(affinity)) - 1] ?? 1;
  const warmth = WARMTH_REACH_MULT[band] || 1;
  const base = (24 * 3600_000) / (perDay * mbti * level * warmth);
  const jittered = Math.round(base * (0.65 + rand * 0.7));
  return band === 'distant' ? Math.max(jittered, DISTANT_MIN_INTERVAL_MS) : jittered;
}

/** 勿扰时段内的时刻顺延到结束之后（+0～90 分钟）；hours 不传读设置 */
export function outsideQuiet(at: number, rand = Math.random(), hours?: { from: number; to: number }): number {
  const { from, to } = hours ?? useAppStore.getState().quietHours ?? { from: QUIET_FROM, to: QUIET_TO };
  if (from === to) return at;
  const d = new Date(at);
  const h = d.getHours();
  // 跨夜（23→8）：h<to 或 h>=from 在静默里；不跨夜（1→6）：from<=h<to 在静默里
  const overnight = from > to;
  const inQuiet = overnight ? h < to || h >= from : h >= from && h < to;
  if (!inQuiet) return at;
  if (overnight && h >= from) d.setDate(d.getDate() + 1);
  d.setHours(to, 0, 0, 0);
  return d.getTime() + Math.round(rand * 90 * 60_000);
}

export function nextReachAt(now: number, c: Pick<Character, 'initiative' | 'mbti'>, bond: Pick<Bond, 'affinity' | 'warmth' | 'warmthAt'>): number {
  return outsideQuiet(now + reachIntervalMs(c, bond.affinity, Math.random(), warmthBand(warmthNow(bond, now))));
}

function lastFrom(msgs: ChatMessage[], from: ChatMessage['from']): ChatMessage | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].from === from) return msgs[i];
  return undefined;
}

/** 此刻能不能发：她刚说过话 / 未读堆着 → 不发（红线 6） */
export function reachAllowed(bond: Pick<Bond, 'messages' | 'unread'>, now = Date.now()): boolean {
  if (bond.unread >= MAX_UNREAD) return false;
  const her = lastFrom(bond.messages, 'me');
  if (her && now - her.at < HER_RECENT_MS) return false;
  return true;
}

const inflight = new Set<string>();

/** 补投所有到点的主动消息，并给每段羁绊备好下一条；返回发出的条数 */
export async function deliverDueReachOuts(now = Date.now()): Promise<number> {
  let delivered = 0;
  for (const bond of useAppStore.getState().bonds) {
    const character = findCharacter(bond.characterId);
    if (!character || inflight.has(bond.id)) continue;
    inflight.add(bond.id);
    try {
      // 温度到 0（D-126）：主动停、写好的作废，钟留在原地；召回由 lib/recall.ts 接手，她回来后按新上下文重排
      if (warmthBand(warmthNow(bond, now)) === 'cold') {
        await clearPending(bond.id);
        continue;
      }
      const due = useAppStore.getState().reachSchedule[bond.id];
      if (!due) {
        // 首次：排钟（不立刻发——缔结时 TA 已经打过招呼）
        useAppStore.getState().setReachDue(bond.id, nextReachAt(now, character, bond));
        continue;
      }
      if (now < due) {
        await preparePending(bond, character, due);
        continue;
      }
      const fresh = useAppStore.getState().bonds.find((b) => b.id === bond.id)!;
      if (!reachAllowed(fresh, now)) {
        // 守门没过：往后挪；写好的那条作废
        await clearPending(bond.id);
        useAppStore.getState().setReachDue(bond.id, outsideQuiet(now + DEFER_MIN_MS + Math.random() * (DEFER_MAX_MS - DEFER_MIN_MS)));
        continue;
      }
      const reply = await replyForDelivery(fresh, character, now);
      // 不管发没发成，先排下一次的钟：失败不会每次回前台都重试轰炸
      useAppStore.getState().setReachDue(bond.id, nextReachAt(now, character, fresh));
      await clearPending(bond.id);
      if (reply) {
        useAppStore.getState().appendBond(
          bond.id,
          reply.texts.map((text, i) => ({ id: uid('m'), from: 'him' as const, kind: 'text' as const, text, at: now + i, reach: true })),
          { unreadDelta: reply.texts.length }
        );
        // 她 24h 内回这条 = 「回复 TA 主动」来源（D-126，北极星）
        useAppStore.getState().markReachDelivered(bond.id, now);
        // TA 主动那条也可能带一份外卖 / 一个红包（D-128）：按暗号落状态、计未读
        if (reply.flags) await applyMarkers(bondScope(bond.id), reply, { unread: true });
        delivered++;
      }
    } finally {
      inflight.delete(bond.id);
    }
  }
  // 发完再为每段备好下一条（含刚发过的）
  for (const bond of useAppStore.getState().bonds) {
    const character = findCharacter(bond.characterId);
    const due = useAppStore.getState().reachSchedule[bond.id];
    if (character && due && now < due && !inflight.has(bond.id) && warmthBand(warmthNow(bond, now)) !== 'cold') {
      inflight.add(bond.id);
      try {
        await preparePending(bond, character, due);
      } finally {
        inflight.delete(bond.id);
      }
    }
  }
  return delivered;
}

/** 到点要发的那条：写好的还新鲜就用它（连暗号一起），否则现写 */
async function replyForDelivery(bond: Bond, character: Character, now: number): Promise<EngineReply | null> {
  const pending = useAppStore.getState().reachPending[bond.id];
  const her = lastFrom(bond.messages, 'me');
  if (pending && (!her || her.at < pending.generatedAt)) return { texts: pending.texts, flags: pending.flags, values: pending.values };
  return generateReachOut(bond, character, new Date(now));
}

/** 到点前把下一条写好 + 排本地通知；已有且还新鲜就不重写 */
async function preparePending(bond: Bond, character: Character, due: number): Promise<void> {
  const pending = useAppStore.getState().reachPending[bond.id];
  const her = lastFrom(bond.messages, 'me');
  if (pending && pending.due === due && (!her || her.at < pending.generatedAt)) return;
  await clearPending(bond.id);
  const reply = await generateReachOut(bond, character, new Date(due));
  if (!reply) return;
  // 权限在缔结那一刻问过（D-120）；这里只看有没有，不再弹
  const ok = await hasNotificationPermission().catch(() => false);
  const notifId = ok ? await scheduleArrivalNotification(bond.name, reply.texts.join(' '), new Date(due), bond.id) : null;
  useAppStore
    .getState()
    .setReachPending(bond.id, { texts: reply.texts, flags: reply.flags, values: reply.values, due, generatedAt: Date.now(), notifId: notifId ?? undefined });
}

async function clearPending(bondId: string): Promise<void> {
  const pending = useAppStore.getState().reachPending[bondId];
  if (!pending) return;
  await cancelScheduled(pending.notifId);
  useAppStore.getState().setReachPending(bondId, undefined);
}

/** 亲密模式整套 prompt + 舞台提示 → TA 主动的一两句（连暗号）；不可用 / 失败返回 null */
async function generateReachOut(bond: Bond, character: Character, at: Date): Promise<EngineReply | null> {
  const her = lastFrom(bond.messages, 'me');
  const lastMsg = [...bond.messages].reverse().find((m) => m.from !== 'system' && m.text);
  const line = buildReachOutUserLine({
    now: at,
    weather: weatherLine(at),
    hoursSinceHer: her ? (at.getTime() - her.at) / 3600_000 : null,
    // 最近几条主动消息（D-153）：话题与开头别重样
    recentOpeners: bond.messages.filter((m) => m.from === 'him' && m.reach && m.text).slice(-RECENT).map((m) => m.text),
    last: lastMsg ? { from: lastMsg.from === 'me' ? 'me' : 'him', text: lastMsg.text } : undefined,
  });
  const ctx = bondedContext(bond, line);
  if (!ctx) return null;
  try {
    const reply = await generateReply(ctx);
    const texts = stripStageDirections(reply.texts).filter(Boolean);
    return texts.length ? { ...reply, texts } : null;
  } catch (e) {
    console.warn('[reach-out] 主动消息没写成，本周期跳过：', e);
    return null;
  }
}

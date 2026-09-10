/**
 * TA 自己的作息（D-119）：TA 的日历里有 TA 自己的安排（lib/his-notes 的兄弟）。
 * - 触发：启动 / 回前台 / 打开 TA 的手机时，今天起还剩不到 HIS_SCHEDULE_MIN 条就补写接下来一周（模型 JSON，content/prompts/his-schedule.ts）
 * - 存在 Bond.hisEvents（只留今天起 14 天内的，过去的丢掉）；进 prompt 的【你的日程】；查手机的日历里和她的约定一起显示
 * - AI 不可用 / 失败 = 这次不写；每段羁绊每 6 小时最多试一次（别每次回前台都撞模型）
 */

import { dateKey } from '@/content/calendar';
import { buildHisScheduleSystem, buildHisScheduleUserPrompt, HIS_SCHEDULE_MIN, parseHisScheduleJSON } from '@/content/prompts';
import { completeText } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { HisEvent } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

const RETRY_MS = 6 * 3600_000;
const KEEP_DAYS = 14;
const lastTry = new Map<string, number>();
const inflight = new Set<string>();

/** 今天起的安排（排序） */
export function upcomingHisEvents(events: HisEvent[] | undefined, today = dateKey(new Date())): HisEvent[] {
  return (events ?? []).filter((e) => e.date >= today).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
}

/** 补写所有需要的 TA 日程；返回写了几段 */
export async function deliverDueHisSchedules(now = Date.now()): Promise<number> {
  let n = 0;
  for (const bond of useAppStore.getState().bonds) {
    if (await ensureHisSchedule(bond.id, now)) n++;
  }
  return n;
}

/** 这段羁绊的 TA 日程不够就补；返回是否写了 */
export async function ensureHisSchedule(bondId: string, now = Date.now()): Promise<boolean> {
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  const character = bond && findCharacter(bond.characterId);
  if (!bond || !character) return false;
  const today = dateKey(new Date(now));
  if (upcomingHisEvents(bond.hisEvents, today).length >= HIS_SCHEDULE_MIN) return false;
  if (inflight.has(bondId) || now - (lastTry.get(bondId) ?? 0) < RETRY_MS) return false;
  inflight.add(bondId);
  lastTry.set(bondId, now);
  try {
    const raw = await completeText(
      buildHisScheduleSystem(character, bond),
      buildHisScheduleUserPrompt({
        today,
        recentNotes: (bond.notes ?? []).slice(-3).map((x) => x.text),
        existing: upcomingHisEvents(bond.hisEvents, today),
      }),
      500
    );
    const parsed = parseHisScheduleJSON(raw);
    if (!parsed?.length) return false;
    const limit = dateKey(new Date(now + KEEP_DAYS * 86400_000));
    const fresh: HisEvent[] = parsed
      .filter((e) => e.date >= today && e.date <= limit)
      .map((e) => ({ id: uid('he'), ...e }));
    if (!fresh.length) return false;
    useAppStore.getState().setHisEvents(bondId, [...upcomingHisEvents(bond.hisEvents, today), ...fresh]);
    return true;
  } catch (e) {
    console.warn('[his-schedule] TA 的日程没写成，稍后再试：', e);
    return false;
  } finally {
    inflight.delete(bondId);
  }
}

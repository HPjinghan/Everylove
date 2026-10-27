/**
 * 外出地点的「此刻」（D-254）：营业不营业、哪个时段、这会儿谁在。
 * - 谁在：按「人 × 这一个小时」稳定地掷一次——同一个小时里看几次都一样，到了下个小时重新散开。
 *   认识的 TA（久别的不出门；TA 日程里这个钟点有事的不在；有约的另算）和还不认识的人都可能在；每个地点不超过它的容量。
 * - 约会不在这里算：约定窗口里那位 TA 在约好的地方等她（lib/outing.ts）。
 * 地点卡上只说「这里有几个人」，进去才知道是谁。
 */

import { seedCharactersFor } from '@/content/characters';
import { PLACES, type DayPart, type Place } from '@/content/places';
import { planIsOpen } from '@/lib/appointments';
import { backgroundAwake } from '@/lib/bond';
import { useAppStore } from '@/store/app-store';

/** 认识的 TA 这个钟点出门的概率；还不认识的人；陌生人每小时最多几位在外面 */
const BONDED_OUT = 0.5;
const STRANGER_OUT = 0.4;
const STRANGERS_MAX = 4;

export interface Presence {
  characterId: string;
  /** 她认识（缔结过的 TA） */
  known: boolean;
}

export function dayPartOf(d: Date): DayPart {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** 开着没有（关门时间过 24 = 次日凌晨） */
export function isOpen(place: Place, d: Date): boolean {
  if (!place.hours) return true;
  const h = d.getHours() + d.getMinutes() / 60;
  const [open, close] = place.hours;
  return (h >= open && h < close) || (close > 24 && h < close - 24);
}

/** 这会儿的场景设定：开着按时段，关了用 closedScene */
export function sceneFor(place: Place, d: Date): string {
  if (!isOpen(place, d)) return place.closedScene ?? place.scene;
  return place.scenes?.[dayPartOf(d)] ?? place.scene;
}

function hourKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

/** 0–1 的稳定哈希（FNV-1a） */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** 这个钟点 TA 自己的日程里有事（有钟点、在前后一小时内）就不出门 */
function busyNow(events: { date: string; time?: string }[] | undefined, d: Date): boolean {
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = d.getHours() * 60 + d.getMinutes();
  return (events ?? []).some((e) => {
    if (e.date !== today || !e.time) return false;
    const [hh, mm] = e.time.split(':').map(Number);
    return Math.abs(hh * 60 + mm - now) <= 60;
  });
}

/** 这会儿每个地点有谁（不含约会）；地点 id → 在场的人（按稳定次序，不超过容量） */
export function presenceAt(d: Date = new Date()): Record<string, Presence[]> {
  const state = useAppStore.getState();
  const key = hourKey(d);
  const open = PLACES.filter((p) => isOpen(p, d));
  const out: Record<string, (Presence & { rank: number })[]> = {};
  if (!open.length) return {};
  const put = (characterId: string, known: boolean, salt: string) => {
    const place = open[Math.floor(unit(`${characterId}:${key}:${salt}:where`) * open.length)];
    (out[place.id] ??= []).push({ characterId, known, rank: unit(`${characterId}:${key}:rank`) });
  };

  const now = d.getTime();
  const planned = new Set(state.outingPlans.filter((p) => planIsOpen(p, now)).map((p) => p.characterId));
  for (const b of state.bonds) {
    if (planned.has(b.characterId) || !backgroundAwake(b, now) || busyNow(b.hisEvents, d)) continue;
    if (unit(`${b.characterId}:${key}:out`) < BONDED_OUT) put(b.characterId, true, 'bond');
  }

  const bondedIds = new Set(state.bonds.map((b) => b.characterId));
  const strangers = seedCharactersFor(state.language)
    .filter((c) => !c.teaser && !bondedIds.has(c.id))
    .filter((c) => unit(`${c.id}:${key}:out`) < STRANGER_OUT)
    .slice(0, STRANGERS_MAX);
  for (const c of strangers) put(c.id, false, 'stranger');

  const result: Record<string, Presence[]> = {};
  for (const place of open) {
    const here = (out[place.id] ?? []).sort((a, b) => a.rank - b.rank).slice(0, place.capacity);
    if (here.length) result[place.id] = here.map(({ characterId, known }) => ({ characterId, known }));
  }
  return result;
}

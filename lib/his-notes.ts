/**
 * TA 的记事本调度器（D-085 / D-098）：TA 按 MBTI 的频率往自己的记事本里写自己的日子（她查手机时看得到）。
 * - 频率：I 比 E 更爱写本子（与发帖相反），NF 最多、ST 最少；无 MBTI 默认 1 条/天；间隔 ±35% 抖动
 * - 与发帖同机制：启动 / 回前台 / 打开 TA 的手机时补写；一条都没有时立刻写第一条（本子不空着）；错过再久只补 1 条
 * - 内容（D-098）：系统 prompt 走记事本专用装配（content/prompts/his-notes.ts）；用户消息带今天的天气、本子里最近几条（生活接得上）
 *   和「这一条写不写她」——七成只写自己的日子（HIS_NOTE_ABOUT_HER）。AI 不可用 / 失败 = 这次不写
 */

import { buildHisNoteSystem, buildHisNoteUserPrompt, HIS_NOTE_ABOUT_HER, HIS_NOTE_USER } from '@/content/prompts';
import { bondedContext } from '@/lib/chat';
import { completeText, splitBubbles, stripStageDirections } from '@/lib/engine';
import type { Bond, Character } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { findCharacter, useAppStore } from '@/store/app-store';

export const MBTI_NOTES_PER_DAY: Record<string, number> = {
  INFP: 2.5, INFJ: 2, ISFP: 2, INTP: 1.5,
  ISFJ: 1.5, INTJ: 1.2, ISTP: 0.8, ISTJ: 0.8,
  ENFP: 1.5, ENFJ: 1.2, ESFP: 1, ENTP: 1,
  ESFJ: 1, ENTJ: 0.7, ESTP: 0.6, ESTJ: 0.5,
};
export const DEFAULT_NOTES_PER_DAY = 1;
/** 记事本最多留多少条 */
export const HIS_NOTES_MAX = 30;
/** 写新的一条时给模型看最近几条（接上自己的生活，不重复） */
export const HIS_NOTE_RECENT = 6;

export function noteIntervalMs(c: Character): number {
  const perDay = (c.mbti && MBTI_NOTES_PER_DAY[c.mbti.toUpperCase()]) || DEFAULT_NOTES_PER_DAY;
  const base = (24 * 3600_000) / perDay;
  return Math.round(base * (0.65 + Math.random() * 0.7));
}

const inflight = new Set<string>();

/** 补写所有到点的记事本；返回写了几条 */
export async function deliverDueHisNotes(now = Date.now()): Promise<number> {
  const state = useAppStore.getState();
  let written = 0;
  for (const bond of state.bonds) {
    const character = findCharacter(bond.characterId);
    if (!character) continue;
    const due = state.noteSchedule[character.id];
    const empty = !(bond.notes?.length);
    if (due && now < due && !empty) continue;
    if (inflight.has(bond.id)) continue;
    // 先排下一次的钟：失败也不会每次回前台都重试轰炸
    useAppStore.getState().setNoteDue(character.id, now + noteIntervalMs(character));
    inflight.add(bond.id);
    try {
      const text = await generateNote(character, bond);
      if (text) {
        useAppStore.getState().addHisNote(bond.id, text);
        written++;
      }
    } finally {
      inflight.delete(bond.id);
    }
  }
  return written;
}

async function generateNote(character: Character, bond: Bond): Promise<string | null> {
  const ctx = bondedContext(bond, HIS_NOTE_USER);
  if (!ctx) return null;
  const now = new Date();
  const user = buildHisNoteUserPrompt({
    now,
    weather: weatherLine(now),
    recent: (bond.notes ?? []).slice(-HIS_NOTE_RECENT),
    aboutHer: Math.random() < HIS_NOTE_ABOUT_HER,
  });
  try {
    const raw = await completeText(buildHisNoteSystem(ctx, now), user, 240);
    const line = stripStageDirections(splitBubbles(raw, 1, character.name))[0];
    return line ? line.slice(0, 200) : null;
  } catch (e) {
    console.warn('[his-notes] 记事本没写成，本周期跳过：', e);
    return null;
  }
}

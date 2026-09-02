/**
 * 发帖调度器（D-055）：让 TA 的 X 时间线活着。
 * - 频率遵循 MBTI（MBTI_POSTS_PER_DAY 映射：E 比 I 话多、P 比 J 随性；无 MBTI 默认 1 条/天），间隔 ±35% 抖动
 * - 与心跳同机制：App 启动 / 回前台补投（deliverDuePosts）；错过再久也只补 1 条（时间线不炸屏）
 * - 内容由当前引擎生成（人设 + 追法 + 时段 + 天气 + 羁绊记忆；prompt 见 content/prompts.ts §1-F），
 *   AI 不可用 / 失败 = 这一条不发（记 warn，下个周期再试；D-069 起没有脚本回落）
 * - 只有缔结的 TA 发帖（X 只看羁绊层的时间线，D-027）
 */

import { buildCharacterPostSystem, buildCharacterPostUserPrompt } from '@/content/prompts';
import { completeText, splitBubbles, stripStageDirections } from '@/lib/engine';
import type { Character } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/**
 * MBTI → 每天几条帖（试装数值，正式版另调）。
 * 直觉：E（外向）表达欲高于 I；NF（理想主义）爱抒发、SP（体验派）爱直播生活；
 * ISTJ/ISTP 这类沉默型两天才冒一条。
 */
export const MBTI_POSTS_PER_DAY: Record<string, number> = {
  ENFP: 3, ESFP: 3, ENTP: 2.5, ESTP: 2.5,
  ENFJ: 2, ESFJ: 2, ENTJ: 1.5, ESTJ: 1.2,
  INFP: 1.5, ISFP: 1.2, INFJ: 1, INTP: 0.8,
  ISFJ: 0.8, INTJ: 0.6, ISTP: 0.5, ISTJ: 0.5,
};
export const DEFAULT_POSTS_PER_DAY = 1;

/** 下一条帖子的间隔：24h / 每日条数，±35% 抖动（别像闹钟一样准点发帖） */
export function postIntervalMs(c: Character): number {
  const perDay =
    (c.mbti && MBTI_POSTS_PER_DAY[c.mbti.toUpperCase()]) || DEFAULT_POSTS_PER_DAY;
  const base = (24 * 3600_000) / perDay;
  const jitter = 0.65 + Math.random() * 0.7;
  return Math.round(base * jitter);
}

/** 补投所有到点的帖子；返回发出的条数 */
export async function deliverDuePosts(now = Date.now()): Promise<number> {
  const state = useAppStore.getState();
  let delivered = 0;
  for (const bond of state.bonds) {
    const character = findCharacter(bond.characterId);
    if (!character) continue;
    const due = state.postSchedule[character.id];
    if (!due) {
      // 首次：排第一条的钟，不立刻发（缔结时已有铺设帖，D-020）
      useAppStore.getState().setPostDue(character.id, now + postIntervalMs(character));
      continue;
    }
    if (now < due) continue;
    // 先排下一次的钟：生成失败也不会在每次回前台时反复重试轰炸
    useAppStore.getState().setPostDue(character.id, now + postIntervalMs(character));
    const text = await generatePostText(character, bond.id);
    if (text) {
      useAppStore.getState().addCharacterPost(character.id, bond.id, text);
      delivered++;
    }
  }
  return delivered;
}

/** 引擎生成一条帖子文本；不可用/失败返回 null（这次不发） */
async function generatePostText(character: Character, bondId: string): Promise<string | null> {
  const { bonds } = useAppStore.getState();
  const bond = bonds.find((b) => b.id === bondId);
  try {
    const raw = await completeText(
      buildCharacterPostSystem(character, bond),
      buildCharacterPostUserPrompt(),
      200
    );
    const line = stripStageDirections(splitBubbles(raw, 1, character.name))[0];
    return line ? line.slice(0, 140) : null;
  } catch (e) {
    console.warn('[posts] 帖子生成失败，本周期跳过：', e);
    return null;
  }
}

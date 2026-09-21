/**
 * 好奇判分（D-126 / D-157）：换联系方式前，她每开口一句让 TA 多好奇几分由模型判 0–30——回复末尾的暗号 [好奇 n]；满 100 约 4–8 句。
 * 一个玩法一个文件：prompt 分段（初识 / 广场陌生人）+ 带数值的回复暗号 + 缺暗号时的保底（按性子的区间下限，不让进度卡死）。
 * 好奇满 100 的 offer 仍是产品触发器（features/adoption.ts，在这之后注册、在这之后跑）。
 */

import { HEART_MARK, HEART_PATTERN, heartJudgeLines } from '@/content/prompts';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { turnHooks } from '@/core/turn';
import { clampHeartGain, HEART_FALLBACK, heartPaceOf } from '@/lib/bond';
import type { EngineContext } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 还在追的阶段：交友试聊 / 广场陌生人（外出里有羁绊的不算） */
const courting = (ctx: EngineContext) => ctx.mode === 'square' || (ctx.mode === 'outing' && ctx.outing?.kind === 'stranger');

promptSections.register({
  name: 'heart-judge',
  modes: ['square', 'outing'],
  order: ORDER.heart,
  lines: (ctx) => (courting(ctx) ? heartJudgeLines(ctx.character) : []),
});

replyMarkers.register({
  key: 'heart',
  mark: HEART_MARK,
  pattern: HEART_PATTERN,
  apply({ ctx, value }) {
    if (!courting(ctx)) return;
    useAppStore.getState().appendSquare(ctx.character.id, [], { heartDelta: clampHeartGain(Number(value)) });
  },
});

/** 模型没写暗号：按性子的「大多数时候」区间下限给分（暗面路由的回合不给） */
turnHooks.after.on(({ ctx, reply, darkSide }) => {
  if (!courting(ctx) || darkSide || reply.flags?.heart) return;
  useAppStore.getState().appendSquare(ctx.character.id, [], { heartDelta: HEART_FALLBACK[heartPaceOf(ctx.character)] });
});

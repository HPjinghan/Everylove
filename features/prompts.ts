/**
 * 系统 prompt 的基础分段（D-086）：把 content/prompts.ts 里的文本块按模式与顺序装进底座。
 * 文本本身全在 content/prompts.ts（改「TA 怎么说话」看那里）；这里只声明「哪一段、进哪些模式、排第几」。
 * 玩法自己的规则（查手机 / 红包）由各自的 features/*.tsx 注册，不在这里。
 * 顺序与 D-086 之前的手工拼接逐字一致（tests/prompts.test.ts 快照锁定）。
 */

import { scriptFor } from '@/content/characters';
import {
  birthdayLine,
  BONDED_LOVE_RULES,
  BONDED_TIME_RULES,
  boundariesBlock,
  CHAT_HARD_RULES_OF,
  characterProfileBlock,
  initiativeLine,
  introLine,
  lengthFor,
  memoryBlockFor,
  nowLine,
  OUTING_MANNER,
  OUTING_STRANGER_MANNER,
  outingMomentLine,
  outputFormatFor,
  pursuitLine,
  secretsBlock,
  sharedMemoryBlock,
  SQUARE_MANNER,
  squareSituationLines,
  stageLine,
  userProfileBlock,
  voiceBlock,
} from '@/content/prompts';
import { ORDER, promptSections, type PromptMode } from '@/core/prompt';
import { levelInfo } from '@/lib/bond';
import type { EngineContext } from '@/lib/types';

/** 亲密背景的三个用法：亲密聊天 / 通话 / TA 写记事本 */
export const BONDED_FAMILY: readonly PromptMode[] = ['bonded', 'call', 'note'];
/** 带关系背景的模式（外出的赴约 / 偶遇也带；陌生人偶遇在段内自行跳过） */
export const RELATION_MODES: readonly PromptMode[] = ['bonded', 'call', 'note', 'outing'];

const isStranger = (ctx: EngineContext) => ctx.mode === 'outing' && ctx.outing?.kind === 'stranger';

/* ── 开头：你是谁 ── */
promptSections.register({ name: 'intro', modes: 'all', order: ORDER.intro, lines: (ctx, env) => [introLine(ctx, env.now)] });
promptSections.register({ name: 'persona', modes: 'all', order: ORDER.persona, lines: (ctx) => [`【你是谁】${scriptFor(ctx.character).persona}`] });
promptSections.register({ name: 'pursuit', modes: 'all', order: ORDER.pursuit, lines: (ctx) => [`【你的追法】${pursuitLine(ctx.character)}`] });
promptSections.register({ name: 'profile', modes: 'all', order: ORDER.profile, lines: (ctx) => characterProfileBlock(ctx.character) });
promptSections.register({ name: 'voice', modes: 'all', order: ORDER.voice, lines: (ctx) => voiceBlock(ctx) });

/* ── 时间与此刻 ── */
promptSections.register({ name: 'now', modes: RELATION_MODES, order: ORDER.now, lines: (_ctx, env) => [nowLine(env.now)] });
promptSections.register({ name: 'time-rules', modes: BONDED_FAMILY, order: ORDER.timeRules, lines: () => BONDED_TIME_RULES });
promptSections.register({ name: 'birthday', modes: BONDED_FAMILY, order: ORDER.birthday, lines: (ctx) => birthdayLine(ctx) });
promptSections.register({ name: 'outing-moment', modes: ['outing'], order: ORDER.moment, lines: (ctx) => [outingMomentLine(ctx)] });

/* ── 她是谁（初识只给资料卡；陌生人偶遇只给边界，D-035/D-040） ── */
promptSections.register({
  name: 'user',
  modes: 'all',
  order: ORDER.user,
  lines: (ctx) => {
    if (ctx.mode === 'square') return userProfileBlock(ctx.me, 'square');
    if (ctx.mode === 'outing') return isStranger(ctx) ? boundariesBlock(ctx.me) : userProfileBlock(ctx.me, 'outing');
    return userProfileBlock(ctx.me, 'bonded');
  },
});
promptSections.register({ name: 'shared-memory', modes: 'all', order: ORDER.sharedMemory, lines: (ctx) => sharedMemoryBlock(ctx.character) });
promptSections.register({ name: 'square-situation', modes: ['square'], order: ORDER.situation, lines: (ctx) => squareSituationLines(ctx) });

/* ── 记忆与秘密（只在羁绊层，商业承重墙；陌生人偶遇没有） ── */
promptSections.register({ name: 'memory', modes: RELATION_MODES, order: ORDER.memory, lines: (ctx) => (isStranger(ctx) ? [] : memoryBlockFor(ctx.bond?.memory)) });
promptSections.register({
  name: 'secrets',
  modes: RELATION_MODES,
  order: ORDER.secrets,
  lines: (ctx) => (isStranger(ctx) ? [] : secretsBlock(ctx.character, levelInfo(ctx.bond?.affinity ?? 0).level)),
});

/* ── 分寸与追法的落地 ── */
promptSections.register({ name: 'love-rules', modes: BONDED_FAMILY, order: ORDER.manner, lines: () => BONDED_LOVE_RULES });
promptSections.register({ name: 'square-manner', modes: ['square'], order: ORDER.manner, lines: () => SQUARE_MANNER });
promptSections.register({ name: 'outing-manner', modes: ['outing'], order: ORDER.manner, lines: () => OUTING_MANNER });
promptSections.register({ name: 'stranger-manner', modes: ['outing'], order: ORDER.strangerManner, lines: (ctx) => (isStranger(ctx) ? OUTING_STRANGER_MANNER : []) });
promptSections.register({
  name: 'initiative',
  modes: RELATION_MODES,
  order: { default: ORDER.initiative, outing: ORDER.outingInitiative },
  lines: (ctx) => (isStranger(ctx) ? [] : initiativeLine(ctx.character)),
});
promptSections.register({
  name: 'stage',
  modes: RELATION_MODES,
  order: { default: ORDER.stage, outing: ORDER.outingStage },
  lines: (ctx) => (isStranger(ctx) ? [] : [stageLine(ctx)]),
});

/* ── 红线与输出格式（红线段对应 CLAUDE.md §9，勿删） ── */
promptSections.register({ name: 'hard-rules', modes: 'all', order: ORDER.hardRules, lines: () => CHAT_HARD_RULES_OF() });
promptSections.register({ name: 'output', modes: 'all', order: ORDER.output, lines: (_ctx, env) => outputFormatFor(env.mode) });
promptSections.register({ name: 'length', modes: 'all', order: ORDER.length, lines: (_ctx, env) => lengthFor(env.mode) });

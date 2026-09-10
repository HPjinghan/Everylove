/**
 * 系统 prompt 的分段表（D-086/D-087）：把 content/prompts/ 各文件里的文本块按模式与顺序装进底座。
 * 文本本身全在 content/prompts/（一般对话 chat.ts、外出 outing.ts、通话 call.ts、记事本 his-notes.ts、通用 shared.ts）；
 * 这里只声明「哪一段、进哪些模式、排第几」。一段只属于一个用途——一般对话与外出各自一份，不在段里按模式切换。
 * 玩法自己的规则（查手机 / 红包）由各自的 features/*.tsx 注册，不在这里。
 * 记事本（note）只共用羁绊层的人设 / 台词样本 / 记忆 / 秘密，不带她的资料卡与聊天规则（D-098）。
 * 顺序与 D-086 之前的手工拼接逐字一致（tests/prompts.test.ts 快照锁定）。
 */

import { scriptFor } from '@/content/characters';
import {
  birthdayLine,
  BONDED_LENGTH,
  BONDED_LOVE_RULES,
  BONDED_TIME_RULES,
  bondedIntroLine,
  bondedVoiceBlock,
  boundariesBlock,
  CALL_MANNER,
  CHAT_HARD_RULES_OF,
  CHAT_OUTPUT_FORMAT,
  characterProfileBlock,
  circleBlock,
  encountersBlock,
  hisNoteLifeLines,
  hisScheduleBlock,
  HIS_NOTE_MANNER,
  initiativeLine,
  memoryBlockFor,
  noteIntroLine,
  nowLine,
  OUTING_MANNER,
  OUTING_OUTPUT_FORMAT,
  OUTING_STRANGER_MANNER,
  outingIntroLine,
  outingMomentLine,
  outingVoiceBlock,
  pursuitLine,
  secretsBlock,
  sharedMemoryBlock,
  SQUARE_LENGTH,
  SQUARE_MANNER,
  squareIntroLine,
  squareSituationLines,
  squareVoiceBlock,
  stageLine,
  userProfileBlock,
  worldBlock,
} from '@/content/prompts';
import { dateKey } from '@/content/calendar';
import { ORDER, promptSections, type PromptMode } from '@/core/prompt';
import { levelInfo } from '@/lib/bond';
import type { EngineContext } from '@/lib/types';

/** 羁绊层的三个用法：亲密聊天 / 通话 / TA 写记事本——共用人设、台词样本、记忆、秘密（chat.ts 的亲密段） */
export const BONDED_FAMILY: readonly PromptMode[] = ['bonded', 'call', 'note'];
/** 其中「和她说话」的两个：亲密聊天 / 通话——她的资料卡、追法落地、怎么爱她、手机与红包规则只进这两个；记事本不带（D-098） */
export const BONDED_CHAT: readonly PromptMode[] = ['bonded', 'call'];
/** 四种对话（不含记事本）：追法只在对话里 */
const TALK: readonly PromptMode[] = ['square', 'bonded', 'call', 'outing'];
const SQUARE: readonly PromptMode[] = ['square'];
const OUTING: readonly PromptMode[] = ['outing'];
const NOTE: readonly PromptMode[] = ['note'];

const isStranger = (ctx: EngineContext) => ctx.outing?.kind === 'stranger';

/* ── 开头：你是谁（第一行与台词样本按模式各一份） ── */
promptSections.register({ name: 'intro-square', modes: SQUARE, order: ORDER.intro, lines: (ctx) => [squareIntroLine(ctx)] });
promptSections.register({ name: 'intro-bonded', modes: BONDED_CHAT, order: ORDER.intro, lines: (ctx, env) => [bondedIntroLine(ctx, env.now)] });
promptSections.register({ name: 'intro-note', modes: NOTE, order: ORDER.intro, lines: (ctx, env) => [noteIntroLine(ctx, env.now)] });
promptSections.register({ name: 'intro-outing', modes: OUTING, order: ORDER.intro, lines: (ctx) => [outingIntroLine(ctx)] });
promptSections.register({ name: 'persona', modes: 'all', order: ORDER.persona, lines: (ctx) => [`【你是谁】${scriptFor(ctx.character).persona}`] });
promptSections.register({ name: 'pursuit', modes: TALK, order: ORDER.pursuit, lines: (ctx) => [`【你的追法】${pursuitLine(ctx.character)}`] });
promptSections.register({ name: 'profile', modes: 'all', order: ORDER.profile, lines: (ctx) => characterProfileBlock(ctx.character) });
// 世界书（D-110）：TA 所在的世界，现实世界不出段；身边的人只在羁绊层（陌生人偶遇没有）
promptSections.register({ name: 'world', modes: 'all', order: ORDER.world, lines: (ctx) => worldBlock(ctx.character) });
promptSections.register({ name: 'circle', modes: BONDED_FAMILY, order: ORDER.circle, lines: (ctx) => circleBlock(ctx.bond?.circle) });
promptSections.register({ name: 'circle-outing', modes: OUTING, order: ORDER.circle, lines: (ctx) => (isStranger(ctx) ? [] : circleBlock(ctx.bond?.circle)) });
// TA 自己的作息（D-119）：羁绊层都知道自己接下来要干嘛
promptSections.register({ name: 'his-schedule', modes: BONDED_FAMILY, order: ORDER.circle, lines: (ctx, env) => hisScheduleBlock(ctx.bond?.hisEvents, dateKey(env.now)) });
promptSections.register({ name: 'his-schedule-outing', modes: OUTING, order: ORDER.circle, lines: (ctx, env) => (isStranger(ctx) ? [] : hisScheduleBlock(ctx.bond?.hisEvents, dateKey(env.now))) });
promptSections.register({ name: 'voice-square', modes: SQUARE, order: ORDER.voice, lines: (ctx) => squareVoiceBlock(ctx) });
promptSections.register({ name: 'voice-bonded', modes: BONDED_FAMILY, order: ORDER.voice, lines: (ctx) => bondedVoiceBlock(ctx) });
promptSections.register({ name: 'voice-outing', modes: OUTING, order: ORDER.voice, lines: (ctx) => outingVoiceBlock(ctx) });

/* ── 时间与此刻 ── */
promptSections.register({ name: 'now', modes: [...BONDED_FAMILY, 'outing'], order: ORDER.now, lines: (_ctx, env) => [nowLine(env.now)] });
promptSections.register({ name: 'time-rules', modes: BONDED_CHAT, order: ORDER.timeRules, lines: () => BONDED_TIME_RULES });
promptSections.register({ name: 'birthday', modes: BONDED_CHAT, order: ORDER.birthday, lines: (ctx) => birthdayLine(ctx) });
promptSections.register({ name: 'outing-moment', modes: OUTING, order: ORDER.moment, lines: (ctx) => [outingMomentLine(ctx)] });

/* ── 她是谁（初识只给资料卡；陌生人偶遇只给边界，D-035/D-040） ── */
promptSections.register({ name: 'user-square', modes: SQUARE, order: ORDER.user, lines: (ctx) => userProfileBlock(ctx.me, 'square') });
promptSections.register({ name: 'user-bonded', modes: BONDED_CHAT, order: ORDER.user, lines: (ctx) => userProfileBlock(ctx.me, 'bonded') });
// 记事本里不放她的资料卡（那会把本子写成恋爱日记），只保留她的边界（红线优先级最高，D-035/D-098）
promptSections.register({ name: 'user-note', modes: NOTE, order: ORDER.user, lines: (ctx) => boundariesBlock(ctx.me) });
promptSections.register({
  name: 'user-outing',
  modes: OUTING,
  order: ORDER.user,
  lines: (ctx) => (isStranger(ctx) ? boundariesBlock(ctx.me) : userProfileBlock(ctx.me, 'outing')),
});
promptSections.register({ name: 'shared-memory', modes: 'all', order: ORDER.sharedMemory, lines: (ctx) => sharedMemoryBlock(ctx.character) });
// 广场偶遇的记录（D-110）：初识与广场陌生人都记得见过她
promptSections.register({ name: 'encounters', modes: ['square', 'outing'], order: ORDER.encounters, lines: (ctx) => (ctx.mode === 'square' || isStranger(ctx) ? encountersBlock(ctx) : []) });
promptSections.register({ name: 'square-situation', modes: SQUARE, order: ORDER.situation, lines: (ctx) => squareSituationLines(ctx) });

/* ── 记忆与秘密（只在羁绊层，商业承重墙；陌生人偶遇没有） ── */
promptSections.register({ name: 'memory', modes: BONDED_FAMILY, order: ORDER.memory, lines: (ctx) => memoryBlockFor(ctx.bond?.memory) });
promptSections.register({ name: 'memory-outing', modes: OUTING, order: ORDER.memory, lines: (ctx) => (isStranger(ctx) ? [] : memoryBlockFor(ctx.bond?.memory)) });
promptSections.register({ name: 'secrets', modes: BONDED_FAMILY, order: ORDER.secrets, lines: (ctx) => secretsBlock(ctx.character, levelInfo(ctx.bond?.affinity ?? 0).level) });
promptSections.register({
  name: 'secrets-outing',
  modes: OUTING,
  order: ORDER.secrets,
  lines: (ctx) => (isStranger(ctx) ? [] : secretsBlock(ctx.character, levelInfo(ctx.bond?.affinity ?? 0).level)),
});

/* ── 分寸与追法的落地 ── */
promptSections.register({ name: 'square-manner', modes: SQUARE, order: ORDER.manner, lines: () => SQUARE_MANNER });
promptSections.register({ name: 'love-rules', modes: BONDED_CHAT, order: ORDER.manner, lines: () => BONDED_LOVE_RULES });
promptSections.register({ name: 'initiative', modes: BONDED_CHAT, order: ORDER.initiative, lines: (ctx) => initiativeLine(ctx.character) });
promptSections.register({ name: 'stage', modes: BONDED_CHAT, order: ORDER.stage, lines: (ctx) => [stageLine(ctx)] });
promptSections.register({ name: 'outing-manner', modes: OUTING, order: ORDER.manner, lines: () => OUTING_MANNER });
// 记事本：TA 自己的生活（D-098；她出现多少按分量 D-099）——和聊天的「怎么爱她」占同一个槽位
promptSections.register({ name: 'note-life', modes: NOTE, order: ORDER.manner, lines: (ctx) => hisNoteLifeLines(ctx.character) });
promptSections.register({ name: 'stranger-manner', modes: OUTING, order: ORDER.strangerManner, lines: (ctx) => (isStranger(ctx) ? OUTING_STRANGER_MANNER : []) });
// 外出里阶段感在主动性之前（与亲密相反）
promptSections.register({ name: 'stage-outing', modes: OUTING, order: ORDER.outingStage, lines: (ctx) => (isStranger(ctx) ? [] : [stageLine(ctx)]) });
promptSections.register({ name: 'initiative-outing', modes: OUTING, order: ORDER.outingInitiative, lines: (ctx) => (isStranger(ctx) ? [] : initiativeLine(ctx.character)) });

/* ── 红线与输出格式（红线段对应 CLAUDE.md §9，勿删） ── */
promptSections.register({ name: 'hard-rules', modes: 'all', order: ORDER.hardRules, lines: () => CHAT_HARD_RULES_OF() });
promptSections.register({ name: 'output-chat', modes: ['square', 'bonded'], order: ORDER.output, lines: () => CHAT_OUTPUT_FORMAT });
promptSections.register({ name: 'output-call', modes: ['call'], order: ORDER.output, lines: () => CALL_MANNER });
promptSections.register({ name: 'output-note', modes: ['note'], order: ORDER.output, lines: () => HIS_NOTE_MANNER });
promptSections.register({ name: 'output-outing', modes: OUTING, order: ORDER.output, lines: () => OUTING_OUTPUT_FORMAT });
promptSections.register({ name: 'length-square', modes: SQUARE, order: ORDER.length, lines: () => [SQUARE_LENGTH] });
promptSections.register({ name: 'length-bonded', modes: ['bonded'], order: ORDER.length, lines: () => BONDED_LENGTH });

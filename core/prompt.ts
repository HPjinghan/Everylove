/**
 * 系统 prompt 分段装配（D-086）——借 dsh 的 PromptSection：每段声明名字、参与哪些模式、顺序，装配时按序拼接。
 * 加一条要同时进亲密 / 通话 / 外出的规则 = 注册一段，不再改三个 build 函数；
 * 一个玩法（红包、查手机）自己的规则由该玩法注册，卸掉玩法这段就消失。
 * 文本本身仍集中在 content/prompts.ts（D-017 的精神不变：改「TA 怎么说话」只看那一个文件），这里只管顺序与开关。
 */

import { createRegistry } from '@/core/registry';
import type { EngineContext } from '@/lib/types';

/** 装配模式 = 四种对话模式 + TA 写记事本（亲密背景 + 记事本写法） */
export type PromptMode = EngineContext['mode'] | 'note';

/**
 * 具名顺序槽（同一段在不同模式里可以落在不同槽位，见 PromptSection.order）。
 * 数字只表示先后，留有间隔便于插入；改顺序 = 改这里，不改文本。
 */
export const ORDER = {
  intro: 0,
  persona: 10,
  pursuit: 20,
  profile: 30,
  voice: 40,
  now: 50,
  timeRules: 55,
  birthday: 56,
  moment: 60,
  user: 70,
  sharedMemory: 80,
  situation: 85,
  memory: 90,
  secrets: 100,
  phone: 110,
  redPacket: 120,
  manner: 130,
  strangerManner: 135,
  initiative: 140,
  /** 外出模式里阶段感在主动性之前（与亲密模式相反） */
  outingStage: 140,
  outingInitiative: 145,
  stage: 150,
  hardRules: 200,
  output: 210,
  length: 220,
} as const;

export interface PromptEnv {
  /** 本次装配的模式（TA 写记事本时 ctx.mode 仍是 bonded，这里是 note） */
  mode: PromptMode;
  now: Date;
}

export interface PromptSection {
  /** 唯一名字；同名再注册 = 覆盖 */
  name: string;
  /** 参与哪些模式；'all' = 全部 */
  modes: readonly PromptMode[] | 'all';
  /** 顺序：一个数字，或按模式覆盖（{ default, outing: … }） */
  order: number | ({ default: number } & Partial<Record<PromptMode, number>>);
  /** 产出的行；空数组 = 这次不出现 */
  lines(ctx: EngineContext, env: PromptEnv): string[];
}

export const promptSections = createRegistry<PromptSection>('promptSections', (s) => s.name);

function orderFor(s: PromptSection, mode: PromptMode): number {
  return typeof s.order === 'number' ? s.order : (s.order[mode] ?? s.order.default);
}

/** 某模式会用到的分段，按顺序（同序按注册先后） */
export function sectionsFor(mode: PromptMode): PromptSection[] {
  return promptSections
    .list()
    .filter((s) => s.modes === 'all' || s.modes.includes(mode))
    .sort((a, b) => orderFor(a, mode) - orderFor(b, mode));
}

/** 装配系统 prompt：各段的行按序拼接，一行一个 '\n' */
export function assembleSystemPrompt(ctx: EngineContext, opts: { mode?: PromptMode; now?: Date } = {}): string {
  const mode = opts.mode ?? ctx.mode;
  const env: PromptEnv = { mode, now: opts.now ?? new Date() };
  const secs = sectionsFor(mode);
  if (!secs.length) {
    throw new Error(`底座未启动：模式「${mode}」没有任何 prompt 分段（先 import "@/features"）`);
  }
  return secs.flatMap((s) => s.lines(ctx, env)).join('\n');
}

/**
 * 系统 prompt 分段装配（D-086）——借 dsh 的 PromptSection：每段声明名字、参与哪些模式、顺序，装配时按序拼接。
 * 加一条要同时进亲密 / 通话 / 外出的规则 = 注册一段，不再改三个 build 函数；
 * 一个玩法（红包、查手机）自己的规则由该玩法注册，卸掉玩法这段就消失。
 * 文本本身集中在 content/prompts/ 目录（一用途一文件，D-017/D-087：改「TA 怎么说话」只看那个目录），这里只管顺序与开关。
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
  /** 身边的人（D-110）：紧跟角色设定 */
  circle: 34,
  voice: 40,
  /** 外出的地点与天气（D-175）：动态段的开头 */
  scene: 48,
  now: 50,
  timeRules: 55,
  birthday: 56,
  moment: 60,
  user: 70,
  sharedMemory: 80,
  /** 广场偶遇的记录（D-110） */
  encounters: 84,
  situation: 85,
  memory: 90,
  secrets: 100,
  /** 玩法自己的规则段（D-179）：110～129 归各玩法，用 `ORDER.gameplay + n` 排先后（查手机 +0 / 红包 +10 / 钱包 +12 / 发图 +14……） */
  gameplay: 110,
  manner: 130,
  strangerManner: 135,
  initiative: 140,
  /** 外出模式里阶段感在主动性之前（与亲密模式相反） */
  outingStage: 140,
  outingInitiative: 145,
  stage: 150,
  /** 温度（D-126）：疏远 / 久别那一句，紧跟阶段感 */
  warmth: 152,
  /** 像个人一样说话（D-141）：四种对话共用的说话方式，在各模式的分寸之后、红线之前 */
  talk: 160,
  hardRules: 200,
  /** 她最近几句里有危机内容（D-167）：紧跟硬规则 */
  crisis: 202,
  /** 暗号类判分规则（D-179）：在红线之后、输出格式之前（好奇判分用它） */
  markers: 205,
  output: 210,
  length: 220,
  /** 这轮短一点（D-144）：最后一句 */
  brevity: 230,
  /** 她的回复变短了（D-153）：只在转折那一轮出，在「这轮短一点」之后 */
  moodShift: 232,
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
  /**
   * 稳定段（D-175）：同一段关系里逐轮不变的（人设 / 她是谁 / 规则……），装配时排在所有动态段（此刻 / 记忆 / 舞台提示……）之前，
   * 供应商把这一整块作为 prompt 缓存的前缀（Anthropic cache_control；千帆靠前缀相同自动命中）。不标 = 动态段。
   */
  stable?: boolean;
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

/** 装配出的两块（D-175）：stable = 稳定段（缓存前缀），dynamic = 动态段；系统 prompt = 两块用 '\n' 接起来 */
export interface SystemPromptParts {
  stable: string;
  dynamic: string;
}

/** 装配系统 prompt 的两块：稳定段按序在前、动态段按序在后，一行一个 '\n' */
export function assembleSystemPromptParts(ctx: EngineContext, opts: { mode?: PromptMode; now?: Date } = {}): SystemPromptParts {
  const mode = opts.mode ?? ctx.mode;
  const env: PromptEnv = { mode, now: opts.now ?? new Date() };
  const secs = sectionsFor(mode);
  if (!secs.length) {
    throw new Error(`底座未启动：模式「${mode}」没有任何 prompt 分段（先 import "@/features"）`);
  }
  const stable = secs.filter((s) => s.stable).flatMap((s) => s.lines(ctx, env)).join('\n');
  const dynamic = secs.filter((s) => !s.stable).flatMap((s) => s.lines(ctx, env)).join('\n');
  return { stable, dynamic };
}

/** 装配系统 prompt（一整段文本） */
export function assembleSystemPrompt(ctx: EngineContext, opts: { mode?: PromptMode; now?: Date } = {}): string {
  return joinPromptParts(assembleSystemPromptParts(ctx, opts));
}

export function joinPromptParts(p: SystemPromptParts): string {
  return [p.stable, p.dynamic].filter(Boolean).join('\n');
}

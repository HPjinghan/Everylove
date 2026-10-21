/**
 * 用量记账的接缝（D-133）：每一次花钱的调用（聊天 / 后台任务 / 生图 / 语音合成 / 识别 / 看图）都往这里报一笔，
 * 底座不认识「流量」「语音分钟」——谁来换算、从哪扣是 features/traffic.ts 的事（usageHooks）。
 * 每笔带账单归属 billing（D-210）：user = 玩家发起、记在玩家账上；house = 角色自己发起的后台生成，平台出、不扣玩家；
 * included = 已含在别的计量里（通话按分钟另算），这里不再扣。
 * 生成闸门（generationGate）：真要调模型前先问一声还能不能花，核心层只管问、不管为什么。
 */

import { createEmitHook } from '@/core/hooks';

export type UsageKind = 'chat' | 'image' | 'tts' | 'asr' | 'vision';

/** 这笔账算给谁（D-210）：user 玩家 / house 平台（角色自己发起的）/ included 已含在别的计量里 */
export type Billing = 'user' | 'house' | 'included';

export interface UsageEvent {
  kind: UsageKind;
  /** 供应商 id（chat）/ 模型名（image）/ 通道（tts / asr） */
  provider: string;
  /** chat / vision：输入 / 输出 token；供应商没返回就按字数估（estimated = true） */
  inputTokens?: number;
  outputTokens?: number;
  /** image：几张；tts：几个字；tts / asr：几秒（tts 按字数估） */
  images?: number;
  chars?: number;
  seconds?: number;
  /** 账单归属（D-210）；不写 = user */
  billing?: Billing;
  estimated?: boolean;
  /** chat：reply = 角色回话；task = 后台任务 */
  reqKind?: 'reply' | 'task';
  /** 走了服务端代理、服务器已经记过账（D-217）：本机只记流水不再扣 */
  metered?: boolean;
}

export const usageHooks = createEmitHook<[UsageEvent]>('usage');

/** 报一笔（不等待监听者） */
export function reportUsage(e: UsageEvent): void {
  void usageHooks.emit(e);
}

/** 粗估 token 与念出来几秒（语音分钟按它记，D-210）：与服务端代理同一份（D-217） */
export { estimateSpeechSeconds, estimateTokens } from '@/supabase/functions/_shared/economy';

/** 生成闸门：返回一句原因 = 这次不能花（调用方抛 GenerationBlockedError）；null = 放行 */
type Gate = (kind: UsageKind, billing: Billing) => string | null;
let gate: Gate | null = null;
export function setGenerationGate(fn: Gate | null): void {
  gate = fn;
}
export function generationBlocked(kind: UsageKind, billing: Billing = 'user'): string | null {
  return gate ? gate(kind, billing) : null;
}

export class GenerationBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GenerationBlockedError';
  }
}

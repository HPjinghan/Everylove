/**
 * 用量记账的接缝（D-133）：每一次花钱的调用（聊天 / 后台任务 / 生图 / 语音合成 / 识别 / 看图）都往这里报一笔，
 * 底座不认识「流量」——谁来换算成流量并扣账是 features/traffic.ts 的事（usageHooks）。
 * 生成闸门（generationGate）：真要调模型前先问一声还能不能花（流量用完 = 不能），核心层只管问、不管为什么。
 */

import { createEmitHook } from '@/core/hooks';

export type UsageKind = 'chat' | 'image' | 'tts' | 'asr' | 'vision';

export interface UsageEvent {
  kind: UsageKind;
  /** 供应商 id（chat）/ 模型名（image）/ 通道（tts / asr） */
  provider: string;
  /** chat / vision：输入 / 输出 token；供应商没返回就按字数估（estimated = true） */
  inputTokens?: number;
  outputTokens?: number;
  /** image：几张；tts：几个字；asr：几秒（估） */
  images?: number;
  chars?: number;
  seconds?: number;
  estimated?: boolean;
  /** chat：reply = 角色回话；task = 后台任务 */
  reqKind?: 'reply' | 'task';
}

export const usageHooks = createEmitHook<[UsageEvent]>('usage');

/** 报一笔（不等待监听者） */
export function reportUsage(e: UsageEvent): void {
  void usageHooks.emit(e);
}

/** 粗估 token：中日韩文一字约 1 token，其余约 3.5 字符 1 token */
export function estimateTokens(text: string): number {
  let cjk = 0;
  for (const ch of text) if ((ch >= '　' && ch <= '鿿') || (ch >= '가' && ch <= '힯') || (ch >= '＀' && ch <= '￯')) cjk++;
  return Math.round(cjk + (text.length - cjk) / 3.5);
}

/** 生成闸门：返回一句原因 = 这次不能花（调用方抛 GenerationBlockedError）；null = 放行 */
let gate: ((kind: UsageKind) => string | null) | null = null;
export function setGenerationGate(fn: ((kind: UsageKind) => string | null) | null): void {
  gate = fn;
}
export function generationBlocked(kind: UsageKind): string | null {
  return gate ? gate(kind) : null;
}

export class GenerationBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GenerationBlockedError';
  }
}

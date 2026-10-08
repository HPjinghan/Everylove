/**
 * 通话按分钟计（D-210）：电话里的回话、识别、合成都含在通话分钟里（call 模式 billing = included），
 * 通话页按接通后的时长分段扣她的语音时长（先今天的额度、再新用户送的、最后分钟包）。
 * 剩不到一分钟时这一轮让 TA 自己收尾（prompt 末尾一句，content/prompts/call.ts CALL_WRAP_UP），用完了 TA 说完这句就挂。
 */

import { CALL_WRAP_UP } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';
import { CALL_WRAP_UP_SEC, voiceLeft } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

/** 正在收尾的那通电话（角色 id）；挂断清掉 */
let wrappingUp: string | null = null;

/** 这通电话还能打几秒 */
export function callSecondsLeft(): number {
  const s = useAppStore.getState();
  return voiceLeft(s.voice, s.plan, 'call');
}

/** 扣掉这段时长（秒）；返回扣完还剩几秒。剩得不多就让 TA 收尾 */
export function chargeCall(characterId: string, sec: number): number {
  if (sec > 0) useAppStore.getState().useVoice(sec, 'call');
  const left = callSecondsLeft();
  if (left <= CALL_WRAP_UP_SEC) wrappingUp = characterId;
  return left;
}

export function endCallMeter(): void {
  wrappingUp = null;
}

promptSections.register({
  name: 'call-wrap-up',
  modes: ['call'],
  when: (ctx) => !!wrappingUp && ctx.character.id === wrappingUp,
  order: ORDER.brevity + 1,
  lines: () => [CALL_WRAP_UP],
});

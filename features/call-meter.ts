/**
 * 通话按分钟计（D-210）：电话里的回话、识别、合成都含在通话分钟里（call 模式 billing = included），
 * 通话页按接通后的时长分段扣她的语音时长（先今天的额度、再新用户送的、最后分钟包）。
 * 剩不到一分钟时这一轮让 TA 自己收尾（prompt 末尾一句，content/prompts/call.ts CALL_WRAP_UP），用完了 TA 说完这句就挂。
 */

import { CALL_WRAP_UP } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import { CALL_WRAP_UP_SEC, voiceLeft } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

/** 正在收尾的那通电话（角色 id）；挂断清掉 */
let wrappingUp: string | null = null;

/** 这通电话还能打几秒 */
export function callSecondsLeft(): number {
  const s = useAppStore.getState();
  return voiceLeft(s.voice, s.plan, 'call');
}

/**
 * 有服务器时通话按服务器时钟计（D-217）：接通、每 10 秒、挂断各报一声，服务器按两声之间的真实时长扣
 * （客户端报的秒数不作数）；最新钱包随响应写回 store（features/traffic.ts 的监听）。没有服务器才在本机扣。
 */
let ticks: Promise<unknown> = Promise.resolve();
function tick(end: boolean): Promise<unknown> {
  // 排队发：挂断那一声一定在最后到，服务器才不会把这通电话当成还在打
  ticks = ticks.then(() => proxyJson('wallet.call', { end })).catch((e) => console.warn('[call] 通话计时失败：', e));
  return ticks;
}

/** 开始计时：TA 接起来说第一句之前就要报到，那一句才算在通话里 */
export async function startCallMeter(): Promise<void> {
  if (proxyReadySync()) await tick(false);
}

/** 扣掉这段时长（秒）；返回扣完还剩几秒。剩得不多就让 TA 收尾 */
export function chargeCall(characterId: string, sec: number): number {
  let left: number;
  if (proxyReadySync()) {
    tick(false);
    // 服务器的回话下一拍才到：先按本机缓存预估
    left = Math.max(0, callSecondsLeft() - Math.max(0, sec));
  } else {
    if (sec > 0) useAppStore.getState().useVoice(sec, 'call');
    left = callSecondsLeft();
  }
  if (left <= CALL_WRAP_UP_SEC) wrappingUp = characterId;
  return left;
}

export function endCallMeter(): void {
  if (proxyReadySync()) tick(true);
  wrappingUp = null;
}

promptSections.register({
  name: 'call-wrap-up',
  modes: ['call'],
  when: (ctx) => !!wrappingUp && ctx.character.id === wrappingUp,
  order: ORDER.brevity + 1,
  lines: () => [CALL_WRAP_UP],
});

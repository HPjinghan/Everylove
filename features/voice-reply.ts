/**
 * TA 偶尔发语音（D-074）：只在羁绊会话；只挑最后一条气泡、短句；她刚发过语音时更爱回语音。
 * 挂在回合管线的 bubble 钩子上——把那条气泡改成语音消息并预热合成，点开即播。
 */

import { turnHooks } from '@/core/turn';
import { shouldSendVoice, synthesizeVoice } from '@/lib/tts';

turnHooks.bubble.on((msg, { scope, ctx, index, total }) => {
  if (scope.mode !== 'bonded' || index !== total - 1) return msg;
  const herVoice = ctx.history[ctx.history.length - 1]?.kind === 'voice';
  if (!shouldSendVoice(ctx.character, msg.text, { herVoice })) return msg;
  void synthesizeVoice(msg.text, ctx.character);
  return { ...msg, kind: 'voice' };
});

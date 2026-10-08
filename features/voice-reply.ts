/**
 * TA 偶尔发语音（D-074）：只在羁绊会话；只挑最后一条气泡、短句；她刚发过语音时更爱回语音。
 * 挂在回合管线的 bubble 钩子上——把那条气泡改成语音消息并预热合成，点开即播。
 * 语音按分钟算（D-210）：这段羁绊的「TA 发语音」开关关着就不发（没动过 = 订阅开、Free 关）；她这一轮里的语音扣她的语音时长，
 * 用完了就发文字；TA 自己发起的（主动 / 召回 / 心跳）平台出、不扣她。
 */

import { turnHooks } from '@/core/turn';
import { voiceMessageLeft } from '@/features/traffic';
import { shouldSendVoice, synthesizeVoice } from '@/lib/tts';
import { voiceRepliesOn } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

turnHooks.bubble.on((msg, { scope, ctx, index, total, billing }) => {
  if (scope.mode !== 'bonded' || index !== total - 1) return msg;
  const s = useAppStore.getState();
  const bond = s.bonds.find((b) => b.id === scope.bondId);
  if (!bond || !voiceRepliesOn(bond, s.plan, s.voice)) return msg;
  if (billing === 'user' && voiceMessageLeft() <= 0) return msg;
  const herVoice = ctx.history[ctx.history.length - 1]?.kind === 'voice';
  if (!shouldSendVoice(ctx.character, msg.text, { herVoice })) return msg;
  void synthesizeVoice(msg.text, ctx.character, billing === 'user' ? 'user' : 'house');
  return { ...msg, kind: 'voice' };
});

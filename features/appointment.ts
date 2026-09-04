/**
 * 约定识别（D-079）：Message 里聊定了「什么时候在哪见」→ 记进日程（先关键词粗筛，命中才问模型）。
 * 只在亲密会话回合后触发（通话在挂断时识别，见 lib/call.ts logCall）。
 */

import { turnHooks } from '@/core/turn';
import { detectAppointment } from '@/lib/outing';

turnHooks.after.on(({ scope }) => {
  if (scope.mode === 'bonded' && scope.bondId) void detectAppointment(scope.bondId);
});

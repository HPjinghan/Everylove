/**
 * 羁绊记忆库（D-016）：每隔几轮后台提取长期事实 + 滚动摘要，失败静默。
 * 只在亲密会话回合后触发（通话在挂断时统一提取，见 lib/call.ts）；只有羁绊层有记忆——商业承重墙。
 */

import { turnHooks } from '@/core/turn';
import { updateBondMemory } from '@/lib/memory';

turnHooks.after.on(({ scope }) => {
  if (scope.mode === 'bonded' && scope.bondId) void updateBondMemory(scope.bondId);
});

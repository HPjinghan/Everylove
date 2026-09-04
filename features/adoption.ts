/**
 * 领养触发器（D-008/D-029/D-056）：心动值满 100 → TA 主动开口交换联系方式。
 * 产品触发器，不由模型决定：在初识试聊与外出的陌生人偶遇里，TA 回完这一轮后检查；暗面回合不触发。
 * 台词用角色脚本（content/characters.ts 的 offer），走会话模式落屏（试聊落配对记录，外出落现场）。
 */

import { scriptFor } from '@/content/characters';
import { himMsg, turnHooks, wait } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { useAppStore } from '@/store/app-store';

turnHooks.after.on(async ({ scope, ctx, mode, darkSide, ui }) => {
  const courting = scope.mode === 'square' || (scope.mode === 'outing' && !ctx.bond);
  if (!courting || darkSide) return;
  const id = ctx.character.id;
  const chat = useAppStore.getState().squareChats[id];
  if (!chat || chat.adoptionOffered || (chat.heart ?? 0) < HEART_FULL) return;

  const natural = (ui.pace ?? 'natural') === 'natural';
  if (natural) await wait(1100);
  for (const line of scriptFor(ctx.character).offer) {
    ui.typing?.(true);
    if (natural) await wait(800);
    ui.typing?.(false);
    mode.append(scope, [himMsg(line)]);
  }
  useAppStore.getState().appendSquare(id, [], { offered: true });
});

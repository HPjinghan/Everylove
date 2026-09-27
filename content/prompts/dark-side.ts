/**
 * 她刚说过让人担心的话（D-167）：命中暗面路由的那一轮由固定回复接住（不进模型）；
 * 之后几轮模型能在历史里看到那句，这里加一句「放下一切认真陪着」——不顺着人设入戏、不调情、不拿它开玩笑。
 * 热线那句已在硬规则里（shared.ts crisisLine），这里不重复（D-152 一条规则只说一次）。判定在 lib/dark-side.ts。
 */

import { recentDarkHit } from '@/lib/dark-side';
import type { EngineContext } from '@/lib/types';

export const DARK_FOLLOWUP_LINE =
  "[Right now] A few messages ago she said something that sounds like real pain or danger. Stay with that, as yourself: keep everything else aside, no flirting or games, don't joke about it or brush past it; be gentle, present and unhurried, and let her lead. If she brings it up again, take it seriously and point her to real help.";

export function darkFollowupLines(ctx: EngineContext): string[] {
  return recentDarkHit(ctx.history) ? [DARK_FOLLOWUP_LINE] : [];
}

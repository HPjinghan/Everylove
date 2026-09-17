/**
 * 温度（D-126）进对话的那一句：只在「疏远」与「久别归来」两档出字，热络 / 平常不加字（现行口吻）。
 * 温度本身在 lib/bond.ts（warmthNow / warmthBand）；这里只有给模型看的字。
 */

import { warmthBand, warmthNow } from '@/lib/bond';
import type { EngineContext } from '@/lib/types';

/** 久别归来后多久之内第一句按「很久没见」 */
export const COLD_RETURN_WINDOW_MS = 3600_000;

export function warmthLine(ctx: EngineContext, now: Date): string[] {
  const b = ctx.bond;
  if (!b) return [];
  if (b.coldReturnAt && now.getTime() - b.coldReturnAt < COLD_RETURN_WINDOW_MS) {
    return [
      "- Long absence: she's been away a long time and only just came back. Speak like someone meeting again after a while: keep the first line light, don't ask where she's been, don't mention how long you waited, no sulking; you can tell her about your own days meanwhile (from your notebook and posts).",
    ];
  }
  if (warmthBand(warmthNow(b, now.getTime())) === 'distant') {
    return ["- Drifting: you two haven't talked much for a while. Don't ask \"why are you ignoring me\", don't push, don't mention how long you waited; start from your own day, with lighter and shorter sentences than usual."];
  }
  return [];
}

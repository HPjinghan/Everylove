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
      '- 久别：她很久没来了，刚刚才回来。像很久没见的人重新开口：第一句轻一点，不问她去了哪、不提等了多久、不委屈；可以把这些天你自己的事（记事本、帖子里的）讲给她听。',
    ];
  }
  if (warmthBand(warmthNow(b, now.getTime())) === 'distant') {
    return ['- 疏远：你们有一阵子没怎么说话了。不问「怎么不理我」、不催、不提你等了多久；从自己的日子说起，句子比平时更轻、更短。'];
  }
  return [];
}

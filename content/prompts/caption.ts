/**
 * 看图（D-073）：她发来的照片 → 视觉模型客观描述 → 作为上下文交给对话模型。
 */



/**
 * 看图助手的系统指令（lib/media.ts describeImage 用，视觉模型默认 qwen3.5-397b-a17b）。
 * 产出的描述只进对话上下文（messageContextText 包成「她发来一张照片：…」），不上屏。
 * 红线 #2「他只看她」：画面里的人只说人数与在做什么，不描述长相、不猜身份——评价留给对话模型按硬规则处理。
 */
import { getLang, type Lang } from '@/lib/i18n';

import { langName } from './shared';

export function imageCaptionSystem(lang: Lang = getLang()): string {
  return [
  `你是一个客观的看图助手。用户会发来一张她拍的或转发的照片，你用${langName(lang)}写一段 60~120 字的描述，供另一个聊天模型「看见」这张图。`,
  '要求：',
  '- 只写画面里确实有的东西：场景、物件、食物、动物、天气光线、可见的文字、整体氛围。',
  '- 若画面里有人：只说明人数与大概在做什么（如「一个人坐在窗边」），不描述任何人的长相、身材、年龄，不猜测身份或关系。',
  '- 不评价、不抒情、不给建议、不加问句、不用 markdown、不用 emoji。',
  '- 若看不清或不是照片（截图、表情包、文字图），如实说明它是什么、上面写了什么。',
  ].join('\n');
}

export const IMAGE_CAPTION_USER = '描述这张照片。';

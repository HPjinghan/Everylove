/**
 * TA 主动发图（D-130）：给模型看的字 + 生图 prompt。
 * - 聊天里这一轮被给了选项时，TA 可以在回复末尾写 [发图 一句话描述]（她看不到这行，她会收到一张照片）——拍的是 TA 此刻眼前的东西；
 * - 照片按外出拍照同一套画风（角色的立绘画风）生成：第一人称随手拍，TA 自己不入镜或只入镜一点点，没有她、没有别人。
 * 解析、生成与落消息在 features/his-photo.tsx；三道门在 lib/extras.ts。
 */

import type { Character } from '@/lib/types';

import { COMIC_QUALITY, COMIC_RULES, COMIC_STYLE, comicSubjectLine } from './image-common';
import { portraitStyleFor } from './portrait';

export const HIS_PHOTO_MARK = '[发图 一句话描述]';
export const HIS_PHOTO_PATTERN = /\[发图\s*([^\]]*)\]/;

export const HIS_PHOTO_LINES = [
  `【发一张照片】这一轮如果顺手，可以在回复最后单独一行写 ${HIS_PHOTO_MARK}（她看不到这行，她会收到照片）：拍的是你此刻眼前的东西——你在做的事、桌上的、窗外的、路上的、刚买的。`,
  '- 描述写具体的画面（光线、东西、地方），一句话；你自己不入镜或只入镜一只手、一角衣袖；不拍她、不拍别人。',
  '- 不硬拍：聊到了、想让她看见才拍；这一轮不合适就不写。',
];

/** 生图 prompt：TA 用手机随手拍的一张——画风跟角色走 */
export function buildHisPhotoPrompt(character: Character, opts: { desc: string; weatherLine?: string; timeLine?: string }): string {
  const styleLine = portraitStyleFor(character).line || COMIC_STYLE;
  return [
    styleLine,
    comicSubjectLine(character),
    `一张主角用手机随手拍的照片：${opts.desc.trim()}。${opts.timeLine ? `${opts.timeLine}，` : ''}${opts.weatherLine ? `${opts.weatherLine}。` : ''}`,
    '构图：第一人称随手拍——镜头对着主角眼前的东西；主角本人不入镜，或只入镜一只手、一角衣袖；画面里没有别人。生活感、不摆拍。',
    COMIC_QUALITY,
    COMIC_RULES,
  ].join('\n');
}

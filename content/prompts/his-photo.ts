/**
 * TA 发图（D-130 → D-135）：给模型看的字 + 生图 prompt。
 * - 两种时刻：**她要看的 / 东西刚送到她点的**（随时可以）；**主动拍一张**（只在这一轮被给了选项时，lib/extras.ts 三道门）。
 * - 回复末尾写 [发图 一句话描述]（她看不到这行，她会收到照片）——拍的是 TA 此刻眼前的东西；
 * - 照片按外出拍照同一套画风（角色的立绘画风）生成：第一人称随手拍，TA 自己不入镜或只入镜一点点，没有她、没有别人。
 * 解析、生成与落消息在 features/his-photo.tsx。
 */

import type { Character } from '@/lib/types';

import { COMIC_QUALITY, COMIC_RULES, COMIC_STYLE, comicSubjectLine } from './image-common';
import { portraitStyleFor } from './portrait';

export const HIS_PHOTO_MARK = '[发图 一句话描述]';
export const HIS_PHOTO_PATTERN = /\[发图\s*([^\]]*)\]/;

/** 她的话 / 舞台提示里出现这些 = 这一轮是「她要看」或「东西送到了」，发图不受主动那三道门管 */
export const PHOTO_REQUEST_PATTERN = /看看|拍给|拍一张|拍张|发张|发一张|照片|图片|图给|长什么样|到了吗|送到|photo|pic|picture|写真|見せ|사진|보여/i;

export function hisPhotoLines(offeredProactive: boolean): string[] {
  const lines = [
    `【发照片】她让你拍给她看、问你东西长什么样，或者她点的外卖 / 礼物刚送到你手上——这些时刻可以在回复最后单独一行写 ${HIS_PHOTO_MARK}（她看不到这行，她会收到照片），拍的是你此刻眼前的东西。`,
    '- 描述写具体的画面（光线、东西、地方），一句话；只拍东西本身，你自己不入镜、也不拍手，不拍她、不拍别人。',
  ];
  lines.push(
    offeredProactive
      ? '- 这一轮如果顺手，也可以主动拍一张你在做的事、桌上的、窗外的给她；不硬拍，聊到才拍。'
      : '- 她没要、也没有东西送到就不拍。'
  );
  return lines;
}

/**
 * 生图 prompt：TA 用手机随手拍的一张——画风跟角色走。只画她要看的那样东西：不带星期、时间、天气这些字，画面里不出现文字；
 * 画面里没有任何人、也没有手（D-135 补，Harper：「不要用合影那种，会出现一只对方的手；他收到东西默认家里是一个人」）。
 */
export function buildHisPhotoPrompt(character: Character, opts: { desc: string }): string {
  const styleLine = portraitStyleFor(character).line || COMIC_STYLE;
  return [
    styleLine,
    comicSubjectLine(character),
    `一张主角用手机随手拍的照片：${opts.desc.trim()}。`,
    '构图：第一人称随手拍——镜头只对着眼前的东西（桌上的、手边的、窗外的）；画面里没有任何人，也没有手、手指、手臂、衣袖，不是合影。生活感、不摆拍。画面里不要出现任何文字、日期、时间、天气图标。',
    COMIC_QUALITY,
    COMIC_RULES,
  ].join('\n');
}

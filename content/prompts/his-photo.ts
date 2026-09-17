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

export const HIS_PHOTO_MARK = '[发图 自拍或东西|一句话描述]';
export const HIS_PHOTO_PATTERN = /\[发图\s*([^\]]*)\]/;

/** 她的话 / 舞台提示里出现这些 = 这一轮是「她要看」或「东西送到了」，发图不受主动那三道门管 */
export const PHOTO_REQUEST_PATTERN = /看看|拍给|拍一张|拍张|发张|发一张|照片|图片|图给|长什么样|到了吗|送到|photo|pic|picture|写真|見せ|사진|보여/i;

export function hisPhotoLines(offeredProactive: boolean): string[] {
  const lines = [
    `[Sending photos] When she asks you to snap something for her, asks what something looks like, or the food / gift she ordered has just reached you — at these moments you may write ${HIS_PHOTO_MARK} on a separate final line of your reply (she can't see the line; she receives a photo).`,
    '- The first part follows what she wants to see: if she wants to see you (a selfie, you holding something, what you\'re wearing) write "自拍" and you are in the frame; if she wants to see a thing (the food, something on the desk, the view outside) write "东西" and the frame holds only the thing — no people, no hands. The second part is one sentence describing the actual picture (light, object, place).',
    "- In every case no one else is in the frame: no second person, no one else's hands, shadow or body; never photograph her.",
  ];
  lines.push(
    offeredProactive
      ? "- This turn, if it fits, you may also snap something on your own — what you're doing, what's on the desk, the view outside — for her; don't force it, only when the conversation gets there."
      : "- If she didn't ask and nothing has been delivered, don't send one."
  );
  return lines;
}

/** 暗号第一段：她要看人还是东西（缺省东西） */
export function parseHisPhotoPayload(payload: string): { withHim: boolean; desc: string } {
  const parts = payload.split(/[|｜]/).map((s) => s.trim());
  if (parts.length >= 2) return { withHim: /自拍|人|自己|我/.test(parts[0]), desc: parts.slice(1).join(' ').trim() };
  return { withHim: false, desc: parts[0] ?? '' };
}

/**
 * 生图 prompt：TA 用手机随手拍的一张——画风跟角色走。不带星期、时间、天气这些字，画面里不出现文字；
 * 按她要的定（D-135 补，Harper）：要看他 → 主角入镜（自拍 / 举着东西），单人；要看东西 → 只有东西、没有人也没有手。
 * 任何情况没有别人：不能有第二个人、别人的手或影子（他收到东西默认家里就他一个人）。
 */
export function buildHisPhotoPrompt(character: Character, opts: { desc: string; withHim?: boolean }): string {
  const styleLine = portraitStyleFor(character).line || COMIC_STYLE;
  return [
    styleLine,
    comicSubjectLine(character),
    `一张主角用手机随手拍的照片：${opts.desc.trim()}。`,
    opts.withHim
      ? '构图：主角自己拍的——主角本人入镜（自拍或按描述举着 / 穿着那样东西），单人构图、中近景，神态自然；画面里只有主角一个人，没有第二个人、没有别人的手或影子。生活感、不摆拍。画面里不要出现任何文字、日期、时间、天气图标。'
      : '构图：第一人称随手拍——镜头只对着眼前的东西（桌上的、手边的、窗外的）；画面里没有任何人，也没有手、手指、手臂、衣袖，不是合影。生活感、不摆拍。画面里不要出现任何文字、日期、时间、天气图标。',
    COMIC_QUALITY,
    COMIC_RULES,
  ].join('\n');
}

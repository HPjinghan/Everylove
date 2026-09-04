/**
 * 外出拍照（D-051/D-056/D-079）：合影 / 拍 TA——她主动按快门的场景照（不是会话自动投放，D-037 纪律不变）。
 * 画风与模型跟角色的立绘走（portrait.ts 的画风表）；合影里她只入镜侧影 / 手，不画清晰正脸。
 */

import type { Character } from '@/lib/types';

import { COMIC_QUALITY, COMIC_RULES, COMIC_STYLE, comicSubjectLine } from './image-common';
import { portraitStyleFor } from './portrait';

/*
 * 已下线（D-037，推翻 D-024 的会话内投放）：初见画面 / 羁绊画面的生图 prompt——
 * 聊天与初见回归纯文本。构图心得（POV 不入镜、主角只叫「主角」、四格镜头递进）见 git 历史与 D-015/D-024。
 */

/* ── 外出拍照（D-051）：合影 / 拍TA——她主动按快门，不是会话自动投放（D-037 纪律不变） ── */

export function buildOutingPhotoPrompt(
  character: Character,
  opts: {
    placeName: string;
    scene: string;
    weatherLine?: string;
    kind: 'solo' | 'together';
    /** 最近几句对话，供推断主角此刻在做什么 */
    digest?: string;
  }
): string {
  const sceneLine = `场景：${opts.placeName}——${opts.scene}${opts.weatherLine ? `${opts.weatherLine}。` : ''}`;
  const doing = opts.digest
    ? `主角此刻正在做的事从这段对话推断（对话里的「她」是按快门的人，不完整入镜）：\n${opts.digest}`
    : '主角正在这个场景里自然地待着。';
  const composition =
    opts.kind === 'solo'
      ? '构图：她举起手机随手拍主角——单人构图、中近景；主角刚注意到镜头，神态自然（看镜头浅笑，或嫌弃地别开脸但嘴角藏不住笑）。画面里只有主角一个人。'
      : '构图：两个人的自拍合影——主角凑近镜头、占画面主体；按快门的她只入镜一点点：小半侧脸、一缕头发或比耶的手势，绝不画出她清晰的正脸（她的长相留给想象）。画面里没有其他人。';
  // 画风跟角色的立绘画风走（D-076）：同一个 TA 立绘与照片不换画风；不指定时回落原 COMIC_STYLE
  const styleLine = portraitStyleFor(character).line || COMIC_STYLE;
  return [
    styleLine,
    comicSubjectLine(character),
    sceneLine,
    doing,
    composition,
    COMIC_QUALITY,
    COMIC_RULES,
  ].join('\n');
}

/**
 * 立绘（D-019；D-076 三段结构：画风行 → 主体 → system + 红线句）：捏＋时生成一次，作头像 / 卡面用。
 * PORTRAIT_STYLES / PORTRAIT_SYSTEM 是纯字面量——调 prompt 工具（gen-image.bat，scripts/gen-image-core.mjs）实时从本文件读取，改这里两边同步。
 * 会话内生图已下线（D-037）；外出拍照在 photo.ts。
 */

import type { Character } from '@/lib/types';

import { COMIC_RULES, comicSubjectLine, roleOnly } from './image-common';
import { seedPortraitPrompt } from './portrait-seeds';

/* ── 立绘（D-019；D-076 改三段结构）：捏＋时生成一次，作头像/卡面用（D-037 后会话内生图已下线） ── */

/**
 * 画风表（D-076，Harper 拍板）：line 注入生图 prompt **第一行**；model = 该画风用的模型
 * （动漫 → 百度蒸汽机 Air-Image，它基本只出这一种画风但快且便宜；其余 → qwen-image，画风多样）。
 * 纯字面量数组——调 prompt 工具 scripts/gen-image-core.mjs 直接从本文件读取，改这里两边同步（D-017）。
 * 措辞是初稿，用 gen-image.bat 调；shojo 的 line 与原 COMIC_STYLE 一致，作缺省以保持既有角色画风不变。
 */
export const PORTRAIT_STYLES: { id: NonNullable<Character['artStyle']>; label: string; model: 'musesteamer-air-image' | 'qwen-image'; line: string }[] = [
  { id: 'anime', label: '动漫', model: 'musesteamer-air-image', line: '日系动漫插画风格：精致的线稿与赛璐璐上色，色彩明亮通透，光影干净利落。' },
  { id: 'shojo', label: '少女漫·水彩', model: 'qwen-image', line: '女性向少女漫画单格插画，日系条漫风格，柔和干净的线条，浅色水彩质感，米白底、玫瑰粉点缀。' },
  { id: 'korean', label: '韩系清透', model: 'qwen-image', line: '韩系网漫插画风格：清透的皮肤质感与柔光，线条细腻，色调干净明亮。' },
  { id: 'painterly', label: '厚涂', model: 'qwen-image', line: '厚涂插画风格：油画质感的笔触与光影，色彩沉稳有体积感，边缘柔和。' },
  { id: 'ink', label: '国风水墨', model: 'qwen-image', line: '国风水墨插画：墨线为主、淡彩点缀，留白与晕染，气质古典清雅。' },
  { id: 'realistic', label: '写实插画', model: 'qwen-image', line: '写实插画风格：接近真实的光影与皮肤质感，但保持绘画感，不是照片。' },
  { id: 'lineart', label: '线稿', model: 'qwen-image', line: '铅笔线稿风格：黑白素描，干净的排线与轻微阴影，不上色。' },
  { id: 'none', label: '不指定', model: 'qwen-image', line: '' },
];

export const DEFAULT_PORTRAIT_STYLE: NonNullable<Character['artStyle']> = 'shojo';

/** 反向提示（D-092）：不要把文字画进画面、不要 Q 版全身、不要多人。qwen-image 支持；蒸汽机不收这个参数 */
export const PORTRAIT_NEGATIVE = '文字, 字, 字母, 水印, logo, 标题, Q版, 全身, 鞋子, 多人, 照片, 边框, 画框';

export function portraitStyleFor(character: Pick<Character, 'artStyle'>) {
  return PORTRAIT_STYLES.find((s) => s.id === (character.artStyle ?? DEFAULT_PORTRAIT_STYLE)) ?? PORTRAIT_STYLES[1];
}

/** 该角色生图该用的模型（立绘与外出拍照同口径） */
export function imageModelFor(character: Pick<Character, 'artStyle'>): 'musesteamer-air-image' | 'qwen-image' {
  return portraitStyleFor(character).model;
}

/**
 * 立绘的 system 段（D-076，Harper 给定；放 prompt 最后，「以上要求」指画风行与主体描述）。
 * 纯字面量——调 prompt 工具从本文件读取。
 */
export const PORTRAIT_SYSTEM =
  '根据以上要求生成角色立绘：人类（如果要求为非人类，则生成半人类）半身构图，正面脸，轻微侧身，直视镜头；背景简单，无前景遮挡，画面内没有任何文字\n' +
  '干净的线条，线条颜色和整体画面和谐，单幅画格、单人构图；细节干净，高清。';

/** 立绘构图（D-019 原版；D-076 起立绘改用 PORTRAIT_SYSTEM，此常量留给调 prompt 工具对比与外出拍照参考） */
export const PORTRAIT_COMPOSITION =
  '角色立绘：半身构图，正面略微侧身，直视镜头，表情自然带一点这个人特有的神气；' +
  '纯浅色干净背景，无道具遮挡脸和上半身，画面内没有任何文字。';

/**
 * 立绘 prompt（D-076）：**画风行 → 主体（外貌 + 身份气质）→ system**，段间空行；
 * 最后一行保留红线句 COMIC_RULES（红线 #1/#5 的 prompt 侧实现，不随 system 文案改动而丢）。
 * 种子角色（D-107）：画风行与主体段换成 portrait-seeds.ts 里各自的专属版本，system 与红线句不变。
 */
export function buildPortraitPrompt(character: Character): string {
  const seed = seedPortraitPrompt(character.id);
  if (seed) return [seed.style, seed.subject, `${PORTRAIT_SYSTEM}\n${COMIC_RULES}`].join('\n\n');
  const subject = [
    comicSubjectLine(character),
    `身份气质：${roleOnly(character.identity)}${character.styleLabel ? `，${character.styleLabel}` : ''}。`,
  ].join('\n');
  return [portraitStyleFor(character).line, subject, `${PORTRAIT_SYSTEM}\n${COMIC_RULES}`]
    .filter(Boolean)
    .join('\n\n');
}

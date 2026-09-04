/**
 * 生图共用：主体描述（TA 是谁、长什么样）与红线句。立绘在 portrait.ts，外出拍照在 photo.ts，两者只共用这里。
 * 文生图 prompt 的组织顺序（对扩散模型更友好）：画风 → 主体外貌 → 场景与动作 → 构图 → 质量词 → 红线；尽量正向描述。
 * 生图 prompt 里不写角色名（模型会把名字当文字画进画面，D-092 实测），也不用「他/她」（看画的用户也是「她」，会撞）：主体一律叫「主角」。
 */

import type { Character } from '@/lib/types';

import { pronounFor } from './shared';

/**
 * 文生图 prompt 的组织顺序（对扩散模型更友好）：主体外貌 → 场景与动作 → 构图 → 气泡文字 → 画风 → 质量词 → 红线。
 * 尽量用正向描述（画面里有什么），少用否定句。
 */

/**
 * 生图 prompt 里不写角色名（模型会把名字当文字画进画面，D-092 实测），也不用「他/她」（看画的用户也是「她」，会撞）：主体一律叫「主角」。
 * 性别只在主体行用「男性/女性」标一次；人外角色按 pronoun 判，没有就不标。
 */
function genderWord(character: Character): string {
  const p = pronounFor(character);
  return p === '他' ? '男性' : p === '她' ? '女性' : '';
}

/** 身份里去掉年龄段（「急诊科医生 · 32」→「急诊科医生」），免得数字被当成文字画进画面 */
export function roleOnly(identity: string): string {
  return identity
    .split('·')
    .map((seg) => seg.trim())
    .filter((seg) => seg && !/^\d+$/.test(seg) && !/岁$/.test(seg))
    .join('、');
}

/** 主体：TA 长什么样（look 没有时回落身份 + 风格标签；种族非人类时入画）。不写名字：写了模型会把它画成文字（D-092） */
export function comicSubjectLine(character: Character): string {
  const g = genderWord(character);
  const look = character.look || `${roleOnly(character.identity)}，${character.styleLabel ?? ''}`;
  const race =
    character.race && character.race !== '人类' ? `${character.race}，带有相应的种族特征；` : '';
  return `画面主角是${g ? `一位${g}` : '一个角色'}：${race}${look}。`;
}

/** 画风 */
export const COMIC_STYLE =
  '女性向少女漫画单格插画，日系条漫风格，柔和干净的线条，浅色水彩质感，米白底、玫瑰粉点缀。';

/** 质量词（「整幅画面是一个画格」很重要：提到镜头/分镜时模型容易画成多格条漫） */
export const COMIC_QUALITY = '整幅画面就是一个完整的单幅画格、单人构图；细节干净，高清。';

/** 红线（勿删）：暧昧合规、不模仿真人 */
export const COMIC_RULES = '氛围暧昧、温柔、克制，无露骨内容。不模仿任何真实人物长相。';

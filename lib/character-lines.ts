/**
 * TA 自己的台词（D-094）：自创角色发布时让模型按人设写一次——开场白 / 想确定关系时的话 / 确定关系后的前三条 /
 * 一句人设 / 追法，存在角色上（Character.lines）；创作者可在「我创建的 → 编辑」里改或让 TA 重写。
 * 写不成（AI 不可用 / 解析失败）返回 null，scriptFor 回落原型兜底——发布不因此卡住。
 */

import { langOf } from '@/content/characters';
import { buildCharacterLinesUser, characterLinesSystem } from '@/content/prompts';
import { completeText, stripStageDirections } from '@/lib/engine';
import type { Character, CharacterLines } from '@/lib/types';

const MAX_LINE = 120;
const MAX_PERSONA = 120;
const MAX_PURSUIT = 160;

/** 一组台词：去空、剥（）舞台提示、截长、限条数 */
function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const items = v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return [];
  return stripStageDirections(items)
    .map((s) => s.slice(0, MAX_LINE))
    .slice(0, max);
}

function cleanLine(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

/** 模型输出 → CharacterLines；三组台词缺任何一组都算失败 */
export function parseCharacterLines(raw: string): CharacterLines | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const opening = cleanList(obj.opening, 3);
    const offer = cleanList(obj.offer, 4);
    const arrival = cleanList(obj.arrival, 4);
    if (!opening.length || !offer.length || !arrival.length) return null;
    return {
      opening,
      offer,
      arrival,
      persona: cleanLine(obj.persona, MAX_PERSONA),
      pursuit: cleanLine(obj.pursuit, MAX_PURSUIT),
    };
  } catch {
    return null;
  }
}

/** 让模型按角色卡写一份台词（用角色自己的语言）；失败返回 null */
export async function generateCharacterLines(c: Character): Promise<CharacterLines | null> {
  try {
    const raw = await completeText(characterLinesSystem(langOf(c)), buildCharacterLinesUser(c), 700);
    return parseCharacterLines(raw);
  } catch (e) {
    console.warn('[character-lines] 台词没写成：', e);
    return null;
  }
}

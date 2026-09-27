/**
 * 创造页的描述导入（D-025 / D-187）：一段描述 → 模型整理成 JSON（prompt 见 content/prompts/create.ts）。
 * 界面只调这里，不直接碰引擎；失败抛错，界面回落规则解析并说明原因（D-069）。
 */

import { characterParseSystem } from '@/content/prompts';
import { completeText } from '@/lib/engine';
import { parseJsonObject } from '@/lib/json';

export async function parseCharacterDescription(text: string): Promise<Record<string, unknown>> {
  const raw = await completeText(characterParseSystem(), text);
  const obj = parseJsonObject(raw);
  if (!obj) throw new Error('parse: not a JSON object');
  return obj;
}

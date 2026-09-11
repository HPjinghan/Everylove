/**
 * 世界书（D-110）：TA 所处的世界与 TA 对一切的认知。
 * 现实世界（默认）不出这一段——模型本来就活在当下的现实里；只有她创建的世界才注入，所有模式 / 用途（对话、外出、通话、记事本、发帖、身边的人）都带。
 */

import { getLang, type Lang } from '@/lib/i18n';
import type { Character } from '@/lib/types';
import { isRealWorld, worldOf, worldRuleLines } from '@/lib/worlds';

import { langName } from './shared';

export function worldBlock(c: Pick<Character, 'worldId' | 'world'>): string[] {
  const w = worldOf(c);
  if (isRealWorld(w)) return [];
  return [
    `【你所在的世界】${w.name}：${w.summary}`,
    ...worldRuleLines(w).map((r) => `- ${r}`),
    '- 你生在这个世界、只知道这个世界里有的东西：这里没有的品牌、明星、新闻、科技、地名，你不认识也不会提；她说到你不认识的东西，按你的世界去理解，或直接问她。',
    '- 你身边的人、你的工作与日常都在这个世界里；「手机」「消息」「发帖」按这个世界里对应的东西理解，不出戏、不解释设定。',
  ];
}

/**
 * 世界书的描述解析（D-123，同创造页 D-043）：她写 / 粘贴一大段世界观（小说设定、脑内画面、条目列表都行），
 * 点「自动解析」整理成表单三项；无 key / 失败回落规则解析（app/apps/world-edit.tsx）。只输出 JSON。
 */
export function worldParseSystem(lang: Lang = getLang()): string {
  return [
    '你是恋爱互动应用「世界书」功能的设定解析助手。用户会给你一大段世界观描述（自由文字、小说设定或条目列表），请把它整理成结构化字段，只输出 JSON。',
    '',
    '字段（描述里没有的就省略，绝不编造）：',
    '- name：这个世界的名字，不超过 20 字；描述里没起名就按内容取一个贴切的短名',
    '- summary：一句话说清这是个什么世界，不超过 80 字',
    '- rules：设定，一行一条、每行「维度：内容」（如 时代 / 地理 / 科技 / 规则 / 常识 / 势力 / 禁忌），保留描述里所有具体信息，可压缩改写但不丢事实；总共不超过 1500 字',
    '',
    '规则：只依据描述本身，不补全、不脑补；关于「用户/她」或某个具体角色的内容不属于世界，略过。',
    `字段里的文字用她写描述时用的语言（当前界面语言：${langName(lang)}）。`,
    '只输出一个 JSON 对象：不要 markdown 代码块标记，不要任何其他文字。',
  ].join('\n');
}

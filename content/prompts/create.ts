/**
 * 创造（D-043）：大段描述 → 结构化人设，只输出 JSON。
 */

import { LOVE_STYLES, loveStyleByLabel } from '@/content/characters';
import type { Character } from '@/lib/types';
import { getLang, type Lang } from '@/lib/i18n';

import { langName, pronounFor } from './shared';

/**
 * 「创造」App 的描述解析：用户写/粘贴 ≤2000 字的人设（自由文字、小说片段、角色卡都行），
 * 点「自动解析」由当前引擎整理成表单字段；无 key/失败回落规则解析（app/apps/create.tsx）。
 * 只输出 JSON；字段与长度上限对齐捏＋表单（D-025）。
 */
export function characterParseSystem(lang: Lang = getLang()): string {
  return [
  '你是恋爱互动应用「创造」功能的人设解析助手。用户会给你一大段角色描述（自由文字、小说片段或设定列表），请把它整理成结构化字段，只输出 JSON。',
  '',
  '字段（全部可选——描述里没有的就省略，绝不编造）：',
  '- name：角色名字，不超过 12 字',
  '- gender："male" | "female" | "nonbinary"',
  '- look：外貌一句话（发型发色/眼睛/身形/常穿/气质），不超过 60 字',
  '- story：背景故事（TA 是谁、从哪来、背着什么故事），不超过 300 字，可对原文压缩改写',
  '- race：种族（人类以外才写，如 龙族/狐族/精灵），不超过 10 字',
  '- birthday：生日，格式 "MM-DD"（如 "03-08"）',
  '- catchphrase：口癖，不超过 20 字',
  '- likes / dislikes：喜欢 / 讨厌的东西，顿号分隔，各不超过 40 字',
  `- loveStyle：恋爱中的类型，只能从这些里选（没有贴合的就省略）：${LOVE_STYLES.map((l) => l.label).join(' / ')}`,
  '- mbti：四字母 MBTI（如 "INFJ"）',
  '- chatNotes：其他聊天设定（语气、对她的称呼等），不超过 120 字',
  '- schedule：日常作息，不超过 120 字',
  '- initiative：主动联系强度，"high" | "mid" | "low"',
  '- taboos：角色的禁忌与边界（不做的事、回避的话题），不超过 120 字',
  '- presetMemories：角色与用户的共同记忆/共同过去，每行一条，总共不超过 200 字',
  '- secrets：隐藏设定/剧情钩子（角色藏着的事，会随关系亲近逐渐解锁），每行一条、浅的在前深的在后，总共不超过 300 字',
  '',
  '规则：只依据描述本身，不补全、不脑补；描述里关于「用户/她」的内容不是角色字段，可归进 chatNotes 或 presetMemories（如「叫她小朋友」「小时候是邻居」）。',
  `字段里的文字用她写描述时用的语言（当前界面语言：${langName(lang)}）；loveStyle 只填上面列出的选项原文。`,
  '只输出一个 JSON 对象：不要 markdown 代码块标记，不要任何其他文字。',
  ].join('\n');
}

/* ── TA 自己的台词（D-094）：自创角色发布时写一次；创作者可改、可让 TA 重写 ── */

/** 台词写手的系统指令：三组会上屏的话 + 一句人设与追法，只输出 JSON */
export function characterLinesSystem(lang: Lang = getLang()): string {
  return [
    '你是恋爱互动应用「创造」功能的台词写手：用户捏了一个角色（下称 TA），你替 TA 写几句 TA 自己会说的话。只输出 JSON。',
    `全部台词用${langName(lang)}写；下面所有规则里，「她」指将来和 TA 聊天的用户。`,
    '',
    '字段：',
    '- opening：2 条。TA 第一次开口（她第一次点开和 TA 的对话）：第一条很短，报名字或一声招呼；第二条带一点 TA 此刻在做的事和对她的一丝好奇。陌生人的分寸，不亲昵。',
    '- offer：3 条。TA 心动满了、想和她确定关系时说的话，三条递进：铺垫 → 表态 → 问她愿不愿意。用 TA 的口吻，郑重但不油腻，不用愧疚感留人。',
    '- arrival：3 条。确定关系后 TA 发来的前三条消息：第一条一两个字的招呼；第二条一件 TA 今天遇到的小事；第三条一句想她或问她的话。',
    '- persona：一句话（不超过 60 字）说清 TA 是谁：名字、年龄或身份、性格气质、说话方式。第三人称。',
    '- pursuit：一句话（不超过 80 字）说清 TA 怎么追人：节奏、表达好感的方式、分寸。',
    '',
    '写法：',
    '- 每条 1-2 句，口语、短、像手机上打字；不写（）动作神态、不用 emoji、不用 markdown、不带名字前缀。',
    '- 只依据角色卡：口癖、喜好、职业、作息都用得上，但别把设定当清单复述；不要出现任何真实人物。',
    '- 尺度停在暧昧；不纠缠、不刷屏、不用愧疚感留人。',
    '只输出一个 JSON 对象：{"opening": ["...", "..."], "offer": ["...", "...", "..."], "arrival": ["...", "...", "..."], "persona": "...", "pursuit": "..."}，不要 markdown 代码块标记，不要任何其他文字。',
  ].join('\n');
}

/** 喂给台词写手的角色卡 */
export function buildCharacterLinesUser(c: Character): string {
  const style = loveStyleByLabel(c.loveStyle);
  return [
    '角色卡：',
    `- 名字：${c.name}`,
    `- 人称：${pronounFor(c)}`,
    `- 身份：${c.identity}`,
    ...(c.story ? [`- 背景故事：${c.story}`] : []),
    ...(c.race && c.race !== '人类' ? [`- 种族：${c.race}`] : []),
    ...(c.loveStyle ? [`- 恋爱类型：${c.loveStyle}${style ? `（${style.desc}）` : ''}`] : []),
    ...(c.mbti ? [`- MBTI：${c.mbti.toUpperCase()}`] : []),
    ...(c.catchphrase ? [`- 口癖：${c.catchphrase}`] : []),
    ...(c.likes ? [`- 喜欢：${c.likes}`] : []),
    ...(c.dislikes ? [`- 讨厌：${c.dislikes}`] : []),
    ...(c.chatNotes ? [`- 聊天设定：${c.chatNotes}`] : []),
    ...(c.schedule ? [`- 作息：${c.schedule}`] : []),
    ...(c.initiative ? [`- 主动联系强度：${c.initiative}`] : []),
    ...(c.taboos ? [`- 禁忌：${c.taboos}`] : []),
    ...(c.presetMemories ? [`- 和她的共同记忆：${c.presetMemories.replace(/\n+/g, '；')}`] : []),
    '',
    '请按上面的角色卡，用 TA 的口吻写下 JSON 里要求的台词。',
  ].join('\n');
}

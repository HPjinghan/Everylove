/**
 * 羁绊记忆库的提取（D-016/D-018/D-079/D-085）：系统指令 + 每次提取喂给模型的内容，
 * 以及三种「不是手机聊天」的说明段：外出现场对话、她的记事本。
 */

import { appointmentAtLabel, ON_TIME_TOLERANCE_MIN } from '@/lib/appointments';
import { getLang, type Lang } from '@/lib/i18n';
import type { BondMemory, ChatMessage } from '@/lib/types';

import { langName, todayLine, transcript } from './shared';

/**
 * 记忆整理助手的系统指令；要求只输出 {"facts": [...], "summary": "..."}。
 * facts 带前缀，注入时按前缀分组（见 §1-B memoryBlockFor）：
 *   [她]  她的生活/喜好/近况/她说过的重要的话
 *   [约定] 你们约好的事（含时间）
 *   [答应] TA 答应过她的事
 *   [节点] 重要日期 / 关系里程碑
 */
export function memoryExtractSystem(lang: Lang = getLang()): string {
  return [
  '你是恋爱互动应用里「TA」（虚构角色）的记忆整理助手。根据对话记录维护两样东西，只输出 JSON。',
  '',
  '1. facts：值得长期记住的事实，每条一句话、具体、第三人称（用「她」和 TA 的名字），不超过 40 字，并以四种前缀之一开头：',
  '   [她] 她的生活与工作、喜好与讨厌、情绪近况、她对 TA 说过的重要的话',
  '   [约定] 你们约好的事，写清时间地点',
  '   [答应] TA 答应过她的事',
  '   [节点] 重要日期（生日、纪念日）与关系里程碑',
  '   规则：',
  `   - facts 与 summary 都用${langName(lang)}写（她用什么语言聊天，记忆就用什么语言）。`,
  '   - 把「现有 facts」和「最近对话」合并：重复的合一条，过时的更新，无关紧要的删掉；[约定] 和 [答应] 排最前，其余按重要性。最多 30 条。',
  '   - 相对时间一律换算成绝对日期（会告诉你今天的日期），例如今天是 2026-08-17 周一，那么「周五」→「2026-08-21 周五」，「下周三」→「2026-08-26 周三」。',
  '   - 只记对话里确实出现的事，不推测、不编造；她提到的其他真实人物只记「她和那个人的关系/发生了什么」，不记对那个人的评价。',
  '   好的例子：[她] 她在一家游戏公司面试三次没过，很想进去 ／ [约定] 2026-08-21 周五晚上一起吃火锅，她不吃香菜 ／ [答应] 沈之言答应火锅不放香菜',
  '   不好的例子：[她] 她很有想法（太泛） ／ [她] 她可能失恋了（对话里没有）',
  '',
  '2. summary：把「已滑出对话窗口的更早对话」和旧 summary 合并成一段不超过 150 字的中文摘要，第三人称，只讲发生了什么、关系走到哪；没有更早对话时原样保留旧 summary（可为空字符串）。',
  '',
  '只输出 JSON，格式：{"facts": ["..."], "summary": "..."}，不要输出任何其他文字或代码块标记。',
  ].join('\n');
}

/** 每次提取时喂给模型的内容 */
export function buildMemoryExtractPrompt(input: {
  hisName: string;
  nickname: string;
  memory: BondMemory;
  /** 已滑出对话窗口、还没并进 summary 的更早消息 */
  aged: ChatMessage[];
  /** 上次提取之后的新消息 */
  recent: ChatMessage[];
  /** 今天：用于把相对时间换算成绝对日期 */
  today?: string;
  /** 外出（D-079）：这段对话不是手机聊天而是一次见面的现场——说明它是什么、该怎么记（outingMemoryContext） */
  context?: string;
}): string {
  const { hisName, nickname, memory, aged, recent, context } = input;
  const today = input.today ?? todayLine();
  return [
    `今天是 ${today}。TA 叫「${hisName}」，TA 叫她「${nickname}」。`,
    `现有 facts（可能为空）：${JSON.stringify(memory.facts)}`,
    `现有 summary（可能为空）：${JSON.stringify(memory.summary)}`,
    aged.length
      ? `已滑出对话窗口的更早对话（请并入 summary）：\n${transcript(aged, hisName)}`
      : '已滑出对话窗口的更早对话：无',
    ...(context ? [context] : []),
    context
      ? `这段内容（请按上面的说明从中提取/更新 facts 与 summary）：\n${transcript(recent, hisName)}`
      : `最近对话（请从中提取/更新 facts）：\n${transcript(recent, hisName)}`,
  ].join('\n\n');
}

/** 外出结束并进记忆时的说明段（D-079）：这是一次赴约 / 偶遇，在哪、什么时候、她准时还是迟到 */
export function outingMemoryContext(o: {
  placeName: string;
  kind: 'date' | 'encounter';
  startedAt: number;
  planAt?: number;
  lateMinutes?: number;
}): string {
  const d = new Date(o.startedAt);
  const when = `${todayLine(d)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const late = o.lateMinutes ?? 0;
  const punctual =
    late > ON_TIME_TOLERANCE_MIN
      ? `她晚到了 ${late} 分钟`
      : late < -ON_TIME_TOLERANCE_MIN
        ? `她早到了 ${-late} 分钟`
        : '她准时到了';
  const how =
    o.kind === 'date'
      ? `这是一次赴约${o.planAt ? `（约的是 ${appointmentAtLabel(o.planAt)}，${punctual}）` : ''}`
      : '这是一次偶遇（没有事先约，恰好都在）';
  return `下面不是手机聊天，而是 TA 和她 ${when} 一起在${o.placeName}的现场对话（（）里是动作与现场）。${how}。请把这次见面里发生的事、她说的重要的话、新冒出来的约定记进 facts（[节点] / [她] / [约定]；赴约要记下她准时还是迟到），并把「这次见面」用一句话并进 summary。`;
}

/** 她让 TA 看的记事本并进记忆时的说明段（D-085）：当作她说的话提取事实（[她]），summary 不动 */
export const NOTES_MEMORY_CONTEXT =
  '下面不是聊天，而是她把手机递给 TA 时 TA 看到的她自己的记事本（她写给自己的话）。请把值得长期记住的事记进 facts（[她]，注明是记事本里写的），summary 原样保留；记事本里提到的其他真实的人只记「她和那个人的关系 / 发生了什么」，不记评价。';

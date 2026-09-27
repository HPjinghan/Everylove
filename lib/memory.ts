/**
 * 羁绊记忆库（D-016）：mem0 式「提取 → 存储 → 注入」，全本地、无后端。
 *
 * 两层记忆：
 * 1. facts —— 关于她 / 关于你们的长期事实条目（名字、喜好、生活、重要事件、约定、共同经历），
 *    每隔几轮由模型从最近对话里提取并与旧条目合并（去重/更新/淘汰），上限 MEMORY_MAX_FACTS 条；
 * 2. summary —— 已滑出 20 轮上下文窗口的更早相处的滚动摘要，保证再久以前的事他也记得个大概。
 *
 * 只在羁绊层（付费）存在：广场层的搭话「几天后过期、他忘记你」是商业承重墙，故意不带记忆。
 * 提取失败/没 key 一律静默放弃，绝不影响聊天本身。正式版服务端代理落地后可整体替换为 mem0 等自托管服务，
 * 对外接口不变（updateBondMemory / bond.memory）。
 */

import { buildMemoryExtractPrompt, memoryExtractSystem, NOTES_MEMORY_CONTEXT, outingMemoryContext } from '@/content/prompts';
import { withoutDark } from '@/lib/dark-side';
import { completeText, HISTORY_ROUNDS } from '@/lib/engine';
import type { BondMemory, ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';
import { createInflight } from '@/lib/inflight';
import { parseJsonObject } from '@/lib/json';

/** 事实条目上限（注入 prompt 的成本可控） */
export const MEMORY_MAX_FACTS = 30;
/** 每隔多少个用户轮次做一次记忆提取（后台、不阻塞聊天） */
export const MEMORY_EVERY_TURNS = 3;

/** 事实条目的归一化（去重比较用）：去空白、去末尾标点、小写 */
const normFact = (f: string) => f.replace(/\s+/g, '').replace(/[。.!！?？]+$/, '').toLowerCase();

/**
 * 合并事实（D-191）：模型返回的是「更新后的全表」，以它为主（顺序也按它）、全表去重；
 * 它这次比旧表少了一半以上（多半只写了新增、漏了旧的）才把旧表没提到的补回来——平时不补，模型有意删掉的过时条目才删得掉。封顶 MEMORY_MAX_FACTS。
 */
export function mergeFacts(old: string[], next: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (f: string) => {
    const k = normFact(f);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(f.trim());
  };
  next.forEach(push);
  if (old.length >= 6 && next.length < old.length / 2) old.forEach(push);
  return out.slice(0, MEMORY_MAX_FACTS);
}

export const EMPTY_MEMORY: BondMemory = {
  facts: [],
  summary: '',
  summarizedUpTo: 0,
  factsUpTo: 0,
  updatedAt: 0,
};

const inflight = createInflight();

/** 找到「最近 HISTORY_ROUNDS 轮」在 messages 里的起点下标（之前的都算已滑出窗口） */
function windowStartIndex(msgs: ChatMessage[]): number {
  let userSeen = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].from === 'me') {
      userSeen++;
      if (userSeen === HISTORY_ROUNDS) return i;
    }
  }
  return 0;
}

function userTurnsBetween(msgs: ChatMessage[], from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to && i < msgs.length; i++) if (msgs[i].from === 'me') n++;
  return n;
}

export function parseMemoryJSON(raw: string): { facts: string[]; summary: string } | null {
  const obj = parseJsonObject<{ facts?: unknown; summary?: unknown }>(raw);
  if (!obj) return null;
  try {
    const facts = Array.isArray(obj.facts)
      ? obj.facts
          .filter((f): f is string => typeof f === 'string')
          .map((f) => f.trim())
          .filter(Boolean)
          .slice(0, MEMORY_MAX_FACTS)
      : [];
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    return { facts, summary };
  } catch {
    return null;
  }
}

/** 是否到了该提取的时候（新的用户轮次 ≥ MEMORY_EVERY_TURNS） */
export function memoryDue(msgs: ChatMessage[], memory: BondMemory | undefined): boolean {
  const m = memory ?? EMPTY_MEMORY;
  return userTurnsBetween(msgs, m.factsUpTo, msgs.length) >= MEMORY_EVERY_TURNS;
}

/**
 * 后台更新某段羁绊的记忆库。可随时调用（幂等、节流、静默失败）。
 * force=true 忽略轮次节流（开发者面板用）。返回是否真的更新了。
 */
export async function updateBondMemory(bondId: string, force = false): Promise<boolean> {
  if (inflight.has(bondId)) return false;
  const state = useAppStore.getState();
  const bond = state.bonds.find((b) => b.id === bondId);
  const character = bond && findCharacter(bond.characterId);
  if (!bond || !character) return false;

  const memory = bond.memory ?? EMPTY_MEMORY;
  const msgs = bond.messages;
  if (!force && !memoryDue(msgs, memory)) return false;

  const winStart = windowStartIndex(msgs);
  // 危机内容不进记忆（D-167，红线 3）：她命中触发词的那句与固定回复都跳过
  const aged = withoutDark(msgs.slice(memory.summarizedUpTo, Math.max(memory.summarizedUpTo, winStart)));
  const recent = withoutDark(msgs.slice(memory.factsUpTo));
  if (!recent.length && !aged.length) return false;

  const userPrompt = buildMemoryExtractPrompt({
    hisName: bond.name,
    nickname: bond.nickname,
    memory,
    aged,
    recent,
  });

  return inflight.run(bondId, async () => {
  try {
    const raw = await completeText(memoryExtractSystem(), userPrompt);
    const parsed = parseMemoryJSON(raw);
    if (!parsed) {
      console.warn('[memory] 提取结果不是合法 JSON，跳过：', raw.slice(0, 120));
      return false;
    }
    // 写回以当下为准（期间外出 / 记事本并入可能写过）
    const latest = useAppStore.getState().bonds.find((b) => b.id === bondId)?.memory ?? memory;
    const next: BondMemory = {
      facts: mergeFacts(latest.facts, parsed.facts),
      summary: aged.length ? parsed.summary : memory.summary || parsed.summary,
      summarizedUpTo: Math.max(memory.summarizedUpTo, winStart),
      factsUpTo: msgs.length,
      updatedAt: Date.now(),
    };
    useAppStore.getState().setBondMemory(bondId, next);
    return true;
  } catch (e) {
    console.warn('[memory] 记忆提取失败，跳过：', e);
    return false;
  }
  }, false);
}

/**
 * 外出结束时（D-079）：把这次赴约 / 偶遇的现场对话并进记忆——TA 记得你们一起去过哪、说过什么，赴约记准时还是迟到。
 * 现场消息不在 bond.messages 里，所以不动 factsUpTo / summarizedUpTo；只换 facts 与 summary。
 */
export async function absorbOutingMemory(
  bondId: string,
  outing: {
    placeName: string;
    kind: 'date' | 'encounter';
    startedAt: number;
    planAt?: number;
    lateMinutes?: number;
    messages: ChatMessage[];
  }
): Promise<boolean> {
  const key = `${bondId}:outing`;
  if (inflight.has(key)) return false;
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  if (!bond) return false;
  const said = withoutDark(outing.messages.filter((m) => m.from !== 'system'));
  if (!said.some((m) => m.from === 'me' && m.kind === 'text')) return false;
  const memory = bond.memory ?? EMPTY_MEMORY;
  const userPrompt = buildMemoryExtractPrompt({
    hisName: bond.name,
    nickname: bond.nickname,
    memory,
    aged: [],
    recent: said,
    context: outingMemoryContext(outing),
  });

  return inflight.run(key, async () => {
  try {
    const raw = await completeText(memoryExtractSystem(), userPrompt);
    const parsed = parseMemoryJSON(raw);
    if (!parsed) {
      console.warn('[memory] 外出记忆结果不是合法 JSON，跳过：', raw.slice(0, 120));
      return false;
    }
    // 写回以当下为准（期间常规提取可能写过），只替换 facts / summary
    const latest = useAppStore.getState().bonds.find((b) => b.id === bondId)?.memory ?? memory;
    useAppStore.getState().setBondMemory(bondId, {
      ...latest,
      facts: mergeFacts(latest.facts, parsed.facts),
      summary: parsed.summary || latest.summary,
      updatedAt: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('[memory] 外出记忆并入失败，跳过：', e);
    return false;
  }
  }, false);
}

/** 她让 TA 看的记事本（D-085）：当作她说的话提取事实（[她]），summary 不动 */
export async function absorbNotesMemory(
  bondId: string,
  notes: { at: number; text: string }[]
): Promise<boolean> {
  const key = `${bondId}:notes`;
  if (inflight.has(key) || !notes.length) return false;
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  if (!bond) return false;
  const memory = bond.memory ?? EMPTY_MEMORY;
  const recent: ChatMessage[] = notes.map((n, i) => ({
    id: `note-${i}`,
    from: 'me',
    kind: 'text',
    text: `（记事本 ${new Date(n.at).toLocaleDateString('zh-CN')}）${n.text}`,
    at: n.at,
  }));
  const userPrompt = buildMemoryExtractPrompt({
    hisName: bond.name,
    nickname: bond.nickname,
    memory,
    aged: [],
    recent,
    context: NOTES_MEMORY_CONTEXT,
  });
  return inflight.run(key, async () => {
  try {
    const raw = await completeText(memoryExtractSystem(), userPrompt);
    const parsed = parseMemoryJSON(raw);
    if (!parsed) return false;
    const latest = useAppStore.getState().bonds.find((b) => b.id === bondId)?.memory ?? memory;
    useAppStore.getState().setBondMemory(bondId, { ...latest, facts: mergeFacts(latest.facts, parsed.facts), updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.warn('[memory] 记事本并入失败，跳过：', e);
    return false;
  }
  }, false);
}

/** 直接写一条事实（不经模型；D-079 爽约这类系统确知的事）：放最前、去重、封顶 */
export function addMemoryFact(bondId: string, fact: string): void {
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  if (!bond) return;
  const memory = bond.memory ?? EMPTY_MEMORY;
  const facts = [fact, ...memory.facts.filter((f) => f !== fact)].slice(0, MEMORY_MAX_FACTS);
  useAppStore.getState().setBondMemory(bondId, { ...memory, facts, updatedAt: Date.now() });
}

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

import { buildMemoryExtractPrompt, MEMORY_EXTRACT_SYSTEM } from '@/content/prompts';
import { completeText, HISTORY_ROUNDS } from '@/lib/engine';
import type { BondMemory, ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 事实条目上限（注入 prompt 的成本可控） */
export const MEMORY_MAX_FACTS = 30;
/** 每隔多少个用户轮次做一次记忆提取（后台、不阻塞聊天） */
export const MEMORY_EVERY_TURNS = 3;

export const EMPTY_MEMORY: BondMemory = {
  facts: [],
  summary: '',
  summarizedUpTo: 0,
  factsUpTo: 0,
  updatedAt: 0,
};

const inflight = new Set<string>();

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
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { facts?: unknown; summary?: unknown };
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
  if (state.engine === 'mock') return false;

  const memory = bond.memory ?? EMPTY_MEMORY;
  const msgs = bond.messages;
  if (!force && !memoryDue(msgs, memory)) return false;

  const winStart = windowStartIndex(msgs);
  const aged = msgs.slice(memory.summarizedUpTo, Math.max(memory.summarizedUpTo, winStart));
  const recent = msgs.slice(memory.factsUpTo);
  if (!recent.length && !aged.length) return false;

  const userPrompt = buildMemoryExtractPrompt({
    hisName: bond.name,
    nickname: bond.nickname,
    memory,
    aged,
    recent,
  });

  inflight.add(bondId);
  try {
    const raw = await completeText(MEMORY_EXTRACT_SYSTEM, userPrompt, state.engine, {
      anthropic: state.anthropicKey,
      qianfan: state.qianfanKey,
    });
    const parsed = parseMemoryJSON(raw);
    if (!parsed) {
      console.warn('[memory] 提取结果不是合法 JSON，跳过：', raw.slice(0, 120));
      return false;
    }
    const next: BondMemory = {
      facts: parsed.facts,
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
  } finally {
    inflight.delete(bondId);
  }
}

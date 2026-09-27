/**
 * 消息滚动归档（D-201）：一段会话在 store 里只留最近 ARCHIVE_KEEP 条，更早的搬到各自的 AsyncStorage 键（不进云端快照）。
 * 只搬已经折进记忆摘要的那些（summarizedUpTo 之前）——模型上下文只要最近 20～25 轮，早的都在 summary 里；
 * 超过 ARCHIVE_TRIGGER 条才动一次（一档一档，不每条都写盘）。搬走时记忆的两个下标一起往前挪。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 会话里留多少条 */
export const ARCHIVE_KEEP = 200;
/** 超过多少条才归档 */
export const ARCHIVE_TRIGGER = 260;

const keyOf = (bondId: string) => `everylove-archive:${bondId}`;

/** 算这段该搬走几条：留够 KEEP、且不超过已折进摘要的那些 */
export function archiveCut(messagesLength: number, summarizedUpTo: number, keep = ARCHIVE_KEEP, trigger = ARCHIVE_TRIGGER): number {
  if (messagesLength <= trigger) return 0;
  return Math.max(0, Math.min(messagesLength - keep, summarizedUpTo));
}

/** 启动任务：把该搬的搬走；返回搬了几条 */
export async function archiveOldMessages(): Promise<number> {
  let moved = 0;
  for (const bond of useAppStore.getState().bonds) {
    const cut = archiveCut(bond.messages.length, bond.memory.summarizedUpTo);
    if (!cut) continue;
    const old = bond.messages.slice(0, cut);
    try {
      const raw = await AsyncStorage.getItem(keyOf(bond.id));
      const prev: ChatMessage[] = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
      await AsyncStorage.setItem(keyOf(bond.id), JSON.stringify([...prev, ...old]));
      useAppStore.getState().trimBondMessages(bond.id, cut);
      moved += cut;
    } catch (e) {
      console.warn('[archive] 归档失败，这段跳过：', e);
    }
  }
  if (moved) console.log(`[archive] 归档了 ${moved} 条`);
  return moved;
}

/** 更早的消息（以后「加载更早」用）；没有就空 */
export async function readArchive(bondId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(bondId));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

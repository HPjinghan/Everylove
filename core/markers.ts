/**
 * 回复标记（D-086）：模型在回复末尾写的「系统暗号」——她看不到，落成状态。
 * 现有两枚：[解锁手机]（D-082）、[拆红包]（D-084）。加一枚 = 一个玩法注册一条：mark（暗号原文）+ key + apply（怎么落状态）。
 * 引擎在拆气泡后统一剥掉所有已注册的暗号并置位 reply.flags[key]；回合管线再按 flags 逐个 apply。
 */

import type { ConversationMode, TurnScope } from '@/core/modes';
import { createRegistry } from '@/core/registry';
import type { EngineContext, EngineReply } from '@/lib/types';

export interface MarkerInfo {
  scope: TurnScope;
  ctx: EngineContext;
  mode: ConversationMode;
  /** 带数值的暗号（pattern 的第一个捕获组），如 [心动 7] → '7' */
  value?: string;
  /** 暗号落出来的消息要不要计未读（她不在这个会话页时，如 TA 主动那条带的外卖） */
  unread?: boolean;
}

export interface ReplyMarker {
  /** flags 里的键 */
  key: string;
  /** 模型写的暗号原文，如 '[解锁手机]'；带数值的暗号给 pattern，这里只作说明 */
  mark: string;
  /** 带数值的暗号（D-126 [心动 n]）：第一个捕获组进 reply.values[key]；不带 g 标志 */
  pattern?: RegExp;
  /** 暗号出现时怎么落状态（可读写 store、往会话里追加系统消息） */
  apply(info: MarkerInfo): void | Promise<void>;
}

export const replyMarkers = createRegistry<ReplyMarker>('replyMarkers', (m) => m.key);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 模型偶尔写全角括号【】/［］（D-192）：正则的首尾方括号放宽成三种都认 */
const bracketTolerant = (src: string) => src.replace(/^\\\[/, '[\\[【［]').replace(/\\\]$/, '[\\]】］]');

/** 剥掉所有已注册的暗号并置位；全剥空则留一个省略号（TA 至少要回一声） */
export function stripReplyMarkers(reply: EngineReply): EngineReply {
  let texts = reply.texts;
  const flags: Record<string, boolean> = { ...(reply.flags ?? {}) };
  const values: Record<string, string> = { ...(reply.values ?? {}) };
  let hit = false;
  let valued = false;
  for (const m of replyMarkers.list()) {
    // 首尾括号全角也认；同一暗号写了多次全剥掉，带数值的取第一处（D-192）
    const src = m.pattern ? bracketTolerant(m.pattern.source) : bracketTolerant(escapeRegExp(m.mark));
    const flagsNoG = (m.pattern?.flags ?? '').replace('g', '');
    const first = new RegExp(src, flagsNoG);
    const all = new RegExp(src, flagsNoG + 'g');
    let found: string | undefined;
    for (const t of texts) {
      const mt = first.exec(t);
      if (mt) {
        found = mt[1] ?? '';
        break;
      }
    }
    if (found === undefined) continue;
    texts = texts.map((t) => t.replace(all, '').replace(/ {2,}/g, ' ').trim());
    if (m.pattern) {
      values[m.key] = found;
      valued = true;
    }
    flags[m.key] = true;
    hit = true;
  }
  if (!hit) return reply;
  const cleaned = texts.filter(Boolean);
  return { ...reply, flags, ...(valued ? { values } : {}), texts: cleaned.length ? cleaned : ['……'] };
}

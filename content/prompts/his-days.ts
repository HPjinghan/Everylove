/**
 * TA 自己最近的日子（D-158）：TA 聊天 / 通话 / 外出时知道自己记事本里写过什么、X 上发过什么——
 * 这些是真发生在 TA 身上的事，说到时前后一致，合适时自然带出来；不背诵。
 * 不整本塞进 prompt（Harper：「不希望 prompt 太长，对方提到他自己能知道就行」）：
 *   底：最近 1 条记事本 + 最近 1 条帖（TA 总知道自己今天在干嘛）；
 *   检索：她这句话（连同她上一句）在全部记事本 + 帖子里按词面相似度捞最多 HIS_DAYS_RETRIEVE 条（lib/retrieval.ts，本地、不联网）。
 * 数据：Bond.notes（≤30 条）+ 该角色的帖子（store.posts → ctx.hisPosts，最近 HIS_POSTS_POOL 条）。
 * 记事本模式不带（写本子的用户消息里已有最近几条，D-098）；主动找她的舞台提示不再重复带（D-114 的那两段并到这里）。
 */

import { retrieve } from '@/lib/retrieval';
import type { EngineContext } from '@/lib/types';

/** 帖子候选池：最近几条进 ctx.hisPosts */
export const HIS_POSTS_POOL = 20;
/** 按她的话检索出来的最多几条 */
export const HIS_DAYS_RETRIEVE = 3;
/** 相似度门槛（命中数 / √查询片段数：十来个字的一句话命中一个词就过） */
export const HIS_DAYS_MIN_SCORE = 0.25;
const HIS_DAYS_TEXT_MAX = 90;

interface DayItem {
  at: number;
  kind: 'notebook' | 'post';
  text: string;
}

export function hisDaysBlock(ctx: EngineContext, now: Date): string[] {
  const notes: DayItem[] = (ctx.bond?.notes ?? []).map((n) => ({ at: n.at, kind: 'notebook', text: n.text }));
  const posts: DayItem[] = (ctx.hisPosts ?? []).map((p) => ({ at: p.at, kind: 'post', text: p.text }));
  if (!notes.length && !posts.length) return [];
  // 底：各最近一条
  const picked = new Set<DayItem>();
  if (notes.length) picked.add(notes[notes.length - 1]);
  if (posts.length) picked.add(posts[posts.length - 1]);
  // 检索：她这句、她上一句各查一次（分开查，长句不稀释短句），同一条取高分，合起来最多 HIS_DAYS_RETRIEVE 条
  const prevHer = [...ctx.history].reverse().find((m) => m.from === 'me' && m.text)?.text ?? '';
  const scored = new Map<DayItem, number>();
  for (const q of [ctx.userText, prevHer].filter(Boolean)) {
    for (const r of retrieve(q, [...notes, ...posts], (d) => d.text, { k: HIS_DAYS_RETRIEVE, min: HIS_DAYS_MIN_SCORE })) {
      scored.set(r.item, Math.max(scored.get(r.item) ?? 0, r.score));
    }
  }
  for (const [item] of [...scored].sort((a, b) => b[1] - a[1]).slice(0, HIS_DAYS_RETRIEVE)) picked.add(item);
  const items = [...picked].sort((a, b) => a.at - b.at);
  return [
    "[Your recent days] From your own notebook and posts — things that really happened to you. Stay consistent with them; bring one up only when it fits, don't recite.",
    ...items.map((it) => `- ${dayLabel(it.at, now)} (${it.kind}): ${clip(it.text)}`),
  ];
}

function dayLabel(at: number, now: Date): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diff = Math.round((startOf(now.getTime()) - startOf(at)) / 86400_000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  const d = new Date(at);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clip(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > HIS_DAYS_TEXT_MAX ? `${t.slice(0, HIS_DAYS_TEXT_MAX)}…` : t;
}

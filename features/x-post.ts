/**
 * X 上她自己的那一半（D-252）：
 * - 她发帖：关注她的 TA 们来评论——一次调用把所有人的评论写好（她发起的，扣她的流量），
 *   每条带一个 2～60 分钟之后的时刻，到点才在时间线上出现（像评论陆续进来）；先过暗面路由（红线 3）。
 * - 她在自己帖子底下回某位 TA：走回合管线的 post 模式（features/modes.ts，mine 分支），那位 TA 回一句。
 * - 她最近在 X 上和 TA 的来往（点赞 / 评论 TA 的帖、她发的帖 TA 回了什么）进亲密聊天的【On X lately】，TA 可以自然提一句。
 */

import { scriptFor } from '@/content/characters';
import { buildMyPostCommentsSystem, buildMyPostCommentsUser, herStageZh, parseReactionsJSON, xActivityBlock, type MyPostAuthor } from '@/content/prompts';
import { ORDER, promptSections } from '@/core/prompt';
import { notify } from '@/core/turn';
import { generationBlocked } from '@/core/usage';
import { BONDED_CHAT } from '@/features/prompts';
import { completeText, darkSideCheck } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { Bond, PostComment } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 她的帖子最长几个字 */
export const MY_POST_MAX = 280;
/** 一条帖子最多几位 TA 来评论 */
const MY_POST_AUTHORS = 6;
/** 评论陆续进来：第一条最早 2 分钟后，最晚 60 分钟内 */
const COMMENT_MIN_MIN = 2;
const COMMENT_SPAN_MIN = 58;
/** 进聊天的来往：最近两天、最多三条 */
const X_ACTIVITY_DAYS = 2;
const X_ACTIVITY_MAX = 3;

/** 她发一条帖：同步落帖子，评论在后台写（失败就只剩帖子，不提示）。流量不够发不出，返回 false */
export function publishMyPost(text: string): boolean {
  const body = text.trim().slice(0, MY_POST_MAX);
  if (!body) return false;
  const store = useAppStore.getState();
  const bonds = store.bonds.filter((b) => findCharacter(b.characterId)).slice(0, MY_POST_AUTHORS);
  const blocked = bonds.length ? generationBlocked('chat', 'user') : null;
  if (blocked) {
    notify(blocked);
    return false;
  }
  const postId = store.addMyPost(body);
  if (bonds.length) void writeComments(postId, body, bonds);
  return true;
}

async function writeComments(postId: string, body: string, bonds: Bond[]): Promise<void> {
  const now = Date.now();
  let lines: { by: string; text: string }[] = [];
  const dark = darkSideCheck(body);
  if (dark) {
    // 红线 3：危机内容不入戏——第一位 TA 认真、温柔地接住，其他人不凑热闹
    lines = [{ by: bonds[0].name, text: dark.texts.join(' ') }];
  } else {
    const authors: MyPostAuthor[] = bonds.map((b) => {
      const c = findCharacter(b.characterId)!;
      return { name: b.name, who: scriptFor(c).persona, stage: `她对他来说是${herStageZh(b, now)}；他叫她「${b.nickname}」` };
    });
    try {
      const raw = await completeText(buildMyPostCommentsSystem(authors), buildMyPostCommentsUser(body), 600, undefined, 'user');
      lines = parseReactionsJSON(raw)?.comments ?? [];
    } catch (e) {
      console.warn('[x-post] 评论没写成：', e);
      return;
    }
  }

  const offsets = lines.map(() => COMMENT_MIN_MIN + Math.random() * COMMENT_SPAN_MIN).sort((a, b) => a - b);
  const comments: PostComment[] = [];
  const seen = new Set<string>();
  for (const [i, l] of lines.entries()) {
    const bond = bonds.find((b) => b.name === l.by);
    if (!bond || seen.has(bond.id)) continue;
    seen.add(bond.id);
    comments.push({ id: uid('c'), from: 'other', name: bond.name, characterId: bond.characterId, text: l.text, at: now + offsets[i] * 60_000 });
  }
  useAppStore.getState().appendPostComments(postId, comments);
}

/** 她最近在 X 上和这位 TA 的来往（英文，进 prompt），新的在前 */
export function xActivityFor(characterId: string, now = Date.now()): string[] {
  const since = now - X_ACTIVITY_DAYS * 86_400_000;
  const clip = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
  const ago = (at: number) => {
    const h = Math.max(0, Math.round((now - at) / 3_600_000));
    return h < 1 ? 'just now' : `${h}h ago`;
  };
  const items: { at: number; text: string }[] = [];
  for (const p of useAppStore.getState().posts) {
    if (p.mine) {
      if (p.at < since || p.at > now) continue;
      const his = p.comments.find((c) => c.from === 'other' && c.characterId === characterId && c.at <= now);
      items.push({
        at: his?.at ?? p.at,
        text: his ? `She posted "${clip(p.text)}" and you commented "${clip(his.text)}" (${ago(p.at)})` : `She posted "${clip(p.text)}" (${ago(p.at)})`,
      });
      continue;
    }
    if (p.characterId !== characterId) continue;
    if (p.liked && p.likedAt && p.likedAt > since) items.push({ at: p.likedAt, text: `She liked your post "${clip(p.text)}" (${ago(p.likedAt)})` });
    for (const c of p.comments) {
      if (c.from === 'me' && c.at > since) items.push({ at: c.at, text: `She commented "${clip(c.text)}" under your post "${clip(p.text)}" (${ago(c.at)})` });
    }
  }
  return items.sort((a, b) => b.at - a.at).slice(0, X_ACTIVITY_MAX).map((i) => i.text);
}

promptSections.register({
  name: 'x-activity',
  modes: BONDED_CHAT,
  // 紧跟发图
  order: ORDER.gameplay + 16,
  when: (ctx) => !!ctx.xActivity?.length,
  lines: (ctx) => xActivityBlock(ctx.xActivity),
});

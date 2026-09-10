/**
 * 发帖调度器（D-055）：让 TA 的 X 时间线活着。
 * - 频率遵循 MBTI（MBTI_POSTS_PER_DAY 映射：E 比 I 话多、P 比 J 随性；无 MBTI 默认 1 条/天），间隔 ±35% 抖动
 * - 与心跳同机制：App 启动 / 回前台补投（deliverDuePosts）；错过再久也只补 1 条（时间线不炸屏）
 * - 内容由当前引擎生成（人设 + 追法 + 时段 + 天气 + 羁绊记忆；prompt 见 content/prompts/social.ts），
 *   AI 不可用 / 失败 = 这一条不发（记 warn，下个周期再试；D-069 起没有脚本回落）
 * - 她的影子出现多少按分量（D-099）：每条发前 rollAboutHer 掷硬币；最近发过的几条 + 记事本里的日子一起给模型（不重复、同一个人的生活）
 * - 只有缔结的 TA 发帖（X 只看羁绊层的时间线，D-027）
 * - 别人的互动（D-110）：每条羁绊层的帖子生成一次评论区——TA 身边的人（lib/circle.ts）与其他缔结的 TA 来评论、TA 可回一句；
 *   模型写（social.ts），AI 不可用回落身边人的一两句通用反应；启动 / 回前台 / 打开 X 时补，每次最多几条
 */

import {
  buildCharacterPostSystem,
  buildCharacterPostUserPrompt,
  buildPostReactionsSystem,
  buildPostReactionsUserPrompt,
  parseReactionsJSON,
  type ReactionAuthor,
} from '@/content/prompts';
import { ensureCircle } from '@/lib/circle';
import { completeText, splitBubbles, stripStageDirections } from '@/lib/engine';
import { uid } from '@/lib/format';
import { rollAboutHer } from '@/lib/her-share';
import { getLang, type Lang } from '@/lib/i18n';
import type { Character, Post, PostComment } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/**
 * MBTI → 每天几条帖（试装数值，正式版另调）。
 * 直觉：E（外向）表达欲高于 I；NF（理想主义）爱抒发、SP（体验派）爱直播生活；
 * ISTJ/ISTP 这类沉默型两天才冒一条。
 */
export const MBTI_POSTS_PER_DAY: Record<string, number> = {
  ENFP: 3, ESFP: 3, ENTP: 2.5, ESTP: 2.5,
  ENFJ: 2, ESFJ: 2, ENTJ: 1.5, ESTJ: 1.2,
  INFP: 1.5, ISFP: 1.2, INFJ: 1, INTP: 0.8,
  ISFJ: 0.8, INTJ: 0.6, ISTP: 0.5, ISTJ: 0.5,
};
export const DEFAULT_POSTS_PER_DAY = 1;
/** 发新帖时给模型看最近几条帖 / 几条记事本 */
export const POST_RECENT = 4;

/** 下一条帖子的间隔：24h / 每日条数，±35% 抖动（别像闹钟一样准点发帖） */
export function postIntervalMs(c: Character): number {
  const perDay =
    (c.mbti && MBTI_POSTS_PER_DAY[c.mbti.toUpperCase()]) || DEFAULT_POSTS_PER_DAY;
  const base = (24 * 3600_000) / perDay;
  const jitter = 0.65 + Math.random() * 0.7;
  return Math.round(base * jitter);
}

/** 补投所有到点的帖子；返回发出的条数 */
export async function deliverDuePosts(now = Date.now()): Promise<number> {
  const state = useAppStore.getState();
  let delivered = 0;
  for (const bond of state.bonds) {
    const character = findCharacter(bond.characterId);
    if (!character) continue;
    const due = state.postSchedule[character.id];
    if (!due) {
      // 首次：排第一条的钟，不立刻发（缔结时已有铺设帖，D-020）
      useAppStore.getState().setPostDue(character.id, now + postIntervalMs(character));
      continue;
    }
    if (now < due) continue;
    // 先排下一次的钟：生成失败也不会在每次回前台时反复重试轰炸
    useAppStore.getState().setPostDue(character.id, now + postIntervalMs(character));
    const text = await generatePostText(character, bond.id);
    if (text) {
      useAppStore.getState().addCharacterPost(character.id, bond.id, text);
      delivered++;
    }
  }
  return delivered;
}

/** 引擎生成一条帖子文本；不可用/失败返回 null（这次不发） */
async function generatePostText(character: Character, bondId: string): Promise<string | null> {
  const { bonds, posts } = useAppStore.getState();
  const bond = bonds.find((b) => b.id === bondId);
  const recentPosts = posts.filter((p) => p.characterId === character.id).slice(-POST_RECENT).map((p) => p.text);
  const recentNotes = (bond?.notes ?? []).slice(-POST_RECENT).map((n) => n.text);
  try {
    const raw = await completeText(
      buildCharacterPostSystem(character, bond),
      buildCharacterPostUserPrompt(new Date(), { aboutHer: rollAboutHer(character), recentPosts, recentNotes }),
      200
    );
    const line = stripStageDirections(splitBubbles(raw, 1, character.name))[0];
    return line ? line.slice(0, 140) : null;
  } catch (e) {
    console.warn('[posts] 帖子生成失败，本周期跳过：', e);
    return null;
  }
}

/* ── 别人的互动（D-110） ── */

/** 每次补投最多处理几条帖子（一条 = 一次模型调用） */
export const REACTIONS_PER_RUN = 3;
/** 一条帖子最多请几个人来 */
const REACTION_AUTHORS = 4;

/** AI 不可用时身边人的通用反应（按语言） */
const FALLBACK_REACTIONS: Record<Lang, string[]> = {
  zh: ['哈哈哈哈', '+1', '羡慕了', '你最近怎么样', '啥时候聚一下', '照顾好自己啊', '这条我笑了', '懂了'],
  en: ['hahaha', '+1', 'jealous', 'how have you been', 'when are we hanging out', 'take care of yourself', 'this one got me', 'same'],
  ja: ['ははは', 'それな', 'うらやましい', '最近どう？', 'いつ集まる？', '体に気をつけて', 'これは笑った', 'わかる'],
  ko: ['ㅋㅋㅋㅋ', '+1', '부럽다', '요즘 어때', '언제 한번 모이자', '몸 챙겨', '이건 웃겼다', '인정'],
};

let reactionsInflight = false;

/** 补投所有还没生成过互动的羁绊层帖子（新的在前，每次最多 REACTIONS_PER_RUN 条）；返回处理条数 */
export async function deliverDueReactions(): Promise<number> {
  if (reactionsInflight) return 0;
  reactionsInflight = true;
  let n = 0;
  try {
    const { posts, bonds } = useAppStore.getState();
    const due = posts
      .filter((p) => p.bondId && !p.reacted && bonds.some((b) => b.id === p.bondId))
      .sort((a, b) => b.at - a.at)
      .slice(0, REACTIONS_PER_RUN);
    for (const post of due) {
      await reactToPost(post);
      n++;
    }
  } finally {
    reactionsInflight = false;
  }
  return n;
}

async function reactToPost(post: Post): Promise<void> {
  const state = useAppStore.getState();
  const bond = state.bonds.find((b) => b.id === post.bondId);
  const character = findCharacter(post.characterId);
  if (!bond || !character) return;
  const circle = await ensureCircle(bond.id);
  // 名单：身边的人（打乱取几个）+ 其他缔结的 TA（最多两位）
  const others = state.bonds
    .filter((b) => b.id !== bond.id)
    .map((b) => ({ bond: b, c: findCharacter(b.characterId) }))
    .filter((x): x is { bond: typeof bond; c: Character } => !!x.c)
    .slice(0, 2);
  const shuffled = [...circle].sort(() => Math.random() - 0.5).slice(0, REACTION_AUTHORS - others.length);
  const authors: ReactionAuthor[] = [
    ...shuffled.map((p) => ({ name: p.name, who: `${character.name}的${p.relation}${p.note ? `，${p.note}` : ''}` })),
    ...others.map((o) => ({ name: o.bond.name, who: `${o.c.identity}，和${character.name}是认识的朋友` })),
  ];
  if (!authors.length) {
    useAppStore.getState().addPostComments(post.id, []);
    return;
  }
  const comments: PostComment[] = [];
  const now = Date.now();
  const nameToAuthor = (name: string) => {
    const other = others.find((o) => o.bond.name === name);
    if (other) return { name, characterId: other.c.id };
    const person = circle.find((p) => p.name === name);
    return person ? { name } : null;
  };
  try {
    const raw = await completeText(
      buildPostReactionsSystem(character, authors),
      buildPostReactionsUserPrompt({
        postText: post.text,
        existing: post.comments.map((c) => ({ name: c.from === 'him' ? character.name : c.from === 'me' ? bond.nickname : (c.name ?? ''), text: c.text })),
      }),
      400
    );
    const parsed = parseReactionsJSON(raw);
    if (!parsed) throw new Error('bad json');
    for (const [i, cm] of parsed.comments.slice(0, 3).entries()) {
      const who = nameToAuthor(cm.by);
      if (!who) continue;
      comments.push({ id: uid('c'), from: 'other', text: cm.text, at: now + i, ...who });
    }
    if (parsed.reply && comments.length) {
      comments.push({ id: uid('c'), from: 'him', text: parsed.reply, at: now + comments.length });
    }
  } catch (e) {
    console.warn('[posts] 互动没写成，用通用反应：', e);
    const pool = FALLBACK_REACTIONS[getLang()];
    for (const [i, p] of shuffled.slice(0, 1 + (post.text.length % 2)).entries()) {
      comments.push({ id: uid('c'), from: 'other', name: p.name, text: pool[(post.text.length * 7 + i * 3) % pool.length], at: now + i });
    }
  }
  useAppStore.getState().addPostComments(post.id, comments);
}

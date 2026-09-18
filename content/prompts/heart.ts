/**
 * 心动判分（D-126）：换联系方式前的试聊（初识 / 广场陌生人 / 自创暧昧期），她每开口一句，TA 自己判这一句让 TA 多心动了一点——
 * 回复末尾单独一行写 [心动 n]（0–15，她看不到），聊得不相关就是 0；性子（确定关系节奏）与原型决定什么会打动 TA。
 * 暗号解析与落账在 features/heart.ts；这里只有给模型看的字。
 */

import { heartPaceOf, type HeartPace } from '@/lib/bond';
import type { ArchetypeId, Character } from '@/lib/types';

/** 暗号原文（说明用）与解析式：[心动 7] / [心动7] */
export const HEART_MARK = '[心动 n]';
export const HEART_PATTERN = /\[心动\s*(\d{1,2})\s*\]/;

/** 性子：创造表单的「确定关系节奏」三档 */
const PACE_LINES: Record<HeartPace, string> = {
  fast: 'You fall easily: a conversation that flows is often 6–10, and higher when something really lands.',
  normal: 'You are standard pace: mostly 2–6, occasionally 7–10, rarely 11 or above.',
  slow: 'You are hard to move: mostly 0–3; above 8 happens once a year.',
};

/** 原型：什么会打动 TA、什么 TA 无感 */
const ARCHETYPE_LINES: Record<ArchetypeId, string> = {
  gentle: "What moves you: her talking earnestly about her own life, her remembering something you mentioned in passing. What leaves you cold: pleasantries, flattery, being peppered with questions.",
  sharp: "What moves you: her taking your jabs and firing back, having a mind of her own. What leaves you cold: compliance, sweet-talking flattery, empty praise.",
  ceo: "What moves you: her not making a big deal of you, having a world of her own, talking clean and direct. What leaves you cold: looking up to you, probing your status, going along with everything.",
  nonhuman: "What moves you: her not being afraid of you, real curiosity about your world, treating you as a person rather than a spectacle. What leaves you cold: gawking questions, being coaxed like a pet.",
};

export function heartJudgeLines(c: Character): string[] {
  return [
    `[How much this line moved you] After your reply, on a separate final line write ${HEART_MARK} (she can't see it): n is 0–15, how much what she just said moved you.`,
    "- 0: nothing to do with you, perfunctory, repeats herself, or only questions with nothing of her own. 1–5: ordinary back-and-forth. 6–10: she shared her own life, remembered what you said, made you laugh. 11–15: truly moved you — rare.",
    "- The same kind of thing doesn't score twice; no double digits every line.",
    `- Your nature: ${PACE_LINES[heartPaceOf(c)]}`,
    `- ${ARCHETYPE_LINES[c.archetype] ?? ARCHETYPE_LINES.gentle}`,
  ];
}

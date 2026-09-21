/**
 * 好奇判分（D-126 / D-157）：换联系方式前的试聊（初识 / 广场陌生人 / 自创暧昧期），她每开口一句，TA 自己判这一句让 TA 对她多好奇了几分——
 * 回复末尾单独一行写 [好奇 n]（0–30，她看不到），聊得不相关就是 0；性子（确定关系节奏）与原型决定什么会勾起 TA 的好奇。
 * 满 100 = TA 开口要联系方式，预期 4–8 句（快 ≈4 / 标准 ≈5–6 / 慢 ≈7–8）。暗号解析与落账在 features/heart.ts；这里只有给模型看的字。
 */

import { heartPaceOf, type HeartPace } from '@/lib/bond';
import type { ArchetypeId, Character } from '@/lib/types';

/** 暗号原文（说明用）与解析式：[好奇 22] / [好奇22] */
export const HEART_MARK = '[好奇 n]';
export const HEART_PATTERN = /\[好奇\s*(\d{1,2})\s*\]/;

/** 性子：创造表单的「确定关系节奏」三档 */
const PACE_LINES: Record<HeartPace, string> = {
  fast: 'You get hooked easily: a chat that flows is usually 22–30.',
  normal: 'Standard pace: mostly 16–22, higher only when something really lands.',
  slow: 'Slow to warm up: mostly 14–18; above 22 is rare.',
};

/** 原型：什么会勾起 TA 的好奇、什么 TA 无感 */
const ARCHETYPE_LINES: Record<ArchetypeId, string> = {
  gentle: "What makes you curious: her talking earnestly about her own life, her remembering something you mentioned in passing. What leaves you cold: pleasantries, flattery, being peppered with questions.",
  sharp: "What makes you curious: her taking your jabs and firing back, having a mind of her own. What leaves you cold: compliance, sweet-talking flattery, empty praise.",
  ceo: "What makes you curious: her not making a big deal of you, having a world of her own, talking clean and direct. What leaves you cold: looking up to you, probing your status, going along with everything.",
  nonhuman: "What makes you curious: her not being afraid of you, real curiosity about your world, treating you as a person rather than a spectacle. What leaves you cold: gawking questions, being coaxed like a pet.",
};

export function heartJudgeLines(c: Character): string[] {
  return [
    `[How curious this line made you] After your reply, write ${HEART_MARK} alone on a final line (she can't see it): 0–30, how much this line made you want to know her more.`,
    "- 0: unrelated, perfunctory, repeating herself, or only questions with nothing of her own. 15–20: ordinary back-and-forth. 21–26: a piece of her life, an opinion, a quirk, picking up what you said, making you laugh. 27–30: you really want to know her — rare.",
    '- Repeats of the same kind score less.',
    `- Your nature: ${PACE_LINES[heartPaceOf(c)]}`,
    `- ${ARCHETYPE_LINES[c.archetype] ?? ARCHETYPE_LINES.gentle}`,
  ];
}

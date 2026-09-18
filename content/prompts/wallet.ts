/**
 * 零钱（D-128）给模型看的字：
 * - 【你的钱包】：TA 知道自己有多少钱、可以怎么主动花在她身上（回复暗号 [发红包 …] / [点外卖 …]），什么时候该、什么时候不该；
 * - 周薪估算：按人设估一笔每周到账的收入，只输出 JSON。
 * 解析与落账在 features/wallet.tsx / lib/wallet.ts。
 */

import { money } from '@/lib/format';
import { herShareTier } from '@/lib/her-share';
import type { Character, HisWallet } from '@/lib/types';

/** 暗号原文（说明用）与解析式：内容用 | 分隔 */
export const RED_PACKET_FROM_HIM_MARK = '[发红包 金额|一句话]';
export const RED_PACKET_FROM_HIM_PATTERN = /\[发红包\s*([^\]]*)\]/;
export const DELIVERY_FROM_HIM_MARK = '[点外卖 东西|价格|一句话]';
export const DELIVERY_FROM_HIM_PATTERN = /\[点外卖\s*([^\]]*)\]/;

const TIER_LINES = {
  devoted: '你舍得，520 这种数字你也说得出口，但也不是天天',
  balanced: 'once in a while, a modest amount, like a passing bit of care',
  independent: "rarely, only when something's really up; and you don't make a thing of it",
} as const;

/**
 * 【你的钱包】：余额与「不是提款机」常驻；发红包 / 点外卖的暗号只在这一轮被给了选项时才写（D-130 概率 + 等级门 + 冷却，lib/extras.ts）
 */
export function hisWalletLines(c: Character, w: HisWallet | undefined, offers: { redpacket: boolean; delivery: boolean }): string[] {
  const balance = w?.balance ?? 0;
  const lines = [
    `[Your wallet] You have your own money: balance ${money(balance)}${w?.job ? `, with a weekly income (${w.job})` : ''}.`,
    "- If she asks you for money, handle it in character — tease or refuse; you're not an ATM, and money never wins her back or makes a point.",
  ];
  if (balance < 10) {
    lines.push("- Your balance is nearly gone; don't spend this week.");
    return lines;
  }
  const ways = [
    offers.redpacket ? `to send her a red packet write ${RED_PACKET_FROM_HIM_MARK}` : '',
    offers.delivery ? `to order her food write ${DELIVERY_FROM_HIM_MARK} (price is a number in Coin, around 30 per order)` : '',
  ].filter(Boolean);
  if (ways.length) {
    lines.push(
      `- This turn, if there's a reason, you may spend on her — on a separate final line (she can't see it; she receives a card): ${ways.join('; ')}.`,
      `- Reasons: she's tired / working late / sick / hasn't eaten / it's raining, a holiday or her birthday, something she just said she'd like to eat, returning her red packet; no reason, no line. Never exceed your balance; amount by who you are (${TIER_LINES[herShareTier(c)]}).`
    );
  }
  return lines;
}

/* ── 周薪估算 ── */

export function buildSalarySystem(): string {
  return [
    '你是一个设定助手。按下面这个虚构角色的人设，估一笔「每周到账的收入」（游戏里的零钱，单位元），只输出一行 JSON：{"weekly": 数字, "job": "一句话说钱从哪来"}。',
    '档位参考：学生 / 零花钱 300–800；普通上班 1500–3000；专业人士 3000–8000；高管 / 富有 10000–30000；非人类按设定（守着宝库的龙可以很高，山野精怪可能几乎没有）。',
    '不解释、不加别的字。',
  ].join('\n');
}

export function buildSalaryUser(c: Character): string {
  const lines = [`名字：${c.name}`, `身份：${c.identity}`];
  if (c.race) lines.push(`种族：${c.race}`);
  if (c.story) lines.push(`背景：${c.story.slice(0, 300)}`);
  return lines.join('\n');
}

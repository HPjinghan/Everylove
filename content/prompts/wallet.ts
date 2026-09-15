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
  balanced: '偶尔一次，数目适中，像顺手的关心',
  independent: '很少，除非真有事；给了也不当回事',
} as const;

/**
 * 【你的钱包】：余额与「不是提款机」常驻；发红包 / 点外卖的暗号只在这一轮被给了选项时才写（D-130 概率 + 等级门 + 冷却，lib/extras.ts）
 */
export function hisWalletLines(c: Character, w: HisWallet | undefined, offers: { redpacket: boolean; delivery: boolean }): string[] {
  const balance = w?.balance ?? 0;
  const lines = [
    `【你的钱包】你有自己的钱：余额 ${money(balance)}${w?.job ? `，每周有一笔收入（${w.job}）` : ''}。`,
    '- 她开口要钱：按你的性格处理，可以逗她、可以拒绝，你不是提款机；不用钱哄她回来、不拿钱说事。',
  ];
  if (balance < 10) {
    lines.push('- 余额快见底了，这周先别花。');
    return lines;
  }
  const ways = [
    offers.redpacket ? `给她发红包写 ${RED_PACKET_FROM_HIM_MARK}` : '',
    offers.delivery ? `给她点外卖写 ${DELIVERY_FROM_HIM_MARK}（价格是数字，单位 Coin，30 左右一份）` : '',
  ].filter(Boolean);
  if (ways.length) {
    lines.push(
      `- 这一轮如果有理由，可以主动花在她身上，写在回复最后、单独一行（她看不到这行，她会收到一张卡片）：${ways.join('；')}。`,
      `- 理由：她说累 / 加班 / 生病 / 没吃饭 / 下雨，节日或她的生日，她刚好提到想吃什么，她给你发了红包想还礼；没理由就不写。金额别超过余额，按你的性格和你们的关系拿捏（${TIER_LINES[herShareTier(c)]}）。`
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

/**
 * 亲密度数值体系（D-126）：等级 = XP 门槛 × 天数下限、来源表当天递减 + 日上限、温度线性掉与回温、召回三条、心动判分夹值。
 */
import { describe, expect, it } from 'vitest';

import {
  anniversaryToday,
  clampHeartGain,
  DAY_GATES,
  heartPaceOf,
  legacyBondLevel,
  levelInfoFor,
  levelOf,
  RECALL_DAYS,
  warmthAfter,
  warmthBand,
  warmthNow,
  warmthZeroAt,
  XP_DAILY_CAP,
  xpDayKey,
  xpGain,
  type XpToday,
} from '@/lib/bond';
import { landableRecall } from '@/lib/recall';

const DAY = 24 * 3600_000;
const NOW = new Date(2026, 8, 15, 12, 0).getTime();

describe('等级：XP 门槛 × 天数下限', () => {
  it('累计 100 / 300 / 600 / 1100 / 2000；天数不到停在下一级门口，进度条满格', () => {
    const at = (affinity: number, days: number) => levelOf({ affinity, createdAt: NOW - days * DAY }, NOW);
    expect(at(0, 0)).toBe(1);
    expect(at(100, 0)).toBe(2);
    expect(at(300, 0)).toBe(2); // LV3 要满 3 天
    expect(at(300, 3)).toBe(3);
    expect(at(600, 6)).toBe(3);
    expect(at(600, 7)).toBe(4);
    expect(at(1100, 21)).toBe(5);
    expect(at(2000, 59)).toBe(5);
    expect(at(2000, 60)).toBe(6);
    expect(at(99999, 365)).toBe(6);
    expect(DAY_GATES).toEqual([0, 0, 3, 7, 21, 60]);
    const stuck = levelInfoFor({ affinity: 350, createdAt: NOW }, NOW);
    expect(stuck.level).toBe(2);
    expect(stuck.ratio).toBe(1);
    expect(stuck.gained).toBe(stuck.need);
  });

  it('老存档：等级只升不降（legacyLevel 兜底）', () => {
    // 旧曲线 160 XP = LV3；新曲线 160 = LV2，且才缔结 1 天
    expect(legacyBondLevel(160)).toBe(3);
    expect(levelOf({ affinity: 160, createdAt: NOW - DAY }, NOW)).toBe(2);
    expect(levelOf({ affinity: 160, createdAt: NOW - DAY, legacyLevel: 3 }, NOW)).toBe(3);
    const info = levelInfoFor({ affinity: 160, createdAt: NOW - DAY, legacyLevel: 3 }, NOW);
    expect(info.level).toBe(3);
    expect(info.gained).toBe(0);
  });
});

describe('来源表：当天递减 + 日上限', () => {
  it('文字前 20 次 +5、21–40 次 +2、之后 +1；让 TA 看手机一天只有一次；合计到 150 封顶', () => {
    let today: XpToday | undefined;
    for (let i = 0; i < 20; i++) {
      const r = xpGain('text', today, NOW);
      expect(r.gain).toBe(5);
      today = r.today;
    }
    expect(today!.total).toBe(100);
    expect(xpGain('text', today, NOW).gain).toBe(2);
    let t2 = today;
    for (let i = 0; i < 20; i++) t2 = xpGain('text', t2, NOW).today;
    expect(xpGain('text', t2, NOW).gain).toBe(1);
    expect(xpGain('peekMine', today, NOW).gain).toBe(15);
    const afterPeek = xpGain('peekMine', today, NOW).today;
    expect(xpGain('peekMine', afterPeek, NOW).gain).toBe(0);
    // 日上限：140 + 25（赴约）→ 只给 10
    const near: XpToday = { day: xpDayKey(NOW), total: 140, counts: {} };
    const r = xpGain('date', near, NOW);
    expect(r.gain).toBe(10);
    expect(r.today.total).toBe(XP_DAILY_CAP);
    expect(xpGain('text', r.today, NOW).gain).toBe(0);
  });

  it('4:00 起算一天：凌晨 3 点还是昨天，跨过就清账', () => {
    const late = new Date(2026, 8, 16, 3, 30).getTime();
    const morning = new Date(2026, 8, 16, 4, 30).getTime();
    expect(xpDayKey(late)).toBe('2026-09-15');
    expect(xpDayKey(morning)).toBe('2026-09-16');
    const today: XpToday = { day: '2026-09-15', total: 150, counts: { text: 40 } };
    expect(xpGain('text', today, late).gain).toBe(0);
    expect(xpGain('text', today, morning).gain).toBe(5);
  });
});

describe('温度', () => {
  it('起点 60，每天 −8，最低 0；四档；从 0 回来先落到 30', () => {
    const b = { warmth: 60, warmthAt: NOW };
    expect(warmthNow(b, NOW)).toBe(60);
    expect(warmthNow(b, NOW + 5 * DAY)).toBe(20);
    expect(warmthNow(b, NOW + 30 * DAY)).toBe(0);
    expect(warmthNow({}, NOW)).toBe(60);
    expect(warmthBand(60)).toBe('warm');
    expect(warmthBand(59.9)).toBe('plain');
    expect(warmthBand(29)).toBe('distant');
    expect(warmthBand(0)).toBe('cold');
    expect(warmthAfter(b, 3, NOW)).toEqual({ warmth: 63, returned: false });
    expect(warmthAfter(b, 50, NOW)).toEqual({ warmth: 100, returned: false });
    expect(warmthAfter(b, 3, NOW + 30 * DAY)).toEqual({ warmth: 33, returned: true });
    expect(warmthZeroAt(b, NOW)).toBe(NOW + 7.5 * DAY);
  });
});

describe('召回', () => {
  it('第 7 / 14 / 30 天各一条；只落最近到点的一条', () => {
    expect(RECALL_DAYS).toEqual([7, 14, 30]);
    const items = [
      { due: NOW - 2 * DAY, texts: ['a'] },
      { due: NOW - DAY, texts: ['b'] },
      { due: NOW + DAY, texts: ['c'] },
    ];
    expect(landableRecall({ zeroAt: NOW - 9 * DAY, items }, NOW)?.texts).toEqual(['b']);
    expect(landableRecall({ zeroAt: NOW, items: items.map((i) => ({ ...i, landed: true })) }, NOW)).toBeUndefined();
  });
});

describe('好奇判分 / 纪念日', () => {
  it('夹在 0–30；节奏三档；一百天 / 生日算纪念日', () => {
    expect(clampHeartGain(-3)).toBe(0);
    expect(clampHeartGain(7.6)).toBe(8);
    expect(clampHeartGain(99)).toBe(30);
    expect(clampHeartGain(NaN)).toBe(0);
    expect(heartPaceOf({ offerAfterTurns: 2 })).toBe('fast');
    expect(heartPaceOf({})).toBe('normal');
    expect(heartPaceOf({ offerAfterTurns: 7 })).toBe('slow');
    expect(anniversaryToday({ createdAt: NOW - 100 * DAY }, NOW)).toBe(true);
    expect(anniversaryToday({ createdAt: NOW - 99 * DAY }, NOW)).toBe(false);
    expect(anniversaryToday({ createdAt: NOW - DAY, hisBirthday: '09-15' }, NOW)).toBe(true);
    expect(anniversaryToday({ createdAt: NOW - DAY, herBirthday: '09-16' }, NOW)).toBe(false);
  });
});

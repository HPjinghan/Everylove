/**
 * 日历世界层：节日跟着界面语言走市场（zh 中国 / en 美国 / ja 日本 / ko 韩国），任何年份按规则算，农历按年查表。
 */
import { describe, expect, it } from 'vitest';

import { holidayFor } from '@/content/calendar';
import { setLang } from '@/lib/i18n';

describe('holidayFor · 按市场', () => {
  it('中国：固定日子 + 农历查表，撞在同一天用・连起来', () => {
    expect(holidayFor('2026-10-01', 'zh')).toBe('国庆');
    expect(holidayFor('2027-02-06', 'zh')).toBe('春节');
    expect(holidayFor('2031-10-01', 'zh')).toBe('国庆・中秋');
    expect(holidayFor('2026-05-20', 'zh')).toBe('520');
  });

  it('美国：第 n 个星期几 + 固定日子', () => {
    expect(holidayFor('2026-11-26', 'en')).toBe('Thanksgiving');
    expect(holidayFor('2027-11-25', 'en')).toBe('Thanksgiving');
    expect(holidayFor('2027-05-09', 'en')).toBe("Mother's Day");
    expect(holidayFor('2026-05-25', 'en')).toBe('Memorial Day');
    expect(holidayFor('2027-01-18', 'en')).toBe('Martin Luther King Jr. Day');
    expect(holidayFor('2026-10-31', 'en')).toBe('Halloween');
    expect(holidayFor('2026-10-01', 'en')).toBeUndefined();
  });

  it('日本：Happy Monday、春分 / 秋分近似式、振替休日、国民の休日', () => {
    expect(holidayFor('2027-01-11', 'ja')).toBe('成人の日');
    expect(holidayFor('2026-03-20', 'ja')).toBe('春分の日');
    expect(holidayFor('2026-09-21', 'ja')).toBe('敬老の日');
    expect(holidayFor('2026-09-22', 'ja')).toBe('国民の休日');
    expect(holidayFor('2026-09-23', 'ja')).toBe('秋分の日');
    expect(holidayFor('2026-05-06', 'ja')).toBe('振替休日');
    expect(holidayFor('2027-03-21', 'ja')).toBe('春分の日');
    expect(holidayFor('2027-03-22', 'ja')).toBe('振替休日');
    expect(holidayFor('2027-07-07', 'ja')).toBe('七夕');
    expect(holidayFor('2026-02-14', 'ja')).toBe('バレンタインデー');
  });

  it('韩国：설날 / 추석复用农历表（首尔定朔的差异单列）、대체공휴일', () => {
    expect(holidayFor('2026-09-25', 'ko')).toBe('추석');
    expect(holidayFor('2026-09-24', 'ko')).toBe('추석 연휴');
    expect(holidayFor('2027-02-07', 'ko')).toBe('설날');
    expect(holidayFor('2027-02-09', 'ko')).toBe('대체공휴일');
    expect(holidayFor('2026-03-02', 'ko')).toBe('대체공휴일');
    expect(holidayFor('2026-05-24', 'ko')).toBe('부처님 오신 날');
    expect(holidayFor('2028-10-03', 'ko')).toBe('개천절·추석');
    expect(holidayFor('2028-10-05', 'ko')).toBe('대체공휴일');
    expect(holidayFor('2026-11-11', 'ko')).toBe('빼빼로데이');
  });

  it('缺省读当前界面语言', () => {
    setLang('en');
    expect(holidayFor('2026-12-25')).toBe('Christmas');
    setLang('zh');
    expect(holidayFor('2026-12-25')).toBe('圣诞节');
  });
});

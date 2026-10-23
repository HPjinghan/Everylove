/**
 * 日历（D-020 / D-110）内容：世界层节假日——**跟着界面语言走市场**：
 *   zh → 中国大陆 / en → 美国 / ja → 日本 / ko → 韩国。
 * 名字直接写各市场自己的语言（市场 = 语言，不走 i18n 词典）。每个市场 = 法定节假日 + 恋爱向 / 文化向的日子
 * （情人节、白色情人节、七夕、万圣节、圣诞……），同一天有几个就用该语言的间隔号连起来。
 *
 * 任何年份都有内容（D-110）：
 *   - 公历固定日子按规则（MM-DD）；
 *   - 「第 n 个星期几」按规则（美国感恩节、日本 Happy Monday、母亲节 / 父亲节）；
 *   - 日本春分 / 秋分按通行近似公式算（1980–2099 有效）；
 *   - 农历日子按年查表 LUNAR（2026–2035，之后补表）：中国除夕 / 春节 / 清明 / 端午 / 七夕 / 中秋，
 *     韩国설날三天与추석三天复用同一张表（同为农历正月初一 / 八月十五），但韩国按 UTC+9 定朔，
 *     个别年份설날比春节晚一天，写在 KR_SEOLLAL；부처님 오신 날（农历四月初八）单独一张 KR_BUDDHA。
 * 替休：日本振替休日 + 国民の休日、韩国대체공휴일按规则算；美国 observed 与中国调休不做（世界层只做标记）。
 */

import { getLang, type Lang } from '@/lib/i18n';

type Market = 'CN' | 'US' | 'JP' | 'KR';

const MARKET_OF: Record<Lang, Market> = { zh: 'CN', en: 'US', ja: 'JP', ko: 'KR' };

/** 同一天几个节日之间的间隔号（按市场的书写习惯） */
const JOIN: Record<Market, string> = { CN: '・', US: ' · ', JP: '・', KR: '·' };

/** 农历按年查表（公历 MM-DD，中国定朔 UTC+8）：除夕 / 春节 / 清明（节气，顺带放这里）/ 端午 / 七夕 / 中秋 */
const LUNAR: Record<number, { eve: string; newYear: string; qingming: string; duanwu: string; qixi: string; midAutumn: string }> = {
  2026: { eve: '02-16', newYear: '02-17', qingming: '04-05', duanwu: '06-19', qixi: '08-19', midAutumn: '09-25' },
  2027: { eve: '02-05', newYear: '02-06', qingming: '04-05', duanwu: '06-09', qixi: '08-08', midAutumn: '09-15' },
  2028: { eve: '01-25', newYear: '01-26', qingming: '04-04', duanwu: '05-28', qixi: '08-26', midAutumn: '10-03' },
  2029: { eve: '02-12', newYear: '02-13', qingming: '04-04', duanwu: '06-16', qixi: '08-16', midAutumn: '09-22' },
  2030: { eve: '02-02', newYear: '02-03', qingming: '04-05', duanwu: '06-05', qixi: '08-05', midAutumn: '09-12' },
  2031: { eve: '01-22', newYear: '01-23', qingming: '04-05', duanwu: '06-24', qixi: '08-24', midAutumn: '10-01' },
  2032: { eve: '02-10', newYear: '02-11', qingming: '04-04', duanwu: '06-12', qixi: '08-12', midAutumn: '09-19' },
  2033: { eve: '01-30', newYear: '01-31', qingming: '04-04', duanwu: '06-01', qixi: '08-01', midAutumn: '09-08' },
  2034: { eve: '02-18', newYear: '02-19', qingming: '04-05', duanwu: '06-20', qixi: '08-20', midAutumn: '09-27' },
  2035: { eve: '02-07', newYear: '02-08', qingming: '04-05', duanwu: '06-10', qixi: '08-10', midAutumn: '09-16' },
};

/** 韩国설날与春节不同的年份（正月朔日落在北京时间 23 点后、首尔时间已是次日） */
const KR_SEOLLAL: Record<number, string> = { 2027: '02-07', 2028: '01-27' };

/** 韩国부처님 오신 날（农历四月初八，2031 有闰三月） */
const KR_BUDDHA: Record<number, string> = {
  2026: '05-24', 2027: '05-13', 2028: '05-02', 2029: '05-20', 2030: '05-09',
  2031: '05-28', 2032: '05-16', 2033: '05-06', 2034: '05-25', 2035: '05-15',
};

// ───────── 日期小工具（全部按本地日历日，不碰时区） ─────────

const pad = (n: number) => n.toString().padStart(2, '0');
const mdOf = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (y: number, md: string) => new Date(y, Number(md.slice(0, 2)) - 1, Number(md.slice(3)));
const shift = (y: number, md: string, days: number) => {
  const d = dateOf(y, md);
  d.setDate(d.getDate() + days);
  return mdOf(d);
};
const weekdayOf = (y: number, md: string) => dateOf(y, md).getDay();

/** 某月第 n 个星期几（weekday 0 = 周日；n = -1 为最后一个） */
function nthWeekday(y: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(y, month - 1, 1).getDay();
    return `${pad(month)}-${pad(1 + ((weekday - first + 7) % 7) + (n - 1) * 7)}`;
  }
  const lastDay = new Date(y, month, 0);
  return `${pad(month)}-${pad(lastDay.getDate() - ((lastDay.getDay() - weekday + 7) % 7))}`;
}

/** 日本春分 / 秋分的通行近似式（1980–2099） */
function equinox(y: number, base: number): number {
  return Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

// ───────── 每个市场一年的表 ─────────

interface YearTable {
  /** MM-DD → 当天的节日名（按加入顺序） */
  names: Map<string, string[]>;
  /** 法定休息日（算替休用） */
  off: Set<string>;
}

function makeTable(): YearTable & { add: (md: string | undefined, name: string, off?: boolean) => void } {
  const names = new Map<string, string[]>();
  const off = new Set<string>();
  return {
    names,
    off,
    add(md, name, isOff = false) {
      if (!md) return;
      const list = names.get(md) ?? [];
      list.push(name);
      names.set(md, list);
      if (isOff) off.add(md);
    },
  };
}

function cnYear(y: number): YearTable {
  const t = makeTable();
  t.add('01-01', '元旦', true);
  t.add('02-14', '情人节');
  t.add('03-08', '妇女节');
  t.add('05-01', '劳动节', true);
  t.add('05-20', '520');
  t.add('06-01', '儿童节');
  t.add('10-01', '国庆', true);
  t.add('11-11', '双十一');
  t.add('12-24', '平安夜');
  t.add('12-25', '圣诞节');
  const l = LUNAR[y];
  if (l) {
    t.add(l.eve, '除夕', true);
    t.add(l.newYear, '春节', true);
    t.add(l.qingming, '清明', true);
    t.add(l.duanwu, '端午', true);
    t.add(l.qixi, '七夕');
    t.add(l.midAutumn, '中秋', true);
  }
  return t;
}

function usYear(y: number): YearTable {
  const t = makeTable();
  t.add('01-01', "New Year's Day", true);
  t.add(nthWeekday(y, 1, 1, 3), 'Martin Luther King Jr. Day', true);
  t.add('02-14', "Valentine's Day");
  t.add(nthWeekday(y, 2, 1, 3), "Presidents' Day", true);
  t.add(nthWeekday(y, 5, 0, 2), "Mother's Day");
  t.add(nthWeekday(y, 5, 1, -1), 'Memorial Day', true);
  t.add('06-19', 'Juneteenth', true);
  t.add(nthWeekday(y, 6, 0, 3), "Father's Day");
  t.add('07-04', 'Independence Day', true);
  t.add(nthWeekday(y, 9, 1, 1), 'Labor Day', true);
  t.add('10-31', 'Halloween');
  t.add('11-11', 'Veterans Day', true);
  t.add(nthWeekday(y, 11, 4, 4), 'Thanksgiving', true);
  t.add('12-24', 'Christmas Eve');
  t.add('12-25', 'Christmas', true);
  t.add('12-31', "New Year's Eve");
  return t;
}

function jpYear(y: number): YearTable {
  const t = makeTable();
  // 国民の祝日
  t.add('01-01', '元日', true);
  t.add(nthWeekday(y, 1, 1, 2), '成人の日', true);
  t.add('02-11', '建国記念の日', true);
  t.add('02-23', '天皇誕生日', true);
  t.add(`03-${pad(equinox(y, 20.8431))}`, '春分の日', true);
  t.add('04-29', '昭和の日', true);
  t.add('05-03', '憲法記念日', true);
  t.add('05-04', 'みどりの日', true);
  t.add('05-05', 'こどもの日', true);
  t.add(nthWeekday(y, 7, 1, 3), '海の日', true);
  t.add('08-11', '山の日', true);
  t.add(nthWeekday(y, 9, 1, 3), '敬老の日', true);
  t.add(`09-${pad(equinox(y, 23.2488))}`, '秋分の日', true);
  t.add(nthWeekday(y, 10, 1, 2), 'スポーツの日', true);
  t.add('11-03', '文化の日', true);
  t.add('11-23', '勤労感謝の日', true);
  // 国民の休日：前后两天都是祝日、自己不是祝日的那天（九月敬老の日与秋分の日夹着的一天）
  const holidays = [...t.off].sort();
  for (const md of holidays) {
    const mid = shift(y, md, 1);
    if (!t.off.has(mid) && t.off.has(shift(y, md, 2)) && weekdayOf(y, mid) !== 0) t.add(mid, '国民の休日', true);
  }
  // 振替休日：祝日落在周日 → 之后第一个不是祝日的日子
  for (const md of [...t.off].sort()) {
    if (weekdayOf(y, md) !== 0) continue;
    let next = shift(y, md, 1);
    while (t.off.has(next)) next = shift(y, next, 1);
    t.add(next, '振替休日', true);
  }
  // 恋爱 / 文化的日子
  t.add('02-14', 'バレンタインデー');
  t.add('03-14', 'ホワイトデー');
  t.add('07-07', '七夕');
  t.add('12-24', 'クリスマスイブ');
  t.add('12-25', 'クリスマス');
  t.add('12-31', '大晦日');
  return t;
}

function krYear(y: number): YearTable {
  const t = makeTable();
  t.add('01-01', '신정', true);
  t.add('03-01', '삼일절', true);
  t.add('05-05', '어린이날', true);
  t.add(KR_BUDDHA[y], '부처님 오신 날', true);
  t.add('06-06', '현충일', true);
  t.add('08-15', '광복절', true);
  t.add('10-03', '개천절', true);
  t.add('10-09', '한글날', true);
  t.add('12-25', '크리스마스', true);
  // 대체공휴일（2023 起的规则）：
  //   설날 / 추석 三天里有周日或撞上别的公休日 → 三天之后第一个非公休日；
  //   其余几个（三一 / 儿童 / 佛诞 / 光复 / 开天 / 韩文 / 圣诞）落在周六日或彼此撞在同一天 → 之后第一个非公休日。
  //   一次撞车只补一天；周六也跳过（只补到工作日）。
  const SINGLE = ['03-01', '05-05', KR_BUDDHA[y], '08-15', '10-03', '10-09', '12-25'].filter((md): md is string => !!md);
  const singleOff = new Set(t.off);
  const triggers = new Set<string>();
  for (const md of new Set(SINGLE)) {
    const wd = weekdayOf(y, md);
    if (wd === 0 || wd === 6 || (t.names.get(md)?.length ?? 0) > 1) triggers.add(md);
  }
  // 설날 / 추석：正日与前后各一天，共三天
  const l = LUNAR[y];
  const triple = (md: string | undefined, name: string, around: string) => {
    if (!md) return;
    const days = [shift(y, md, -1), md, shift(y, md, 1)];
    const clash = days.some((d) => singleOff.has(d) || weekdayOf(y, d) === 0);
    // 撞进三天里的单日假期不另补，由这三天一起补一天
    for (const d of days) triggers.delete(d);
    t.add(days[0], around, true);
    t.add(days[1], name, true);
    t.add(days[2], around, true);
    if (clash) triggers.add(days[2]);
  };
  triple(KR_SEOLLAL[y] ?? l?.newYear, '설날', '설날 연휴');
  triple(l?.midAutumn, '추석', '추석 연휴');
  for (const md of [...triggers].sort()) {
    let next = shift(y, md, 1);
    while (t.off.has(next) || weekdayOf(y, next) === 0 || weekdayOf(y, next) === 6) next = shift(y, next, 1);
    t.add(next, '대체공휴일', true);
  }
  // 恋爱 / 文化的日子
  t.add('02-14', '밸런타인데이');
  t.add('03-14', '화이트데이');
  t.add('11-11', '빼빼로데이');
  t.add('12-24', '크리스마스 이브');
  return t;
}

const BUILD: Record<Market, (y: number) => YearTable> = { CN: cnYear, US: usYear, JP: jpYear, KR: krYear };

const cache = new Map<string, YearTable>();

function tableFor(market: Market, y: number): YearTable {
  const key = `${market}-${y}`;
  let table = cache.get(key);
  if (!table) {
    table = BUILD[market](y);
    cache.set(key, table);
  }
  return table;
}

/** 某天的世界层节日（按界面语言对应的市场；缺省读当前语言），没有返回 undefined */
export function holidayFor(dateKey: string, lang: Lang = getLang()): string | undefined {
  const y = Number(dateKey.slice(0, 4));
  const md = dateKey.slice(5);
  const market = MARKET_OF[lang];
  const names = tableFor(market, y).names.get(md);
  return names?.length ? names.join(JOIN[market]) : undefined;
}

/** Date → 'YYYY-MM-DD'（本地时区） */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → 本地 Date（当天 00:00） */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

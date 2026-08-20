/**
 * 日历（D-020）内容：世界层节假日（中文盘 → 中国节日；日语盘上线时按市场换 JP_HOLIDAYS）。
 * 试装硬编码 2026 年；正式版换节假日数据源。
 */

/** YYYY-MM-DD → 节日名（2026，中国大陆常用节日；世界层只做标记，不做调休） */
export const CN_HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '元旦',
  '2026-02-14': '情人节',
  '2026-02-16': '除夕',
  '2026-02-17': '春节',
  '2026-03-08': '妇女节',
  '2026-04-05': '清明',
  '2026-05-01': '劳动节',
  '2026-05-20': '520',
  '2026-06-01': '儿童节',
  '2026-06-19': '端午',
  '2026-07-07': '七夕・小暑',
  '2026-08-19': '七夕',
  '2026-09-25': '中秋',
  '2026-10-01': '国庆',
  '2026-11-11': '双十一',
  '2026-12-24': '平安夜',
  '2026-12-25': '圣诞节',
};

export function holidayFor(dateKey: string): string | undefined {
  return CN_HOLIDAYS_2026[dateKey];
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

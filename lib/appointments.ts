/**
 * 约定的时间语义（D-079）：纯函数，store / prompts / 界面共用（不引 store，避免循环依赖）。
 * 有时间的约定只在「提前 2 小时 ～ 迟到 3 小时」这段窗口内算赴约：窗口内进对应地点 = TA 在等（准时/早到/迟到 TA 都知道）；
 * 窗口过了还没去 = 爽约（lib/outing.ts checkMissedPlans）。没有时间的约定（外出页手动约）随时有效，行为同 D-038。
 */

import { t } from '@/lib/i18n';
import type { OutingPlan } from '@/lib/types';

/** 约定时间之前多久开始算「TA 已经到了」 */
export const APPOINTMENT_EARLY_MS = 2 * 3600_000;
/** 约定时间之后多久还算赴约（再晚就是爽约） */
export const APPOINTMENT_LATE_MS = 3 * 3600_000;
/** 早到 / 迟到多少分钟以内算准时 */
export const ON_TIME_TOLERANCE_MIN = 10;

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad = (n: number) => n.toString().padStart(2, '0');

export function planIsOpen(plan: Pick<OutingPlan, 'at'>, now = Date.now()): boolean {
  if (!plan.at) return true;
  return now >= plan.at - APPOINTMENT_EARLY_MS && now <= plan.at + APPOINTMENT_LATE_MS;
}

export function planIsMissed(plan: Pick<OutingPlan, 'at'>, now = Date.now()): boolean {
  return !!plan.at && now > plan.at + APPOINTMENT_LATE_MS;
}

/** 她相对约定时间晚了几分钟（负数 = 早到） */
export function minutesLate(at: number, now = Date.now()): number {
  return Math.round((now - at) / 60_000);
}

/** 给 prompt 与系统消息用的绝对时间：「9月3日 周三 15:00」 */
export function appointmentAtLabel(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 给界面用的短标签：「今天 15:00」「明天 15:00」「9/3 15:00」 */
export function planTimeLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date(now);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return `${t('今天')} ${clock}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, tomorrow)) return `${t('明天')} ${clock}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${clock}`;
}

/** 解析约定识别输出的「YYYY-MM-DD HH:mm」为本地时间戳；不合法返回 null */
export function parseAppointmentAt(s: string): number | null {
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const at = new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
  return Number.isFinite(at) ? at : null;
}

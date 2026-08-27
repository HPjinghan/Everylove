/**
 * 世界天气（D-036）：无后端，按日期种子的确定性天气——同一天所有界面看到同一个天。
 * 用途：桌面大天气卡；外出模块的场景氛围（进外出模式 prompt）。
 * 正式版可换成真实天气 API（接口保持 todayWeather() 不变）。
 */

export interface DayWeather {
  id: 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'storm' | 'snow' | 'windy';
  label: string;
  emoji: string;
  /** 当天最高 / 最低气温（℃） */
  hi: number;
  lo: number;
  /** 一句给用户看的小文案 */
  line: string;
}

interface Condition {
  id: DayWeather['id'];
  label: string;
  emoji: string;
  line: string;
}

const SUNNY: Condition = { id: 'sunny', label: '晴', emoji: '☀️', line: '适合把自己晒得暖暖的' };
const CLOUDY: Condition = { id: 'cloudy', label: '多云', emoji: '⛅', line: '云在慢慢散步' };
const OVERCAST: Condition = { id: 'overcast', label: '阴', emoji: '☁️', line: '天空今天有点没睡醒' };
const RAIN: Condition = { id: 'rain', label: '小雨', emoji: '🌧️', line: '出门记得带伞' };
const STORM: Condition = { id: 'storm', label: '雷阵雨', emoji: '⛈️', line: '轰隆隆的，别在外面逗留' };
const SNOW: Condition = { id: 'snow', label: '小雪', emoji: '❄️', line: '手别冻着了' };
const WINDY: Condition = { id: 'windy', label: '有风', emoji: '🍃', line: '头发会被吹乱的那种风' };

/** 各月份的天气池（重复出现 = 概率更高）与温度基线（温带城市大致口径） */
const MONTHS: { pool: Condition[]; hi: number; lo: number }[] = [
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, SNOW, WINDY], hi: 5, lo: -4 }, // 1月
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, WINDY], hi: 8, lo: -2 }, // 2月
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY, WINDY], hi: 14, lo: 4 }, // 3月
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY], hi: 20, lo: 9 }, // 4月
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, OVERCAST], hi: 26, lo: 15 }, // 5月
  { pool: [SUNNY, CLOUDY, RAIN, RAIN, STORM], hi: 30, lo: 20 }, // 6月
  { pool: [SUNNY, SUNNY, CLOUDY, STORM, RAIN], hi: 33, lo: 24 }, // 7月
  { pool: [SUNNY, SUNNY, CLOUDY, STORM, OVERCAST], hi: 32, lo: 23 }, // 8月
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY], hi: 27, lo: 17 }, // 9月
  { pool: [SUNNY, SUNNY, CLOUDY, OVERCAST, WINDY], hi: 20, lo: 10 }, // 10月
  { pool: [SUNNY, CLOUDY, OVERCAST, RAIN, WINDY], hi: 12, lo: 3 }, // 11月
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, WINDY], hi: 6, lo: -2 }, // 12月
];

/** 字符串 → 稳定正整数（FNV-1a 简化版） */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 某一天的天气（确定性：同一天怎么看都是同一个天） */
export function weatherFor(date: Date): DayWeather {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const m = MONTHS[date.getMonth()];
  const h = hash(key);
  const cond = m.pool[h % m.pool.length];
  // 温度在基线上 ±3 浮动，最高最低各自摆动但保持间距
  const hi = m.hi + ((h >> 3) % 7) - 3;
  const lo = Math.min(hi - 3, m.lo + ((h >> 7) % 7) - 3);
  return { ...cond, hi, lo };
}

export function todayWeather(now: Date = new Date()): DayWeather {
  return weatherFor(now);
}

/** 此刻的体感温度：清晨贴近最低、午后贴近最高（简单正弦插值） */
export function tempNow(w: DayWeather, now: Date = new Date()): number {
  const hour = now.getHours() + now.getMinutes() / 60;
  // 5 点最低，14 点最高
  const t = Math.cos(((hour - 14) / 24) * 2 * Math.PI) * 0.5 + 0.5;
  return Math.round(w.lo + (w.hi - w.lo) * t);
}

/** 给 prompt 的一句话：「今天多云，气温 23℃ 上下」 */
export function weatherLine(now: Date = new Date()): string {
  const w = todayWeather(now);
  return `今天${w.label}，气温 ${tempNow(w, now)}℃ 上下`;
}

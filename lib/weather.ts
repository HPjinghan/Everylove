/**
 * 天气（D-036/D-061/D-065 真实化）：Open-Meteo（免费、无 key）——当前天气 + 7 日预报 + 地理编码搜索。
 * - 位置：定位或搜索设定（城市名 + 经纬度），只存本机、只用于取天气，不进任何我们的服务端
 * - 缓存 30 分钟（AsyncStorage），离线用缓存
 * - 没设位置 / 从未取到数据：回落「世界天气」（按日期+城市种子的确定性生成，D-036 的老机制）
 * 同步接口（todayWeather/tempNow/weatherLine/weatherFor）保持不变——UI 与外出 prompt 零改动。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'everylove-weather-v2';
const REFRESH_MS = 30 * 60_000;

export interface DayWeather {
  id: 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'storm' | 'snow' | 'windy' | 'fog' | 'drizzle';
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
const FOG: Condition = { id: 'fog', label: '雾', emoji: '🌫️', line: '十米开外全靠缘分' };
const DRIZZLE: Condition = { id: 'drizzle', label: '毛毛雨', emoji: '🌦️', line: '不打伞也没关系的那种雨' };
const RAIN: Condition = { id: 'rain', label: '雨', emoji: '🌧️', line: '出门记得带伞' };
const STORM: Condition = { id: 'storm', label: '雷阵雨', emoji: '⛈️', line: '轰隆隆的，别在外面逗留' };
const SNOW: Condition = { id: 'snow', label: '雪', emoji: '❄️', line: '手别冻着了' };
const WINDY: Condition = { id: 'windy', label: '有风', emoji: '🍃', line: '头发会被吹乱的那种风' };

/** WMO 天气码 → 条件（Open-Meteo 的 weather_code） */
function conditionForWmo(code: number): Condition {
  if (code === 0) return SUNNY;
  if (code <= 2) return CLOUDY;
  if (code === 3) return OVERCAST;
  if (code === 45 || code === 48) return FOG;
  if (code >= 51 && code <= 57) return DRIZZLE;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return RAIN;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return SNOW;
  if (code >= 95) return STORM;
  return CLOUDY;
}

/* ────────────── 位置与真实数据（模块态 + 本机持久化） ────────────── */

interface RealDaily {
  /** YYYY-MM-DD */
  date: string;
  code: number;
  hi: number;
  lo: number;
}

interface WeatherState {
  city: string;
  lat: number | null;
  lon: number | null;
  currentTemp: number | null;
  currentCode: number | null;
  daily: RealDaily[];
  fetchedAt: number;
}

let st: WeatherState = {
  city: '',
  lat: null,
  lon: null,
  currentTemp: null,
  currentCode: null,
  daily: [],
  fetchedAt: 0,
};

function save(): void {
  void AsyncStorage.setItem(STORE_KEY, JSON.stringify(st)).catch(() => {});
}

/** 启动时恢复 + 尝试刷新（app/_layout.tsx 调一次） */
export async function initWeather(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw) st = { ...st, ...JSON.parse(raw) };
  } catch {}
  void refreshWeather();
}

export function weatherCity(): string {
  return st.city;
}

/** 是否已经在用真实天气数据 */
export function weatherIsReal(): boolean {
  return st.daily.length > 0;
}

export function setWeatherPlace(city: string, lat: number, lon: number): void {
  st = { ...st, city: city.trim(), lat, lon, fetchedAt: 0 };
  save();
  void refreshWeather(true);
}

/** 拉真实天气（30 分钟节流；失败静默——继续用缓存或世界天气） */
export async function refreshWeather(force = false): Promise<boolean> {
  if (st.lat == null || st.lon == null) return false;
  if (!force && Date.now() - st.fetchedAt < REFRESH_MS) return true;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}` +
      '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&timezone=auto&forecast_days=7';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };
    const time = data.daily?.time ?? [];
    st = {
      ...st,
      currentTemp: data.current?.temperature_2m ?? null,
      currentCode: data.current?.weather_code ?? null,
      daily: time.map((date, i) => ({
        date,
        code: data.daily?.weather_code?.[i] ?? 0,
        hi: Math.round(data.daily?.temperature_2m_max?.[i] ?? 0),
        lo: Math.round(data.daily?.temperature_2m_min?.[i] ?? 0),
      })),
      fetchedAt: Date.now(),
    };
    save();
    return true;
  } catch (e) {
    console.warn('[weather] 刷新失败（用缓存/世界天气）：', e);
    return false;
  }
}

export interface PlaceHit {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

/** 地区搜索（Open-Meteo 地理编码，免费无 key；中文/英文/日文都认） */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search?count=5&language=zh&name=' +
    encodeURIComponent(query.trim());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const data = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  return (data.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(' · '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/* ────────────── 世界天气回落（D-036 老机制：日期+城市种子） ────────────── */

const FAKE_MONTHS: { pool: Condition[]; hi: number; lo: number }[] = [
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, SNOW, WINDY], hi: 5, lo: -4 },
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, WINDY], hi: 8, lo: -2 },
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY, WINDY], hi: 14, lo: 4 },
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY], hi: 20, lo: 9 },
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, OVERCAST], hi: 26, lo: 15 },
  { pool: [SUNNY, CLOUDY, RAIN, RAIN, STORM], hi: 30, lo: 20 },
  { pool: [SUNNY, SUNNY, CLOUDY, STORM, RAIN], hi: 33, lo: 24 },
  { pool: [SUNNY, SUNNY, CLOUDY, STORM, OVERCAST], hi: 32, lo: 23 },
  { pool: [SUNNY, SUNNY, CLOUDY, RAIN, WINDY], hi: 27, lo: 17 },
  { pool: [SUNNY, SUNNY, CLOUDY, OVERCAST, WINDY], hi: 20, lo: 10 },
  { pool: [SUNNY, CLOUDY, OVERCAST, RAIN, WINDY], hi: 12, lo: 3 },
  { pool: [SUNNY, CLOUDY, OVERCAST, SNOW, WINDY], hi: 6, lo: -2 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function fakeWeatherFor(date: Date): DayWeather {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${st.city}`;
  const m = FAKE_MONTHS[date.getMonth()];
  const h = hash(key);
  const cond = m.pool[h % m.pool.length];
  const hi = m.hi + ((h >> 3) % 7) - 3;
  const lo = Math.min(hi - 3, m.lo + ((h >> 7) % 7) - 3);
  return { ...cond, hi, lo };
}

/* ────────────── 对外接口（真实优先，回落世界天气） ────────────── */

function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** 某一天的天气：命中真实预报用真实，否则世界天气 */
export function weatherFor(date: Date): DayWeather {
  const real = st.daily.find((d) => d.date === dateKeyOf(date));
  if (real) {
    const cond = conditionForWmo(real.code);
    return { ...cond, hi: real.hi, lo: real.lo };
  }
  return fakeWeatherFor(date);
}

export function todayWeather(now: Date = new Date()): DayWeather {
  return weatherFor(now);
}

/** 此刻气温：真实当前温度优先；否则按时刻在最高/最低间插值 */
export function tempNow(w: DayWeather, now: Date = new Date()): number {
  if (st.currentTemp != null && st.daily.some((d) => d.date === dateKeyOf(now))) {
    return Math.round(st.currentTemp);
  }
  const hour = now.getHours() + now.getMinutes() / 60;
  const t = Math.cos(((hour - 14) / 24) * 2 * Math.PI) * 0.5 + 0.5;
  return Math.round(w.lo + (w.hi - w.lo) * t);
}

/** 给 prompt 的一句话：「今天多云，气温 23℃ 上下」 */
export function weatherLine(now: Date = new Date()): string {
  const w = todayWeather(now);
  return `今天${w.label}，气温 ${tempNow(w, now)}℃ 上下`;
}

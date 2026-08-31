import { stageName } from '@/lib/bond';
import { getLang, t } from '@/lib/i18n';

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(1, Math.floor((now - at) / 1000));
  if (s < 60) return t('刚刚');
  const m = Math.floor(s / 60);
  if (m < 60) return t('{n} 分钟前', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('{n} 小时前', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('{n} 天前', { n: d });
  const locale = getLang() === 'zh' ? 'zh-CN' : getLang() === 'ja' ? 'ja-JP' : 'en-US';
  return new Date(at).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
}

export function clockTime(at: number): string {
  const d = new Date(at);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 热度数字（D-032：原「N 人领养」改为小火苗 + 热度；火苗图标由界面渲染） */
export function heatLabel(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return `${Math.max(0, n)}`;
}

/** 语音占位时长：按文字长度估一个自然的秒数 */
export function voiceDuration(text: string): string {
  const sec = Math.min(59, Math.max(2, Math.round(text.length / 4)));
  return `0:${sec.toString().padStart(2, '0')}`;
}

/** 亲密度阶段名（现由羁绊等级成长曲线推导，D-029；prompt 与界面共用） */
export function affinityStage(affinity: number): string {
  return stageName(affinity);
}

export function daysTogether(createdAt: number, now = Date.now()): number {
  return Math.max(1, Math.floor((now - createdAt) / 86400000) + 1);
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter = (idCounter + 1) % 10000;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(
    Math.random() * 1e6
  ).toString(36)}`;
}

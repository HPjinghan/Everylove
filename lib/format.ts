export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(1, Math.floor((now - at) / 1000));
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export function clockTime(at: number): string {
  const d = new Date(at);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function adoptedCountLabel(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万人领养`;
  if (n <= 0) return '尚无人领养';
  return `${n} 人领养`;
}

/** 语音占位时长：按文字长度估一个自然的秒数 */
export function voiceDuration(text: string): string {
  const sec = Math.min(59, Math.max(2, Math.round(text.length / 4)));
  return `0:${sec.toString().padStart(2, '0')}`;
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

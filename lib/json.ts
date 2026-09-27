/**
 * 模型输出里抠 JSON（D-188）：第一个 { 到最后一个 } 之间当作对象解析；抠不出 / 解析失败 → null。
 * 记忆提取、约定识别、身边的人、TA 的日程、X 评论、台词、描述导入七处共用，别再各写一份。
 */
export function parseJsonObject<T = Record<string, unknown>>(raw: string): T | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

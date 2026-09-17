/**
 * 纯文本小工具（无依赖，content/ 与 lib/ 都能引）。
 * D-145（Harper：「真人不这样，模型很难理解，我们前端直接删除」）：TA 说的每条气泡去掉末尾的句号——
 * 只去最后一个「。」或「.」，问号 / 叹号 / 省略号不动，「...」「…」不动，小数点不动；引号 / 括号收尾的也去里面那个句号。
 */

const TRAILING_PERIOD = /(?<![.。…])[。.](?=[」』"”'’）)]*$)/;

export function stripTrailingPeriod(text: string): string {
  const t = text.trimEnd();
  return t.replace(TRAILING_PERIOD, '');
}

export function stripTrailingPeriods(texts: string[]): string[] {
  return texts.map(stripTrailingPeriod);
}

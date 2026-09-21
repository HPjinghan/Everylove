/**
 * 本地检索（D-158）：不用 embedding、不联网——把她这句话和候选文本都切成词面片段（中文两字一组、拉丁词按空格），
 * 按「她这句话里有几个片段在这条里出现过」打分（除以查询片段数的平方根：短句一个词就够、长句要多命中）。
 * 够用的场景：她提到 TA 记事本 / 帖子里说过的东西（「桂花开了吗」「老周那本书」）。
 * 接口只吃 (query, items) 出排名，正式版换 embedding 只换 `similarity`，调用方不动。
 */

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/;

/** 时间词与虚词片段不算命中（「今天」「了吗」这种谁的话里都有） */
const STOP = new Set(
  '今天 明天 昨天 现在 晚上 早上 中午 下午 时候 了吗 的吗 是不 不是 什么 怎么 这个 那个 一个 没有 就是 可以 然后 还是 但是 因为 所以 有点 一下 一直 感觉 觉得 知道 真的 好像 我们 你们 他们 我的 你的 回来 回去 出去 回家 一样 这样 那样 这么 那么 已经 还有 或者 如果 的话 起来 下来 过来 出来 呢吗 啊啊 哈哈'.split(' ')
);

/** 词面片段：连续 CJK 每两字一组（重叠）；其余按非字母数字切、小写、≥2 字符 */
export function shingles(text: string): Set<string> {
  const out = new Set<string>();
  let run = '';
  const flushRun = () => {
    if (run.length === 1 && !STOP.has(run)) out.add(run);
    for (let i = 0; i + 1 < run.length; i++) {
      const s = run.slice(i, i + 2);
      if (!STOP.has(s)) out.add(s);
    }
    run = '';
  };
  let word = '';
  const flushWord = () => {
    if (word.length >= 2) out.add(word.toLowerCase());
    word = '';
  };
  for (const ch of text) {
    if (CJK.test(ch)) {
      flushWord();
      run += ch;
    } else {
      flushRun();
      if (/[\p{L}\p{N}]/u.test(ch)) word += ch;
      else flushWord();
    }
  }
  flushRun();
  flushWord();
  return out;
}

/** 命中的片段数 / √查询片段数：短句命中一个词就过线，长句得多命中几个 */
export function similarity(query: Set<string>, candidate: Set<string>): number {
  if (!query.size || !candidate.size) return 0;
  let hit = 0;
  for (const s of query) if (candidate.has(s)) hit++;
  return hit / Math.sqrt(query.size);
}

export interface Retrieved<T> {
  item: T;
  score: number;
}

/** 分数 ≥ min 的按分数取前 k 个 */
export function retrieve<T>(query: string, items: T[], textOf: (t: T) => string, opts: { k: number; min: number }): Retrieved<T>[] {
  const q = shingles(query);
  if (!q.size) return [];
  return items
    .map((item) => ({ item, score: similarity(q, shingles(textOf(item))) }))
    .filter((r) => r.score >= opts.min)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.k);
}

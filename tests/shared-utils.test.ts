/**
 * 公共件（D-188）：JSON 抠取、同 key 单飞、按 MBTI 定频。
 */
import { describe, expect, it } from 'vitest';

import { createInflight } from '@/lib/inflight';
import { parseJsonObject } from '@/lib/json';
import { jitteredIntervalMs, mbtiAxis, perDayOf } from '@/lib/schedule';

describe('parseJsonObject', () => {
  it('抠出前后有废话的对象；不是对象 / 坏 JSON → null', () => {
    expect(parseJsonObject('好的：{"a":1}\n（完）')).toEqual({ a: 1 });
    expect(parseJsonObject('没有花括号')).toBeNull();
    expect(parseJsonObject('{"a":')).toBeNull();
  });
});

describe('createInflight', () => {
  it('同 key 在跑时直接返回 skip；跑完放开', async () => {
    const f = createInflight();
    let resolve!: () => void;
    const p = f.run('k', () => new Promise<string>((r) => { resolve = () => r('done'); }), 'skip');
    expect(f.has('k')).toBe(true);
    expect(await f.run('k', async () => 'second', 'skip')).toBe('skip');
    resolve();
    expect(await p).toBe('done');
    expect(f.has('k')).toBe(false);
    expect(await f.run('k', async () => 'third', 'skip')).toBe('third');
  });
  it('fn 抛错也放开', async () => {
    const f = createInflight();
    await expect(f.run('k', async () => { throw new Error('x'); }, 0)).rejects.toThrow('x');
    expect(f.has('k')).toBe(false);
  });
});

describe('schedule', () => {
  it('perDayOf 按表、不认识回落；jitteredIntervalMs = 24h / 次数 × 0.65～1.35', () => {
    expect(perDayOf('enfp', { ENFP: 3 }, 1)).toBe(3);
    expect(perDayOf(undefined, { ENFP: 3 }, 1)).toBe(1);
    expect(jitteredIntervalMs(2, 0)).toBe(Math.round(12 * 3600_000 * 0.65));
    expect(jitteredIntervalMs(2, 1)).toBe(Math.round(12 * 3600_000 * 1.35));
    expect(mbtiAxis(' infp')).toBe('I');
    expect(mbtiAxis('ESTJ')).toBe('E');
    expect(mbtiAxis('')).toBeUndefined();
  });
});

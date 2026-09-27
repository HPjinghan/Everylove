/**
 * 同一个 key 同时只跑一份（D-188）：在跑就直接返回 skip，跑完自动放开。
 * 记忆 / 主动 / 召回 / 周薪 / 记事本 / 身边的人 / 作息 / 心跳原来各自手写的 Set 收成这一个。
 */
export interface Inflight {
  has(key: string): boolean;
  run<T>(key: string, fn: () => Promise<T>, skip: T): Promise<T>;
}

export function createInflight(): Inflight {
  const keys = new Set<string>();
  return {
    has: (key) => keys.has(key),
    async run(key, fn, skip) {
      if (keys.has(key)) return skip;
      keys.add(key);
      try {
        return await fn();
      } finally {
        keys.delete(key);
      }
    },
  };
}

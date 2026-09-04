/**
 * 注册表——底座的基本件（D-086）。
 * 借自 Cordis 的两条：「注册即效果、可撤销」与「同 key 后装覆盖先装」。
 * - register 返回撤销函数：测试里重置、按开关关掉某个玩法、将来热重载都靠它；
 * - 同 key 再注册 = 覆盖（后装的插件替换先装的，位置不变）；
 * - list() 按注册顺序返回，顺序由 features/index.ts 的 import 顺序决定，确定可复现。
 */

export type Disposer = () => void;

export interface Registry<T> {
  readonly label: string;
  register(item: T): Disposer;
  get(key: string): T | undefined;
  has(key: string): boolean;
  list(): T[];
  clear(): void;
}

export function createRegistry<T>(label: string, keyOf: (item: T) => string): Registry<T> {
  const items = new Map<string, T>();
  return {
    label,
    register(item) {
      const key = keyOf(item);
      items.set(key, item);
      return () => {
        if (items.get(key) === item) items.delete(key);
      };
    },
    get: (key) => items.get(key),
    has: (key) => items.has(key),
    list: () => [...items.values()],
    clear: () => items.clear(),
  };
}

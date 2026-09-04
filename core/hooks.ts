/**
 * 钩子——回合管线上的扩展点（D-086）。
 * 借自 Cordis 的「类型化事件 + 分发模式」，只保留这个 App 用得上的两种：
 * - emit：观察者，按注册顺序逐个执行（await），单个失败只记 warn，不影响回合本身；
 * - waterfall：流水，每个监听者拿到上一个的产出并可改写（例：把最后一条气泡改成语音）。
 * 不做通用事件总线：钩子点是具名、带类型的（见 core/turn.ts 的 turnHooks），加一个钩子点 = 加一个导出。
 */

import type { Disposer } from '@/core/registry';

type MaybePromise<T> = T | Promise<T>;

export interface EmitHook<A extends unknown[]> {
  on(fn: (...args: A) => MaybePromise<void>): Disposer;
  emit(...args: A): Promise<void>;
  clear(): void;
}

export function createEmitHook<A extends unknown[]>(label: string): EmitHook<A> {
  const fns: ((...args: A) => MaybePromise<void>)[] = [];
  return {
    on(fn) {
      fns.push(fn);
      return () => {
        const i = fns.indexOf(fn);
        if (i >= 0) fns.splice(i, 1);
      };
    },
    async emit(...args) {
      for (const fn of [...fns]) {
        try {
          await fn(...args);
        } catch (e) {
          console.warn(`[hook:${label}] 监听者出错（已跳过）：`, e);
        }
      }
    },
    clear: () => {
      fns.length = 0;
    },
  };
}

export interface WaterfallHook<V, A extends unknown[]> {
  on(fn: (value: V, ...args: A) => MaybePromise<V>): Disposer;
  run(value: V, ...args: A): Promise<V>;
  clear(): void;
}

export function createWaterfallHook<V, A extends unknown[]>(label: string): WaterfallHook<V, A> {
  const fns: ((value: V, ...args: A) => MaybePromise<V>)[] = [];
  return {
    on(fn) {
      fns.push(fn);
      return () => {
        const i = fns.indexOf(fn);
        if (i >= 0) fns.splice(i, 1);
      };
    },
    async run(value, ...args) {
      let cur = value;
      for (const fn of [...fns]) {
        try {
          cur = await fn(cur, ...args);
        } catch (e) {
          console.warn(`[hook:${label}] 监听者出错（保留上一步产出）：`, e);
        }
      }
      return cur;
    },
    clear: () => {
      fns.length = 0;
    },
  };
}

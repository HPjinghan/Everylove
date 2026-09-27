/**
 * 后台任务（D-086）：App 启动 / 回前台时要跑的东西——发帖调度、TA 的记事本、心跳、爽约检查、天气……
 * 一个调度器 = 一条注册（id + 触发时机 + run）。根布局只调 runJobs('launch') / runJobs('foreground')，
 * 加一个「TA 主动来找你」的调度器不再改 _layout。任务各自兜错，一个失败不拖累别的；
 * 最多 JOB_CONCURRENCY 个同时跑（D-176：冷启动十来个任务一起打模型 = 并发风暴），回前台不到 FOREGROUND_MIN_GAP_MS 不重跑。
 */

import { createRegistry } from '@/core/registry';

/** 启动 / 回前台，以及界面打开某个 App 时的补投（D-187：他的手机 / X / 日历），界面只调 runJobs 不直接调各 lib */
export type JobTrigger = 'launch' | 'foreground' | 'screen:phone' | 'screen:x' | 'screen:calendar';

/** 屏幕触发时的上下文：打开的是哪段羁绊的手机 */
export interface JobContext {
  bondId?: string;
}

export interface Job {
  id: string;
  /** 在哪些时机跑 */
  on: readonly JobTrigger[];
  /** 返回值不用（可以是条数、Promise……），异步的会被 await */
  run(now: number, trigger: JobTrigger, ctx: JobContext): unknown;
}

export const jobs = createRegistry<Job>('jobs', (j) => j.id);

/** 同时最多跑几个任务（D-176） */
export const JOB_CONCURRENCY = 2;
/** 回前台节流（D-176）：上一轮（启动或回前台）开始不到这么久，回前台不重跑；启动总是跑 */
export const FOREGROUND_MIN_GAP_MS = 3 * 60_000;

let lastRunAt = 0;

/** 测试用：清掉节流记忆 */
export function resetJobsThrottle(): void {
  lastRunAt = 0;
}

export async function runJobs(trigger: JobTrigger, now = Date.now(), ctx: JobContext = {}): Promise<void> {
  if (trigger === 'foreground' && now - lastRunAt < FOREGROUND_MIN_GAP_MS) return;
  if (trigger === 'launch' || trigger === 'foreground') lastRunAt = now;
  const due = jobs.list().filter((j) => j.on.includes(trigger));
  let next = 0;
  const worker = async () => {
    while (next < due.length) {
      const j = due[next++];
      try {
        await j.run(now, trigger, ctx);
      } catch (e) {
        console.warn(`[job:${j.id}] 出错（已跳过）：`, e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOB_CONCURRENCY, due.length) }, worker));
}

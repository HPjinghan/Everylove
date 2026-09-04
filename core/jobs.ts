/**
 * 后台任务（D-086）：App 启动 / 回前台时要跑的东西——发帖调度、TA 的记事本、心跳、爽约检查、天气……
 * 一个调度器 = 一条注册（id + 触发时机 + run）。根布局只调 runJobs('launch') / runJobs('foreground')，
 * 加一个「TA 主动来找你」的调度器不再改 _layout。任务并发跑、各自兜错，一个失败不拖累别的。
 */

import { createRegistry } from '@/core/registry';

export type JobTrigger = 'launch' | 'foreground';

export interface Job {
  id: string;
  /** 在哪些时机跑 */
  on: readonly JobTrigger[];
  /** 返回值不用（可以是条数、Promise……），异步的会被 await */
  run(now: number, trigger: JobTrigger): unknown;
}

export const jobs = createRegistry<Job>('jobs', (j) => j.id);

export async function runJobs(trigger: JobTrigger, now = Date.now()): Promise<void> {
  const due = jobs.list().filter((j) => j.on.includes(trigger));
  await Promise.allSettled(
    due.map(async (j) => {
      try {
        await j.run(now, trigger);
      } catch (e) {
        console.warn(`[job:${j.id}] 出错（已跳过）：`, e);
      }
    })
  );
}

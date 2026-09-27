/**
 * 后台任务的并发与节流（D-176）：最多 JOB_CONCURRENCY 个同时跑；回前台不到 FOREGROUND_MIN_GAP_MS 不重跑、启动总是跑。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { FOREGROUND_MIN_GAP_MS, JOB_CONCURRENCY, jobs, resetJobsThrottle, runJobs } from '@/core/jobs';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  jobs.clear();
  resetJobsThrottle();
});

describe('runJobs', () => {
  it('最多 JOB_CONCURRENCY 个同时跑，全部跑完', async () => {
    let running = 0;
    let peak = 0;
    const ran: string[] = [];
    for (const n of [1, 2, 3, 4, 5]) {
      jobs.register({
        id: `t${n}`,
        on: ['launch', 'foreground'],
        run: async () => {
          running++;
          peak = Math.max(peak, running);
          await wait(5);
          running--;
          ran.push(`t${n}`);
        },
      });
    }
    await runJobs('launch', 1_000_000);
    expect(peak).toBe(JOB_CONCURRENCY);
    expect(ran.sort()).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('一个出错不拖累别的', async () => {
    const ran: string[] = [];
    jobs.register({
      id: 'bad',
      on: ['launch'],
      run: () => {
        throw new Error('boom');
      },
    });
    jobs.register({ id: 'good', on: ['launch'], run: () => ran.push('good') });
    await runJobs('launch', 1_000_000);
    expect(ran).toEqual(['good']);
  });

  it('回前台不到 FOREGROUND_MIN_GAP_MS 不重跑；过了就跑；启动总是跑', async () => {
    let n = 0;
    jobs.register({ id: 'count', on: ['launch', 'foreground'], run: () => n++ });
    const t0 = 1_000_000;
    await runJobs('launch', t0);
    expect(n).toBe(1);
    await runJobs('foreground', t0 + 1000);
    expect(n).toBe(1);
    await runJobs('foreground', t0 + FOREGROUND_MIN_GAP_MS + 1);
    expect(n).toBe(2);
    await runJobs('launch', t0 + FOREGROUND_MIN_GAP_MS + 2);
    expect(n).toBe(3);
  });
});

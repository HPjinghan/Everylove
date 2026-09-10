/**
 * 后台任务（D-086）：启动 / 回前台时补投的调度器，全部登记在这里；根布局只调 runJobs。
 * 「TA 主动来找你」（D-114）也在这里：lib/reach-out.ts。
 */

import { jobs } from '@/core/jobs';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import { deliverDueHisNotes } from '@/lib/his-notes';
import { checkMissedPlans } from '@/lib/outing';
import { deliverDuePosts, deliverDueReactions } from '@/lib/posts';
import { deliverDueReachOuts } from '@/lib/reach-out';
import { initWeather, refreshWeather } from '@/lib/weather';
import { useAppStore } from '@/store/app-store';

/** 广场公开帖的种子（首次启动补齐） */
jobs.register({ id: 'seed-posts', on: ['launch'], run: () => useAppStore.getState().ensureSeedPosts() });

/** 真实天气（D-065）：启动读缓存 + 拉取，回前台按节流刷新 */
jobs.register({
  id: 'weather',
  on: ['launch', 'foreground'],
  run: (_now, trigger) => (trigger === 'launch' ? initWeather() : refreshWeather()),
});

/** 心跳三段式（D-020/D-021）：日历用户层日程的事前 / 当天 / 事后 */
jobs.register({ id: 'heartbeat', on: ['launch', 'foreground'], run: (now) => deliverDueHeartbeats(now) });

/** 发帖调度（D-055）：TA 的 X 时间线按 MBTI 频率活着 */
jobs.register({ id: 'posts', on: ['launch', 'foreground'], run: (now) => deliverDuePosts(now) });

/** 别人的互动（D-110）：TA 的帖子下面有身边的人和其他 TA 来评论 */
jobs.register({ id: 'post-reactions', on: ['launch', 'foreground'], run: () => deliverDueReactions() });

/** TA 主动找她（D-114）：到点的落进会话，并把下一条写好、排本地通知 */
jobs.register({ id: 'reach-out', on: ['launch', 'foreground'], run: (now) => deliverDueReachOuts(now) });

/** 爽约检查（D-079）：过了赴约窗口还没去的约定 → 记忆 + TA 主动说一句 */
jobs.register({ id: 'missed-plans', on: ['launch', 'foreground'], run: (now) => checkMissedPlans(now) });

/** TA 的记事本（D-085）：按 MBTI 频率写心事 */
jobs.register({ id: 'his-notes', on: ['launch', 'foreground'], run: (now) => deliverDueHisNotes(now) });

/**
 * 后台任务（D-086）：启动 / 回前台时补投的调度器，全部登记在这里；根布局只调 runJobs。
 * 「TA 主动来找你」（D-114）也在这里：lib/reach-out.ts。
 */

import { jobs } from '@/core/jobs';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import { deliverDueHisNotes } from '@/lib/his-notes';
import { ensureCircle, refreshCircleChats } from '@/lib/circle';
import { deliverDueHisSchedules, ensureHisSchedule } from '@/lib/his-schedule';
import { gcMedia } from '@/lib/media-gc';
import { deliverDueArrivals } from '@/lib/delivery';
import { checkMissedPlans } from '@/lib/outing';
import { deliverDuePosts, deliverDueReactions } from '@/lib/posts';
import { deliverDueReachOuts } from '@/lib/reach-out';
import { deliverDueRecalls } from '@/lib/recall';
import { deliverDueSalaries } from '@/lib/salary';
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
jobs.register({ id: 'heartbeat', on: ['launch', 'foreground', 'screen:calendar'], run: (now) => deliverDueHeartbeats(now) });

/** 发帖调度（D-055）：TA 的 X 时间线按 MBTI 频率活着 */
jobs.register({ id: 'posts', on: ['launch', 'foreground'], run: (now) => deliverDuePosts(now) });

/** 别人的互动（D-110）：TA 的帖子下面有身边的人和其他 TA 来评论 */
jobs.register({ id: 'post-reactions', on: ['launch', 'foreground', 'screen:x'], run: () => deliverDueReactions() });

/** TA 主动找她（D-114）：到点的落进会话，并把下一条写好、排本地通知 */
jobs.register({ id: 'reach-out', on: ['launch', 'foreground'], run: (now) => deliverDueReachOuts(now) });

/** 外卖送到（D-135）：她给 TA 点的到了，TA 说一句、拍一张 */
jobs.register({ id: 'delivery-arrivals', on: ['launch', 'foreground'], run: (now) => deliverDueArrivals(now) });

/** TA 的周薪（D-128）：钱包没建的建、周薪没估的估一次、到期的入账 */
jobs.register({ id: 'salary', on: ['launch', 'foreground'], run: (now) => deliverDueSalaries(now) });

/** 推送召回（D-126）：温度到 0 停主动，第 7 / 14 / 30 天各一条通知；点开 App 时到点的那条落进会话 */
jobs.register({ id: 'recall', on: ['launch', 'foreground'], run: (now) => deliverDueRecalls(now) });

/** 爽约检查（D-079）：过了赴约窗口还没去的约定 → 记忆 + TA 主动说一句 */
jobs.register({ id: 'missed-plans', on: ['launch', 'foreground'], run: (now) => checkMissedPlans(now) });

/** TA 自己的作息（D-119）：日程不够就补一周 */
jobs.register({
  id: 'his-schedule',
  on: ['launch', 'foreground', 'screen:phone'],
  run: (now, _trigger, ctx) => (ctx.bondId ? ensureHisSchedule(ctx.bondId, now) : deliverDueHisSchedules(now)),
});

/** TA 的记事本（D-085）：按 MBTI 频率写心事 */
jobs.register({ id: 'his-notes', on: ['launch', 'foreground', 'screen:phone'], run: (now) => deliverDueHisNotes(now) });

/** 身边的人（D-110 / D-124）：打开 TA 的手机时——第一次生成一次，之后隔够久把和他们的聊天续上 */
jobs.register({
  id: 'circle',
  on: ['screen:phone'],
  run: (now, _trigger, ctx) => (ctx.bondId ? ensureCircle(ctx.bondId).then(() => refreshCircleChats(ctx.bondId!, now)) : undefined),
});

/** 媒体目录清理（D-186）：语音缓存过期的、没人引用的照片 / 立绘，启动时清 */
jobs.register({ id: 'media-gc', on: ['launch'], run: (now) => gcMedia(now) });

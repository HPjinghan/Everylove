/**
 * 流量计量（D-132）：她每发起一回合就扣当前模型档的流量；不够就发不出（顶部轻提示）。
 * 一个玩法一个文件：回合闸门（core/turn 的 turnGates）+ 回合后扣费（after 钩子，只对她发起的回合）+ 模型档 → 供应商的同步
 * + 订阅每月发流量（启动 / 回前台任务）。后台生成（TA 主动 / 召回 / 记事本 / 发帖 / 周薪）不走闸门也不扣。
 */

import { jobs } from '@/core/jobs';
import { setUserProviderChoice } from '@/core/providers';
import { turnGates, turnHooks } from '@/core/turn';
import { t } from '@/lib/i18n';
import { canAfford, DEFAULT_LOVE_MODEL, LOVE_MODELS, PLAN_MONTHLY_MB, planGrantsDue, turnCostMb } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

/* ── 闸门：她要开口，先看流量够不够这一回合 ── */
turnGates.register({
  key: 'traffic',
  check() {
    const s = useAppStore.getState();
    const cost = turnCostMb(s.loveModel ?? DEFAULT_LOVE_MODEL);
    return canAfford(s.traffic, cost, s.plan) ? null : t('流量用完了');
  },
});

/* ── 扣费：TA 回上了才扣（模型失败不扣） ── */
turnHooks.after.on(({ her, darkSide }) => {
  if (!her || darkSide) return;
  const s = useAppStore.getState();
  s.useTraffic(turnCostMb(s.loveModel ?? DEFAULT_LOVE_MODEL));
});

/* ── 模型档 → 供应商：玩家在设置里切，store 变了就同步给取路 ── */
function syncProvider(model: string | undefined) {
  setUserProviderChoice(LOVE_MODELS[(model as keyof typeof LOVE_MODELS) ?? DEFAULT_LOVE_MODEL]?.provider ?? '');
}
syncProvider(useAppStore.getState().loveModel);
let lastModel = useAppStore.getState().loveModel;
useAppStore.subscribe((s) => {
  if (s.loveModel !== lastModel) {
    lastModel = s.loveModel;
    syncProvider(s.loveModel);
  }
});

/* ── 订阅每月发一笔（Pro 2000 MB；Max 不限不发；Free 不发） ── */
export function grantPlanTraffic(now = Date.now()): number {
  const s = useAppStore.getState();
  const n = planGrantsDue(s.traffic, s.plan, now);
  if (!n) return 0;
  s.addTraffic(n * PLAN_MONTHLY_MB[s.plan], now);
  return n;
}
jobs.register({ id: 'traffic-grant', on: ['launch', 'foreground'], run: (now) => grantPlanTraffic(now) });

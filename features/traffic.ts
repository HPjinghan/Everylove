/**
 * 流量计量（D-132 / D-133）：每一次花钱的调用（core/usage 报上来的用量）都折成 MB 从她的流量扣；用完了她发不出、TA 的后台生成也停。
 * 一个玩法一个文件：回合闸门（她要开口先看还有没有）+ 生成闸门（真要调模型 / 生图前再问一声）+ 用量 → 扣账 + 模型档 → 供应商同步
 * + 订阅每月发流量（启动 / 回前台任务）。
 */

import { jobs } from '@/core/jobs';
import { setUserProviderChoice } from '@/core/providers';
import { turnGates } from '@/core/turn';
import { setGenerationGate, usageHooks } from '@/core/usage';
import { t } from '@/lib/i18n';
import { available, DEFAULT_LOVE_MODEL, LOVE_MODELS, mbForUsage, PLAN_MONTHLY_MB, planGrantsDue } from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

function left(): number {
  const s = useAppStore.getState();
  return available(s.traffic, s.plan);
}

/* ── 回合闸门：她要开口，先看流量还有没有（一笔可以把余额用穿，之后就发不出了） ── */
turnGates.register({
  key: 'traffic',
  check: () => (left() > 0 ? null : t('流量用完了')),
});

/* ── 生成闸门：后台生成 / 生图 / 语音在真要花钱前再问一声（用完 = 这次不做，各自静默跳过） ── */
setGenerationGate(() => (left() > 0 ? null : t('流量用完了')));

/* ── 用量 → 扣账：底座报多少就折多少 ── */
usageHooks.on((e) => {
  useAppStore.getState().useTraffic(mbForUsage(e));
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

/* ── 订阅每月发一笔（Pro 6000 MB；Max 不限不发；Free 不发） ── */
export function grantPlanTraffic(now = Date.now()): number {
  const s = useAppStore.getState();
  const n = planGrantsDue(s.traffic, s.plan, now);
  if (!n) return 0;
  s.addTraffic(n * PLAN_MONTHLY_MB[s.plan], now);
  return n;
}
jobs.register({ id: 'traffic-grant', on: ['launch', 'foreground'], run: (now) => grantPlanTraffic(now) });

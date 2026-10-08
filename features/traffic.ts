/**
 * 流量与语音计量（D-132 / D-133 → D-210）：core/usage 报上来的每一笔按账单归属分流——
 * - user（她发起的）：聊天 / 生图 / 看图折成 MB 扣流量；TA 的语音、她的语音识别按秒扣语音时长；
 * - house（TA 自己发起的、工具调用）：不扣她，记进后台保险丝（每人每天封顶，到顶静默跳过）；
 * - included（通话）：通话页按挂机时长扣语音分钟，这里不再记。
 * 一个玩法一个文件：回合闸门（她要开口先看还有没有）+ 生成闸门（真要花钱前再问一声）+ 用量 → 扣账 + 模型档 → 供应商同步
 * + 订阅每月发流量（启动 / 回前台任务）。
 */

import { jobs } from '@/core/jobs';
import { setUserProviderChoice } from '@/core/providers';
import { turnGates } from '@/core/turn';
import { setGenerationGate, usageHooks } from '@/core/usage';
import { t } from '@/lib/i18n';
import {
  available,
  DEFAULT_LOVE_MODEL,
  houseAfterUse,
  houseBlocked,
  LOVE_MODELS,
  mbForUsage,
  PLAN_MONTHLY_MB,
  planGrantsDue,
  voiceLeft,
  type HouseUsage,
} from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

function left(): number {
  const s = useAppStore.getState();
  return available(s.traffic, s.plan);
}

/** 她的语音消息还剩几秒（TA 的语音、她的语音识别共用） */
export function voiceMessageLeft(): number {
  const s = useAppStore.getState();
  return voiceLeft(s.voice, s.plan, 'message');
}

/** 平台出的那些今天用了多少（只在内存里：保险丝，不是账，重启清零无妨） */
let house: HouseUsage = { day: '', ktok: 0, images: 0 };

/* ── 回合闸门：她要开口，先看流量还有没有（一笔可以把余额用穿，之后就发不出了）；电话按分钟另算 ── */
turnGates.register({
  key: 'traffic',
  check: (scope) => (scope.mode === 'call' || left() > 0 ? null : t('流量用完了')),
});

/* ── 生成闸门：真要花钱前再问一声（用完 = 这次不做，各自静默跳过） ── */
setGenerationGate((kind, billing) => {
  if (billing === 'included') return null;
  if (kind === 'tts' || kind === 'asr') return billing === 'house' || voiceMessageLeft() > 0 ? null : t('语音时长用完了');
  if (billing === 'house') return houseBlocked(house, kind) ? t('今天的后台生成到顶了') : null;
  return left() > 0 ? null : t('流量用完了');
});

/* ── 用量 → 扣账：按账单归属分流 ── */
usageHooks.on((e) => {
  const s = useAppStore.getState();
  const billing = e.billing ?? 'user';
  if (billing === 'included') return;
  const tokens = (e.inputTokens ?? 0) + (e.outputTokens ?? 0);
  if (e.kind === 'tts' || e.kind === 'asr') {
    if (billing === 'user') s.useVoice(e.seconds ?? 0, 'message');
    return;
  }
  if (billing === 'house') {
    house = houseAfterUse(house, e.kind === 'image' ? { images: e.images ?? 1 } : { ktok: tokens / 1000 });
    return;
  }
  const cost = mbForUsage(e);
  s.useTraffic(cost);
  s.logTraffic({
    kind: e.kind === 'chat' ? (e.reqKind === 'task' ? 'task' : 'reply') : e.kind,
    provider: e.provider,
    mb: Math.round(cost * 100) / 100,
    tokens: tokens || undefined,
    estimated: e.estimated,
  });
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

/** 测试用：清掉保险丝的当天记账 */
export function resetHouseUsage(): void {
  house = { day: '', ktok: 0, images: 0 };
}

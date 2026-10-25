/**
 * 流量与语音计量（D-132 / D-133 → D-210）：core/usage 报上来的每一笔按账单归属分流——
 * - user（她发起的）：聊天 / 生图 / 看图 / 她的语音识别折成 RB 扣流量（识别 D-211）；TA 的语音按秒扣语音时长；
 * - house（TA 自己发起的、工具调用）：不扣她，记进后台保险丝（每人每天封顶，到顶静默跳过）；
 * - included（通话）：通话页按挂机时长扣语音分钟，这里不再记。
 * 一个玩法一个文件：回合闸门（她要开口先看还有没有）+ 生成闸门（真要花钱前再问一声）+ 用量 → 扣账 + 模型档 → 供应商同步
 * + 订阅每月发流量（启动 / 回前台任务）。
 * **余额以服务器为准（D-217）**：走代理的调用由服务器扣账（UsageEvent.metered），这里只记流水；代理每次响应带回最新钱包写进 store。
 * 订阅 / 流量包 / 分钟包 / GM 都经服务器（wallet.*）；本机扣账与本机发放只在没有服务器时用（开发直连 / 测试）。
 */

import { jobs } from '@/core/jobs';
import { setUserProviderChoice } from '@/core/providers';
import { turnGates } from '@/core/turn';
import { setGenerationGate, usageHooks } from '@/core/usage';
import { t } from '@/lib/i18n';
import { onServerWallet, proxyAvailable, proxyJson } from '@/lib/proxy';
import {
  available,
  DEFAULT_LOVE_MODEL,
  fromServerWallet,
  houseAfterUse,
  houseBlocked,
  LOVE_MODELS,
  mbForUsage,
  PLAN_MONTHLY_MB,
  planGrantsDue,
  usageTokens,
  voiceLeft,
  type HouseUsage,
  type WalletView,
} from '@/lib/traffic';
import { useAppStore } from '@/store/app-store';

/** 她还能花的流量（今天免费的 + 余额；Max 不限） */
export function trafficLeft(): number {
  return left();
}

function left(): number {
  const s = useAppStore.getState();
  return available(s.traffic, s.plan);
}

/** TA 的语音还剩几秒（她这一轮里的；D-211 起她的语音识别改走流量） */
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
  if (kind === 'tts') return billing === 'house' || voiceMessageLeft() > 0 ? null : t('语音时长用完了');
  if (billing === 'house') return kind !== 'asr' && houseBlocked(house, kind, useAppStore.getState().plan) ? t('今天的后台生成到顶了') : null;
  return left() > 0 ? null : t('流量用完了');
});

/* ── 用量 → 扣账：按账单归属分流 ── */
usageHooks.on((e) => {
  const s = useAppStore.getState();
  const billing = e.billing ?? 'user';
  if (billing === 'included') return;
  const tokens = usageTokens(e);
  // TA 的语音扣语音时长；她的语音识别（asr）跟聊天一样折流量（D-211）；服务器记过的这里不再扣（D-217）
  if (e.kind === 'tts') {
    if (billing === 'user' && !e.metered) s.useVoice(e.seconds ?? 0, 'message');
    return;
  }
  if (billing === 'house') {
    if (e.kind !== 'asr' && !e.metered) house = houseAfterUse(house, e.kind === 'image' ? { images: e.images ?? 1 } : { ktok: tokens / 1000 });
    return;
  }
  const cost = mbForUsage(e);
  if (!e.metered) s.useTraffic(cost);
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

/* ── 服务器钱包（D-217）：代理每次响应、wallet.* 的返回都写进 store ── */
let live = false;
function applyWallet(v: WalletView): void {
  live = v.live;
  useAppStore.getState().setServerWallet(fromServerWallet(v));
}
/** 真收费开关（服务器 BILLING_LIVE）：开了以后试装的「点即到账」不再有 */
export function billingLive(): boolean {
  return live;
}
onServerWallet(applyWallet);

async function wallet(service: string, body: Record<string, unknown> = {}): Promise<WalletView> {
  const v = await proxyJson<WalletView>(service, body);
  applyWallet(v);
  return v;
}

/** 读一次服务器钱包；收费开关打开前顺手把手机上试装攒下的余额搬上去（服务器只认第一次） */
export function refreshWallet(): Promise<WalletView> {
  const s = useAppStore.getState();
  return wallet('wallet.get', { import: { plan: s.plan, mb: s.traffic.balance, packSec: s.voice.packSec, bonusSec: s.voice.callBonusSec } });
}

/** 换订阅档（收费开关打开前点即生效；之后走 RevenueCat，docs/revenuecat.md） */
export function choosePlan(plan: 'free' | 'pro' | 'max'): Promise<WalletView> {
  return wallet('wallet.sim', { plan });
}
export function buyTrafficPack(id: string): Promise<WalletView> {
  return wallet('wallet.sim', { traffic_pack: id });
}
export function buyVoicePack(id: string): Promise<WalletView> {
  return wallet('wallet.sim', { voice_pack: id });
}
/** 开发者 GM：加 1000 RB / 加 30 分钟语音（服务器在收费开关打开后拒绝） */
export function gmGrant(what: 'traffic' | 'voice'): Promise<WalletView> {
  return wallet('wallet.sim', { gm: what });
}

/* ── 订阅每月发一笔（Pro 5000 MB；Max 不限不发；Free 不发）——没有服务器时本机发；有服务器由它发 ── */
export function grantPlanTraffic(now = Date.now()): number {
  const s = useAppStore.getState();
  const n = planGrantsDue(s.traffic, s.plan, now);
  if (!n) return 0;
  s.addTraffic(n * PLAN_MONTHLY_MB[s.plan], now);
  return n;
}
jobs.register({
  id: 'traffic-grant',
  on: ['launch', 'foreground'],
  run: async (now) => {
    if (!(await proxyAvailable())) return grantPlanTraffic(now);
    await refreshWallet().catch((e) => console.warn('[traffic] 读服务器钱包失败：', e));
  },
});

/** 测试用：清掉保险丝的当天记账 */
export function resetHouseUsage(): void {
  house = { day: '', ktok: 0, images: 0 };
}

/**
 * TA 主动花钱（D-128）：亲密 / 通话里 TA 自己决定给她发红包或点外卖——回复暗号 [发红包 金额|一句话] / [点外卖 东西|价格|一句话]。
 * 一个玩法一个文件：prompt 分段【你的钱包】+ 两枚带数值的暗号 + 外卖卡片（骑手进度真的走、送达出本地通知）。
 * 红包卡片本身在 features/red-packet.tsx（TA 发来的那张她点开才入账）。守门：每天每种最多一次、不超过余额（lib/wallet.ts）。
 * 主动找她（lib/reach-out.ts）走同一套暗号——TA 主动那条也可能带一份外卖。
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardShell } from '@/components/card-bubble';
import { showToast } from '@/components/toast';
import { DELIVERY_FROM_HIM_MARK, DELIVERY_FROM_HIM_PATTERN, hisWalletLines, RED_PACKET_FROM_HIM_MARK, RED_PACKET_FROM_HIM_PATTERN } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { cardKinds } from '@/core/cards';
import { replyMarkers } from '@/core/markers';
import { ORDER, promptSections } from '@/core/prompt';
import { BONDED_CHAT } from '@/features/prompts';
import { money, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { hasNotificationPermission, scheduleArrivalNotification } from '@/lib/notifications';
import type { ChatMessage } from '@/lib/types';
import { extraEligible, extraOffered, himTurnCount } from '@/lib/extras';
import { DELIVERY_DEFAULT_PRICE, DELIVERY_ETA_MIN, giftAllowed, giftsAfter, parseGiftPayload } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

/* ── prompt：TA 知道自己有多少钱、今天送过什么 ── */
promptSections.register({
  name: 'his-wallet',
  modes: BONDED_CHAT,
  order: ORDER.wallet,
  lines: (ctx, env) => {
    if (!ctx.bond) return [];
    const now = env.now.getTime();
    // 三道门（D-130）：等级 / 10 条冷却 / 概率——过了才把暗号给模型
    return hisWalletLines(ctx.character, ctx.bond.wallet, {
      redpacket: extraOffered(ctx.bond, ctx.character, 'redpacket', ctx.history, now),
      delivery: extraOffered(ctx.bond, ctx.character, 'delivery', ctx.history, now),
    });
  },
});

/* ── 暗号：[发红包 …] → TA 的钱包扣、她收到一张红包（点开才入她的账） ── */
replyMarkers.register({
  key: 'redPacketFromHim',
  mark: RED_PACKET_FROM_HIM_MARK,
  pattern: RED_PACKET_FROM_HIM_PATTERN,
  apply({ scope, mode, value, unread }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    if (!bond) return;
    const now = Date.now();
    if (!extraEligible(bond, 'redpacket', bond.messages, now) || !giftAllowed(bond.wallet, 'redpacket', now)) return;
    const { amount: asked, note } = parseGiftPayload(value ?? '', 'redpacket');
    const balance = bond.wallet?.balance ?? 0;
    const amount = Math.round(Math.min(asked ?? 0, balance));
    if (!(amount >= 1)) return;
    const id = uid('m');
    const msg: ChatMessage = {
      id,
      from: 'him',
      kind: 'card',
      text: money(amount),
      card: { type: 'redpacket', title: money(amount), subtitle: note, amount, fromHim: true, msgId: id, bondId: bond.id },
      at: now,
    };
    store.adjustHisWallet(bond.id, { amount: -amount, kind: 'redpacket', note: t('给她的红包') });
    store.patchHisWallet(bond.id, { gifts: giftsAfter(bond.wallet, 'redpacket', now) });
    mode.append(scope, [msg], { unreadDelta: unread ? 1 : 0 });
    useAppStore.getState().setExtraFired(bond.id, himTurnCount(useAppStore.getState().bonds.find((b) => b.id === bond.id)?.messages ?? []), now);
  },
});

/* ── 暗号：[点外卖 …] → TA 的钱包扣、骑手出发、到了通知她 ── */
replyMarkers.register({
  key: 'deliveryFromHim',
  mark: DELIVERY_FROM_HIM_MARK,
  pattern: DELIVERY_FROM_HIM_PATTERN,
  async apply({ scope, mode, value, unread }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    if (!bond) return;
    const now = Date.now();
    if (!extraEligible(bond, 'delivery', bond.messages, now) || !giftAllowed(bond.wallet, 'delivery', now)) return;
    const { item, amount: asked, note } = parseGiftPayload(value ?? '', 'delivery');
    if (!item) return;
    const price = Math.round(asked ?? DELIVERY_DEFAULT_PRICE);
    if ((bond.wallet?.balance ?? 0) < price) return;
    const [lo, hi] = DELIVERY_ETA_MIN;
    const arriveAt = now + (lo + Math.random() * (hi - lo)) * 60_000;
    const id = uid('m');
    const orderId = uid('o');
    const msg: ChatMessage = {
      id,
      from: 'him',
      kind: 'card',
      text: item,
      card: { type: 'delivery', title: item, subtitle: note, amount: price, fromHim: true, arriveAt, msgId: id, bondId: bond.id, orderId },
      at: now,
    };
    store.adjustHisWallet(bond.id, { amount: -price, kind: 'delivery', note: t('给她点的{item}', { item }) });
    // 也进她的外卖 App「订单」（D-129）
    store.addOrder({ id: orderId, at: now, from: 'him', bondId: bond.id, items: [{ name: item, qty: 1, price }], total: price, note, arriveAt });
    store.patchHisWallet(bond.id, { gifts: giftsAfter(bond.wallet, 'delivery', now) });
    mode.append(scope, [msg], { unreadDelta: unread ? 1 : 0 });
    useAppStore.getState().setExtraFired(bond.id, himTurnCount(useAppStore.getState().bonds.find((b) => b.id === bond.id)?.messages ?? []), now);
    const ok = await hasNotificationPermission().catch(() => false);
    if (ok) void scheduleArrivalNotification(bond.name, t('你的{item}到了', { item }), new Date(arriveAt), bond.id);
  },
});

/* ── 外卖卡片：骑手在路上 → 已送达（时间到了自己变） ── */
cardKinds.register({
  type: 'delivery',
  contextText: (c) =>
    c.fromHim
      ? `（你给她点了一份${c.title}${c.subtitle ? `，留言「${c.subtitle}」` : ''}，${(c.arriveAt ?? 0) <= Date.now() ? '已经送到了' : '骑手还在路上'}）`
      : `（她给你点了一份外卖：${c.title}${c.subtitle ? `，留言「${c.subtitle}」` : ''}，${(c.arriveAt ?? 0) <= Date.now() ? '已经送到了' : '骑手还在路上'}）`,
  render: (c, dark) => <DeliveryCard title={c.title} subtitle={c.subtitle} arriveAt={c.arriveAt ?? 0} dark={dark} />,
});

function DeliveryCard({ title, subtitle, arriveAt, dark }: { title: string; subtitle?: string; arriveAt: number; dark: boolean }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  const arrived = now > 0 && now >= arriveAt;
  const minutes = Math.max(1, Math.ceil((arriveAt - now) / 60_000));
  return (
    <View>
      <CardShell emoji="🛵" kicker={t('外卖')} title={title} subtitle={subtitle} dark={dark} />
      <Text style={[styles.state, !dark && styles.stateLight]}>
        {arrived ? t('已送达') : now === 0 ? t('骑手已接单') : t('骑手在路上 · 约 {n} 分钟', { n: minutes })}
      </Text>
    </View>
  );
}

/** TA 发来的红包：她点开才入账（features/red-packet.tsx 的 render 用） */
export function ClaimRedPacket({ msgId, bondId, amount, claimed }: { msgId: string; bondId: string; amount: number; claimed?: boolean }) {
  const claim = () => {
    const store = useAppStore.getState();
    const bond = store.bonds.find((b) => b.id === bondId);
    const msg = bond?.messages.find((m) => m.id === msgId);
    if (!bond || !msg?.card || msg.card.claimed) return;
    store.creditWallet({ amount, kind: 'redpacket', note: t('{name} 的红包', { name: bond.name }), bondId });
    store.patchMessage({ bondId }, msgId, { card: { ...msg.card, claimed: true } });
    showToast(t('零钱 +{amount}', { amount: money(amount) }));
  };
  if (claimed) return <Text style={styles.claimState}>{t('已领取')}</Text>;
  return (
    <Pressable onPress={claim} hitSlop={6} style={styles.claimBtn}>
      <Text style={styles.claimText}>{t('点开')}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    state: { fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 8 },
    stateLight: { color: 'rgba(255,255,255,0.8)' },
    // 红包整个气泡是红的（features/red-packet.tsx），这里的字跟着白
    claimState: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
    claimBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
    claimText: { fontSize: 12, fontWeight: '700', color: '#FFE9B8' },
    _theme: { color: Romance.ink },
  })
);

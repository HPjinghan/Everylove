/**
 * 外卖（D-129）：像一个外卖平台——选给谁点（自己 / 缔结的 TA）→ 选店 → 加减数量 → 留一句话 → 下单（扣 Coin）；
 * 「订单」里是所有单子（她点的、TA 给她点的），状态按时间推：商家接单 → 骑手取餐 → 在路上 → 已送达。
 * 纸面：白卡 + Chip / Segmented / Input / Button，价格 Fredoka。
 * 版式像外卖平台（D-206）：左一列店、右边这家店的菜单，底部墨色购物车条；订单卡带四段配送进度条，在路上时大字报剩几分钟。
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { showAlert } from '@/components/action-sheet';
import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, Segmented } from '@/components/chip';
import { Input } from '@/components/input';
import { MingCute } from '@/components/mingcute';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { MENU } from '@/content/menu';
import { orderStatus, orderTitle, placeOrder, type OrderStatus } from '@/lib/delivery';
import { money, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DELIVERY_ETA_MIN } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

type Tab = 'order' | 'history';

/** 配送四段（lib/delivery orderStatus）与进度条下的短标签 */
const STAGES: OrderStatus[] = ['accepted', 'pickup', 'riding', 'delivered'];
const STAGE_LABEL: Record<OrderStatus, string> = { accepted: '接单', pickup: '取餐', riding: '配送', delivered: '送达' };

const timeLabel = shortDateTime;

export default function DeliveryScreen() {
  const router = useRouter();
  const balance = useAppStore((s) => s.wallet.balance);
  const bonds = useAppStore((s) => s.bonds);
  const orders = useAppStore((s) => s.orders);
  const [tab, setTab] = useState<Tab>('order');
  const [to, setTo] = useState<'me' | string>('me');
  const [storeId, setStoreId] = useState(MENU[0].id);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  // 订单状态按时间推：每半分钟刷一次
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const shop = MENU.find((s) => s.id === storeId) ?? MENU[0];
  const total = useMemo(
    () => Object.entries(cart).reduce((sum, [key, qty]) => {
      const [sid, iid] = key.split('/');
      const item = MENU.find((s) => s.id === sid)?.items.find((i) => i.id === iid);
      return sum + (item ? item.price * qty : 0);
    }, 0),
    [cart]
  );
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const short = total > balance;

  const bump = (itemId: string, delta: number) => {
    const key = `${shop.id}/${itemId}`;
    setCart((c) => {
      const next = Math.max(0, (c[key] ?? 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const submit = async () => {
    if (placing || !count || short) return;
    setPlacing(true);
    try {
      // 一单只能来自一家店：购物车里按店分组，逐店下单
      const byStore = new Map<string, { itemId: string; qty: number }[]>();
      for (const [key, qty] of Object.entries(cart)) {
        const [sid, iid] = key.split('/');
        byStore.set(sid, [...(byStore.get(sid) ?? []), { itemId: iid, qty }]);
      }
      for (const [sid, items] of byStore) {
        const r = await placeOrder({ storeId: sid, items, note, to });
        if (!r.ok) {
          showAlert(r.reason === 'balance' ? t('零钱不够了') : t('这单没下成'));
          return;
        }
      }
      setCart({});
      setNote('');
      setTab('history');
    } finally {
      setPlacing(false);
    }
  };

  const sorted = [...orders].sort((a, b) => b.at - a.at);

  return (
    <AppScreen title={t('外卖')} pattern onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <Segmented<Tab>
        options={[
          { key: 'order', label: t('点单') },
          { key: 'history', label: t('订单') },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'order' ? (
        <View style={styles.flex}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toBar} contentContainerStyle={styles.toChips}>
            <Text style={styles.sectionTitle}>{t('给谁点')}</Text>
            <Chip label={t('给自己')} selected={to === 'me'} onPress={() => setTo('me')} />
            {bonds.map((b) => (
              <Chip key={b.id} label={b.name} selected={to === b.id} onPress={() => setTo(b.id)} />
            ))}
          </ScrollView>

          {/* 左边一列店、右边这家店的菜单 */}
          <View style={styles.shopWrap}>
            <ScrollView style={styles.rail} showsVerticalScrollIndicator={false}>
              {MENU.map((s) => {
                const on = s.id === shop.id;
                const inCart = Object.entries(cart).reduce((n, [key, q]) => (key.startsWith(`${s.id}/`) ? n + q : n), 0);
                return (
                  <Pressable key={s.id} onPress={() => setStoreId(s.id)} style={[styles.railItem, on && styles.railItemOn]}>
                    {on ? <View style={styles.railMark} /> : null}
                    <Text style={styles.railEmoji}>{s.emoji}</Text>
                    <Text style={[styles.railName, on && styles.railNameOn]} numberOfLines={2}>
                      {t(s.name)}
                    </Text>
                    {inCart > 0 ? (
                      <View style={styles.railBadge}>
                        <Text style={styles.railBadgeText}>{inCart}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView style={styles.menu} contentContainerStyle={styles.menuBody}>
              <View style={styles.shopHead}>
                <View style={styles.shopEmojiTile}>
                  <Text style={styles.shopEmoji}>{shop.emoji}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.shopName}>{t(shop.name)}</Text>
                  <Text style={styles.shopEta}>{t('约 {lo}–{hi} 分钟送达', { lo: DELIVERY_ETA_MIN[0], hi: DELIVERY_ETA_MIN[1] })}</Text>
                </View>
              </View>
              {shop.items.map((item, i) => {
                const qty = cart[`${shop.id}/${item.id}`] ?? 0;
                return (
                  <View key={item.id} style={[styles.row, i > 0 && styles.rowLine]}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{t(item.name)}</Text>
                      <Text style={styles.price}>{money(item.price)}</Text>
                    </View>
                    <View style={styles.stepper}>
                      {qty > 0 ? (
                        <>
                          <Pressable onPress={() => bump(item.id, -1)} hitSlop={8} style={styles.stepBtn}>
                            <Text style={styles.stepText}>−</Text>
                          </Pressable>
                          <Text style={styles.qty}>{qty}</Text>
                        </>
                      ) : null}
                      <Pressable onPress={() => bump(item.id, 1)} hitSlop={8} style={[styles.stepBtn, styles.stepBtnOn]}>
                        <Text style={[styles.stepText, styles.stepTextOn]}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.checkout}>
            <Input value={note} onChangeText={setNote} placeholder={t('留一句话')} maxLength={30} />
            {/* 购物车条：墨色一条，左边袋子 + 件数、合计，右边下单 */}
            <View style={styles.cartBar}>
              <View style={styles.cartIcon}>
                <MingCute name="takeout" size={22} color={count ? Romance.accent : Romance.sub} />
                {count > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{count}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.flex}>
                <Text style={[styles.total, short && styles.totalShort]}>{money(total)}</Text>
                <Text style={styles.totalLabel}>{short ? t('零钱不够了') : t('零钱 {n}', { n: money(balance) })}</Text>
              </View>
              <Button
                label={placing ? t('…') : t('下单')}
                size="md"
                disabled={!count || short || placing}
                onPress={() => void submit()}
                style={styles.submit}
              />
            </View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {sorted.length === 0 ? (
            <Text style={styles.empty}>{t('还是空的。')}</Text>
          ) : (
            sorted.map((o) => {
              const bond = o.bondId ? bonds.find((b) => b.id === o.bondId) : undefined;
              const who = o.from === 'him' ? t('{name} 给你点的', { name: bond?.name ?? 'TA' }) : bond ? t('你给 {name} 点的', { name: bond.name }) : t('给自己点的');
              const stage = now ? STAGES.indexOf(orderStatus(o, now)) : -1;
              const minutesLeft = now ? Math.max(1, Math.ceil((o.arriveAt - now) / 60_000)) : 0;
              const shopMeta = MENU.find((m) => m.id === o.storeId);
              return (
                <Card key={o.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <Text style={styles.orderShop}>{shopMeta ? `${shopMeta.emoji} ${t(shopMeta.name)}` : ''}</Text>
                    <Text style={styles.orderWho}>{timeLabel(o.at)}</Text>
                  </View>
                  <View style={styles.orderTop}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {orderTitle(o)}
                    </Text>
                    <Text style={styles.price}>{money(o.total)}</Text>
                  </View>
                  <Text style={styles.orderWho}>{who}</Text>
                  {o.note ? <Text style={styles.orderNote}>{t('「{x}」', { x: o.note })}</Text> : null}

                  {/* 配送进度：四个节点一条线，走到哪一段亮到哪 */}
                  {stage === 2 ? (
                    <Text style={styles.eta}>
                      {minutesLeft}
                      <Text style={styles.etaUnit}> {t('分钟')}</Text>
                    </Text>
                  ) : null}
                  <View style={styles.track}>
                    {STAGES.map((st, i) => (
                      <View key={st} style={styles.trackStep}>
                        <View style={styles.trackNodeRow}>
                          <View style={[styles.trackLine, i <= stage && styles.trackLineOn, i === 0 && styles.trackLineHidden]} />
                          <View style={[styles.trackNode, i <= stage && styles.trackNodeOn, i === stage && styles.trackNodeNow]} />
                          <View style={[styles.trackLine, i < stage && styles.trackLineOn, i === STAGES.length - 1 && styles.trackLineHidden]} />
                        </View>
                        <Text style={[styles.trackLabel, i === stage && styles.trackLabelNow]} numberOfLines={1}>
                          {t(STAGE_LABEL[st])}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}

/** 左边店铺栏宽 */
const RAIL = 84;

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    tabs: { marginHorizontal: Space.screen, marginTop: Space.screen },
    body: { paddingHorizontal: Space.screen, paddingTop: Space.screen, paddingBottom: 24, gap: Space.inlineLoose },
    sectionTitle: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.sub },
    toBar: { flexGrow: 0, marginTop: Space.inlineLoose },
    toChips: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, paddingHorizontal: Space.screen, paddingBottom: Space.inlineLoose },
    // 店铺栏：paper 底，选中那家白底 + 左侧 primary 竖条；菜单区白底
    shopWrap: { flex: 1, flexDirection: 'row', borderTopWidth: Shape.stroke, borderTopColor: Romance.stroke },
    rail: { width: RAIL, flexGrow: 0, backgroundColor: Romance.bg },
    railItem: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, gap: 2 },
    railItemOn: { backgroundColor: Romance.card },
    railMark: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: Shape.radiusTail, backgroundColor: Romance.accent },
    railEmoji: { fontSize: Type.scale.xxl.size },
    railName: { fontSize: Type.scale.caption.size, color: Romance.sub, textAlign: 'center' },
    railNameOn: { color: Romance.ink, fontWeight: '600' },
    railBadge: {
      position: 'absolute',
      top: 6,
      right: 10,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: Shape.radiusInner,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    railBadgeText: { fontFamily: Fonts.labelBold, fontSize: Type.scale.xs.size, color: '#FFFFFF' },
    menu: { flex: 1, backgroundColor: Romance.card },
    menuBody: { paddingHorizontal: Space.cardX, paddingBottom: 24 },
    shopHead: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, paddingVertical: 14 },
    shopEmojiTile: { width: 48, height: 48, borderRadius: Shape.radius, backgroundColor: Romance.bg, alignItems: 'center', justifyContent: 'center' },
    shopEmoji: { fontSize: Type.scale.h2.size },
    shopName: { fontSize: Type.scale.cardTitle.size, fontWeight: '600', color: Romance.ink },
    shopEta: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    rowLine: { borderTopWidth: 1, borderTopColor: Romance.line },
    rowBody: { flex: 1 },
    rowTitle: { flexShrink: 1, fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    price: { fontFamily: Fonts.labelBold, fontSize: Type.scale.label.size, color: Romance.accentStrong, marginTop: 2 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnOn: { backgroundColor: Romance.accent, borderColor: Romance.accent },
    stepText: { fontFamily: Fonts.labelBold, fontSize: Type.scale.md.size, color: Romance.ink, lineHeight: 18 },
    stepTextOn: { color: '#FFFFFF' },
    qty: { fontFamily: Fonts.labelBold, fontSize: Type.scale.sub.size, color: Romance.ink, minWidth: 14, textAlign: 'center' },
    checkout: {
      paddingHorizontal: Space.screen,
      paddingTop: Space.inlineLoose,
      paddingBottom: Space.screen + 12,
      borderTopWidth: Shape.stroke,
      borderTopColor: Romance.stroke,
      backgroundColor: Romance.bg,
      gap: Space.inlineLoose,
    },
    // 购物车条：ink 底（同系统条）白字
    cartBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      backgroundColor: Romance.ink,
      borderRadius: Shape.radius,
      paddingVertical: 8,
      paddingLeft: 10,
      paddingRight: 8,
    },
    cartIcon: { width: 40, height: 40, borderRadius: Shape.radius, backgroundColor: Romance.card, alignItems: 'center', justifyContent: 'center' },
    cartBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: Shape.radiusInner,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartBadgeText: { fontFamily: Fonts.labelBold, fontSize: Type.scale.timestamp.size, color: '#FFFFFF' },
    total: { fontFamily: Fonts.labelBold, fontSize: Type.scale.xl.size, color: '#FFFFFF' },
    totalShort: { color: Romance.accent },
    totalLabel: { fontSize: Type.scale.timestamp.size, color: withAlpha('#FFFFFF', 0.7), marginTop: 1 },
    submit: { minWidth: 96 },
    empty: { fontSize: Type.scale.label.size, color: Romance.sub, paddingVertical: 10 },
    orderCard: { gap: 4 },
    orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    orderShop: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.sub },
    orderWho: { fontSize: Type.scale.caption.size, color: Romance.sub },
    orderNote: { fontSize: Type.scale.label.size, color: Romance.ink },
    eta: { fontFamily: Fonts.labelBold, fontSize: Type.scale.h1.size, color: Romance.accentStrong, marginTop: 6 },
    etaUnit: { fontSize: Type.scale.label.size, color: Romance.sub },
    // 配送进度：节点 10 方块、线 2px；走过的 primary，当前节点放大并描边
    track: { flexDirection: 'row', marginTop: 10 },
    trackStep: { flex: 1, alignItems: 'center', gap: 6 },
    trackNodeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 14 },
    trackLine: { flex: 1, height: 2, backgroundColor: Romance.line },
    trackLineOn: { backgroundColor: Romance.accent },
    trackLineHidden: { backgroundColor: 'transparent' },
    trackNode: { width: 10, height: 10, borderRadius: Shape.radiusTail, backgroundColor: Romance.line },
    trackNodeOn: { backgroundColor: Romance.accent },
    trackNodeNow: { width: 14, height: 14, borderRadius: Shape.radiusInner, borderWidth: Shape.stroke, borderColor: Romance.stroke },
    trackLabel: { fontSize: Type.scale.timestamp.size, color: Romance.sub },
    trackLabelNow: { color: Romance.ink, fontWeight: '600' },
  })
);

/**
 * 外卖（D-129）：像一个外卖平台——选给谁点（自己 / 缔结的 TA）→ 选店 → 加减数量 → 留一句话 → 下单（扣 Coin）；
 * 「订单」里是所有单子（她点的、TA 给她点的），状态按时间推：商家接单 → 骑手取餐 → 在路上 → 已送达。
 * 纸面：白卡 + Chip / Segmented / Input / Button，价格 Fredoka。
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, Segmented } from '@/components/chip';
import { Input } from '@/components/input';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { MENU } from '@/content/menu';
import { orderStatusLabel, orderTitle, placeOrder } from '@/lib/delivery';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

type Tab = 'order' | 'history';

function timeLabel(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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
          Alert.alert(r.reason === 'balance' ? t('零钱不够了') : t('这单没下成'));
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
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.sectionTitle}>{t('给谁点')}</Text>
            <View style={styles.chips}>
              <Chip label={t('给自己')} selected={to === 'me'} onPress={() => setTo('me')} />
              {bonds.map((b) => (
                <Chip key={b.id} label={b.name} selected={to === b.id} onPress={() => setTo(b.id)} />
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {MENU.map((s) => (
                <Chip key={s.id} label={`${s.emoji} ${t(s.name)}`} selected={s.id === shop.id} onPress={() => setStoreId(s.id)} />
              ))}
            </ScrollView>

            <Card style={styles.menuCard}>
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
            </Card>
          </ScrollView>

          <View style={styles.checkout}>
            <Input value={note} onChangeText={setNote} placeholder={t('留一句话')} maxLength={30} />
            <View style={styles.checkoutRow}>
              <View>
                <Text style={styles.totalLabel}>{t('零钱 {n}', { n: money(balance) })}</Text>
                <Text style={[styles.total, short && styles.totalShort]}>{money(total)}</Text>
              </View>
              <Button label={placing ? t('…') : t('下单')} disabled={!count || short || placing} onPress={() => void submit()} style={styles.submit} />
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
              return (
                <Card key={o.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {orderTitle(o)}
                    </Text>
                    <Text style={styles.price}>{money(o.total)}</Text>
                  </View>
                  <Text style={styles.orderWho}>
                    {who} · {timeLabel(o.at)}
                  </Text>
                  {o.note ? <Text style={styles.orderNote}>「{o.note}」</Text> : null}
                  <Text style={styles.orderStatus}>{now ? orderStatusLabel(o, now) : t('…')}</Text>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    tabs: { marginHorizontal: Space.screen, marginTop: Space.screen },
    body: { paddingHorizontal: Space.screen, paddingTop: Space.screen, paddingBottom: 24, gap: Space.inlineLoose },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    menuCard: { paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    rowLine: { borderTopWidth: Shape.stroke, borderTopColor: Romance.stroke },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    price: { fontFamily: Fonts.labelBold, fontSize: 13, color: Romance.accentStrong, marginTop: 2 },
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
    stepText: { fontFamily: Fonts.labelBold, fontSize: 16, color: Romance.ink, lineHeight: 18 },
    stepTextOn: { color: '#FFFFFF' },
    qty: { fontFamily: Fonts.labelBold, fontSize: 14, color: Romance.ink, minWidth: 14, textAlign: 'center' },
    checkout: {
      paddingHorizontal: Space.screen,
      paddingTop: Space.inlineLoose,
      paddingBottom: Space.screen + 12,
      borderTopWidth: Shape.stroke,
      borderTopColor: Romance.stroke,
      backgroundColor: Romance.bg,
      gap: Space.inlineLoose,
    },
    checkoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 12, color: Romance.sub },
    total: { fontFamily: Fonts.labelBold, fontSize: 22, color: Romance.ink },
    totalShort: { color: Romance.accentStrong },
    submit: { minWidth: 120 },
    empty: { fontSize: 13, color: Romance.sub, paddingVertical: 10 },
    orderCard: { gap: 4 },
    orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    orderWho: { fontSize: 12, color: Romance.sub },
    orderNote: { fontSize: 13, color: Romance.ink },
    orderStatus: { fontSize: 12, fontWeight: '600', color: Romance.accentStrong, marginTop: 4 },
  })
);

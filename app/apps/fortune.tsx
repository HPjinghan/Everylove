/**
 * 日签（D-128）：每天一次水晶球抽签，按运势给零钱（¥50–500）；下面是她的零钱余额与账单（红包 / 外卖 / 日签 / 工资都在这）。
 * 纸面：白卡 + accentSoft 水晶球（无渐变无阴影），运势中文走系统字体、金额 Fredoka。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useAnimatedValue, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { MingCute } from '@/components/mingcute';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { FORTUNE_TEXTS } from '@/content/fortunes';
import { money } from '@/lib/format';
import { localeOf, t } from '@/lib/i18n';
import type { LedgerKind } from '@/lib/types';
import { drawFortune, fortuneDayKey, FORTUNES } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

const BALL = 220;
/** 水晶球亮起来的时长（毫秒） */
const REVEAL_MS = 1400;

const KIND_LABEL: Record<LedgerKind, string> = {
  fortune: '日签',
  redpacket: '红包',
  delivery: '外卖',
  salary: '工资',
  refund: '退回',
};

function dayLabel(at: number): string {
  try {
    return new Date(at).toLocaleDateString(localeOf(), { month: 'numeric', day: 'numeric' });
  } catch {
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

export default function FortuneScreen() {
  const router = useRouter();
  const wallet = useAppStore((s) => s.wallet);
  const fortune = useAppStore((s) => s.fortune);
  const [revealing, setRevealing] = useState(false);
  const [today, setToday] = useState(() => fortuneDayKey(Date.now()));
  const scale = useAnimatedValue(1);
  const glow = useAnimatedValue(0);

  // 今天抽过没：进页面时算一次，抽完再算一次（渲染期不读 Date.now()）
  const drawn = fortune?.day === today;
  const luckMeta = fortune ? FORTUNES[fortune.luck] : null;

  const look = () => {
    if (revealing || drawn) return;
    setRevealing(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: REVEAL_MS / 2, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: REVEAL_MS / 2, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: REVEAL_MS - 900, useNativeDriver: true }),
      ]),
    ]).start(() => {
      const now = Date.now();
      const day = fortuneDayKey(now);
      const { luck, amount, textIndex } = drawFortune(Math.random(), Math.random(), Math.random(), FORTUNE_TEXTS.great.length);
      const store = useAppStore.getState();
      store.setFortune({ day, luck, amount, text: FORTUNE_TEXTS[luck][textIndex] });
      store.creditWallet({ amount, kind: 'fortune', note: t('日签 · {luck}', { luck: t(FORTUNES[luck].label) }) });
      setToday(day);
      setRevealing(false);
    });
  };

  const ledger = [...wallet.ledger].reverse();

  return (
    <AppScreen title={t('日签')} pattern onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('零钱')}</Text>
          <Text style={styles.balance}>{money(wallet.balance)}</Text>
        </Card>

        <Pressable onPress={look} disabled={revealing || drawn}>
          <Animated.View style={[styles.ball, { transform: [{ scale }] }]}>
            <Animated.View style={[styles.glow, { opacity: glow }]} />
            {drawn && fortune && luckMeta ? (
              <View style={styles.result}>
                <Text style={styles.luck}>{t(luckMeta.label)}</Text>
                <Text style={styles.amount}>+{money(fortune.amount)}</Text>
                <Text style={styles.sign}>{t(fortune.text)}</Text>
              </View>
            ) : (
              <View style={styles.result}>
                <MingCute name="sparkles" size={44} color={Romance.accent} />
                <Text style={styles.hint}>{revealing ? t('…') : t('今天的运势')}</Text>
              </View>
            )}
          </Animated.View>
        </Pressable>

        <Button
          label={drawn ? t('明天再来') : revealing ? t('…') : t('看一眼')}
          disabled={revealing || drawn}
          onPress={look}
          style={styles.lookBtn}
        />

        <Text style={styles.sectionTitle}>{t('账单')}</Text>
        <Card style={styles.ledgerCard}>
          {ledger.length === 0 ? (
            <Text style={styles.empty}>{t('还是空的。')}</Text>
          ) : (
            ledger.map((e, i) => (
              <View key={e.id} style={[styles.row, i > 0 && styles.rowLine]}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {e.note || t(KIND_LABEL[e.kind])}
                  </Text>
                  <Text style={styles.rowSub}>
                    {t(KIND_LABEL[e.kind])} · {dayLabel(e.at)}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, e.amount < 0 && styles.rowAmountOut]}>
                  {e.amount < 0 ? '-' : '+'}
                  {money(Math.abs(e.amount))}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    body: { paddingHorizontal: Space.screen, paddingTop: Space.screen, paddingBottom: 40, gap: Space.screen, alignItems: 'stretch' },
    balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    balanceLabel: { fontSize: 13, color: Romance.sub },
    balance: { fontFamily: Fonts.labelBold, fontSize: 22, color: Romance.ink },
    ball: {
      width: BALL,
      height: BALL,
      borderRadius: BALL / 2,
      alignSelf: 'center',
      backgroundColor: Romance.accentSoft,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha('#FFFFFF', 0.7) },
    result: { alignItems: 'center', paddingHorizontal: 24, gap: 6 },
    hint: { fontSize: 14, color: Romance.sub, marginTop: 4 },
    luck: { fontSize: 30, fontWeight: '700', color: Romance.ink },
    amount: { fontFamily: Fonts.labelBold, fontSize: 20, color: Romance.accentStrong },
    sign: { fontSize: 13, color: Romance.sub, textAlign: 'center', lineHeight: 19 },
    lookBtn: { alignSelf: 'center', minWidth: 160 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub, marginTop: 4 },
    ledgerCard: { paddingVertical: 4 },
    empty: { fontSize: 13, color: Romance.sub, paddingVertical: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    rowLine: { borderTopWidth: Shape.stroke, borderTopColor: Romance.stroke },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    rowAmount: { fontFamily: Fonts.labelBold, fontSize: 14, color: Romance.accentStrong },
    rowAmountOut: { color: Romance.ink },
  })
);

/**
 * 钱包（D-138）：她的零钱余额 + Coin 流水（日签 / 转盘 / 红包 / 外卖 / 退回）。只看，不在这里花——
 * 拿钱去幸运签，花钱去会话（红包）与外卖。
 * 纸面：白卡列表，金额 Fredoka、中文走系统字体。
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { money } from '@/lib/format';
import { localeOf, t } from '@/lib/i18n';
import type { LedgerKind } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const KIND_LABEL: Record<LedgerKind, string> = {
  fortune: '日签',
  wheel: '转盘',
  redpacket: '红包',
  delivery: '外卖',
  salary: '工资',
  refund: '退回',
  tip: '打赏',
};

function dayLabel(at: number): string {
  try {
    return new Date(at).toLocaleDateString(localeOf(), { month: 'numeric', day: 'numeric' });
  } catch {
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

export default function WalletScreen() {
  const router = useRouter();
  const wallet = useAppStore((s) => s.wallet);
  const ledger = [...wallet.ledger].reverse();
  const inSum = wallet.ledger.reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0);
  const outSum = wallet.ledger.reduce((s, e) => (e.amount < 0 ? s - e.amount : s), 0);

  return (
    <AppScreen title={t('钱包')} pattern onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('零钱')}</Text>
          <Text style={styles.balance}>{money(wallet.balance)}</Text>
          <View style={styles.sums}>
            <Text style={styles.sumText}>
              {t('收到')} <Text style={styles.sumNum}>+{money(inSum)}</Text>
            </Text>
            <Text style={styles.sumText}>
              {t('花掉')} <Text style={styles.sumNum}>-{money(outSum)}</Text>
            </Text>
          </View>
        </Card>

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
    balanceCard: { alignItems: 'center', gap: 4, paddingVertical: 22 },
    balanceLabel: { fontSize: 13, color: Romance.sub },
    balance: { fontFamily: Fonts.labelBold, fontSize: 34, color: Romance.ink },
    sums: { flexDirection: 'row', gap: 18, marginTop: 8 },
    sumText: { fontSize: 12, color: Romance.sub },
    sumNum: { fontFamily: Fonts.label, color: Romance.ink },
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

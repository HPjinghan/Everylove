/**
 * 钱包（D-138）：她的零钱余额 + Coin 流水（日签 / 转盘 / 红包 / 外卖 / 退回）。只看，不在这里花——
 * 拿钱去幸运签，花钱去会话（红包）与外卖。
 * 纸面：白卡列表，金额 Fredoka、中文走系统字体。
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { money } from '@/lib/format';
import { localeOf, t } from '@/lib/i18n';
import type { LedgerEntry, LedgerKind } from '@/lib/types';
import { FORTUNE_ORDER, FORTUNES } from '@/lib/wallet';
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

/**
 * 账单一行的标题：日签 / 转盘只存运势键或倍数（幸运签写入），这里按当前语言拼——切换语言后老账也跟着变；
 * 别的种类的 note 本身就说清了是什么（「给 X 的红包」「给自己点的…」），原样显示。副行只放日期，不再重复种类。
 */
function entryTitle(e: LedgerEntry, nameOf: (bondId: string) => string | undefined): string {
  // 红包 / 退回：按当前语言现拼（写入时的 note 是当时的语言），找不到那段羁绊就用 note
  const name = e.bondId ? nameOf(e.bondId) : undefined;
  if (name && e.kind === 'refund') return t('{name} 没拆的红包', { name });
  if (name && e.kind === 'redpacket') {
    return e.amount < 0 ? t('给 {name} 的红包', { name }) : t('{name} 的红包', { name });
  }
  if (e.kind === 'fortune' && e.note && FORTUNE_ORDER.some((k) => FORTUNES[k].label === e.note)) {
    return t('日签 · {luck}', { luck: t(e.note) });
  }
  if (e.kind === 'wheel' && e.note?.startsWith('×')) return t('转盘 · {mult}', { mult: e.note });
  return e.note || t(KIND_LABEL[e.kind]);
}

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
  const bonds = useAppStore((s) => s.bonds);
  const nameOf = (bondId: string) => bonds.find((b) => b.id === bondId)?.name;
  const inSum = wallet.ledger.reduce((s, e) => (e.amount > 0 ? s + e.amount : s), 0);
  const outSum = wallet.ledger.reduce((s, e) => (e.amount < 0 ? s - e.amount : s), 0);

  return (
    <AppScreen title={t('钱包')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('零钱')}</Text>
          {/* 标签已经叫「零钱」（Coins），这里只写数，不再挂单位 */}
          <Text style={styles.balance}>{Math.round(wallet.balance)}</Text>
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
                    {entryTitle(e, nameOf)}
                  </Text>
                  <Text style={styles.rowSub}>{dayLabel(e.at)}</Text>
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
    balanceLabel: { fontSize: Type.scale.label.size, color: Romance.sub },
    balance: { fontFamily: Fonts.labelBold, fontSize: 34, color: Romance.ink },
    sums: { flexDirection: 'row', gap: 18, marginTop: 8 },
    sumText: { fontSize: Type.scale.caption.size, color: Romance.sub },
    sumNum: { fontFamily: Fonts.label, color: Romance.ink },
    sectionTitle: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.sub, marginTop: 4 },
    ledgerCard: { paddingVertical: 4 },
    empty: { fontSize: Type.scale.label.size, color: Romance.sub, paddingVertical: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    rowLine: { borderTopWidth: Shape.stroke, borderTopColor: Romance.stroke },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: Type.scale.sub.size, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: Type.scale.timestamp.size, color: Romance.sub, marginTop: 2 },
    rowAmount: { fontFamily: Fonts.labelBold, fontSize: Type.scale.sub.size, color: Romance.accentStrong },
    rowAmountOut: { color: Romance.ink },
  })
);

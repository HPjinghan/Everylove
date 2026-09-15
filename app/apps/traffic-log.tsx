/**
 * 流量流水（D-134）：每一笔用量——聊天 / 后台生成 / 生图 / 语音合成 / 识别 / 看图——折了多少 MB、哪家、真实还是估算。设置 → 流量 → 流水。
 */

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { mb } from '@/lib/traffic';
import type { TrafficEntry } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const KIND_LABEL: Record<TrafficEntry['kind'], string> = {
  reply: '聊天',
  task: '后台',
  image: '生图',
  tts: '语音合成',
  asr: '语音识别',
  vision: '看图',
};

function timeLabel(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TrafficLogScreen() {
  const router = useRouter();
  const log = useAppStore((s) => s.trafficLog);
  const rows = [...log].reverse();
  const total = log.reduce((s, e) => s + e.mb, 0);
  return (
    <AppScreen title={t('流水')} pattern onBack={() => (router.canGoBack() ? router.back() : router.replace('/apps/settings'))}>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.sum}>
          <Text style={styles.sumLabel}>{t('最近 {n} 笔', { n: log.length })}</Text>
          <Text style={styles.sumValue}>{mb(total)}</Text>
        </Card>
        <Card style={styles.list}>
          {rows.length === 0 ? (
            <Text style={styles.empty}>{t('还是空的。')}</Text>
          ) : (
            rows.map((e, i) => (
              <View key={e.id} style={[styles.row, i > 0 && styles.rowLine]}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>
                    {t(KIND_LABEL[e.kind])} · {e.provider}
                  </Text>
                  <Text style={styles.rowSub}>
                    {timeLabel(e.at)}
                    {e.tokens ? ` · ${e.tokens.toLocaleString('en-US')} tok` : ''}
                    {e.estimated ? ` · ${t('估算')}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowMb}>-{mb(e.mb)}</Text>
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
    body: { paddingHorizontal: Space.screen, paddingTop: Space.screen, paddingBottom: 40, gap: Space.inlineLoose },
    sum: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sumLabel: { fontSize: 13, color: Romance.sub },
    sumValue: { fontFamily: Fonts.labelBold, fontSize: 20, color: Romance.ink },
    list: { paddingVertical: 4 },
    empty: { fontSize: 13, color: Romance.sub, paddingVertical: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    rowLine: { borderTopWidth: Shape.stroke, borderTopColor: Romance.stroke },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    rowMb: { fontFamily: Fonts.labelBold, fontSize: 14, color: Romance.accentStrong },
  })
);

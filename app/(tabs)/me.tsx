/**
 * 我的：槽位与订阅（占位）、素材开关（占位）、我的创作、开发者与测试工具。
 */

import * as Notifications from 'expo-notifications';
import { type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Romance } from '@/constants/theme';
import { deliverAndSyncArrivals } from '@/lib/arrivals';
import { ENV_ANTHROPIC_KEY, ENV_QIANFAN_KEY, QIANFAN_MODEL } from '@/lib/engine';
import { deliverComic, imageKeyReady } from '@/lib/imagegen';
import { cancelScheduled } from '@/lib/notifications';
import { useAppStore } from '@/store/app-store';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  dim,
  onPress,
}: {
  label: string;
  value?: string;
  dim?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? (
        <Text style={[styles.rowValue, dim && { color: Romance.faint }]}>{value}</Text>
      ) : null}
    </Pressable>
  );
}

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const engine = useAppStore((s) => s.engine);
  const anthropicKey = useAppStore((s) => s.anthropicKey);
  const qianfanKey = useAppStore((s) => s.qianfanKey);

  const testArrival = async () => {
    const bond = bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去广场领养一个 TA，再来测试开门。');
      return;
    }
    await cancelScheduled(bond.notifId);
    useAppStore.getState().devSetArrivalSoon(3);
    await deliverAndSyncArrivals();
    Alert.alert('已排好', `${bond.name}会在 3 分钟后来找你。\n把 App 收进后台，等他敲门。`);
  };

  const testComic = () => {
    const bond = bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去广场领养一个 TA，再来测试漫画。');
      return;
    }
    if (!imageKeyReady()) {
      Alert.alert('未配置千帆 key', '图像与聊天共用千帆 key：在 .env.local 或上方输入框填好即可。');
      return;
    }
    deliverComic(bond.id);
    Alert.alert('他动笔了', '生成大约需要半分钟到一分钟，去他的会话里等着。');
  };

  const reset = () => {
    Alert.alert('重置全部数据', '所有羁绊、聊天记录和创作都会消失。他们会忘记你。', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          useAppStore.getState().resetAll();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>我的</Text>

      <Section title="羁绊与订阅">
        <Row label="羁绊槽位" value={`${bonds.length}/1 · 首个免费`} />
        <Row label="加槽" value="正式版开放" dim />
        <Row label="订阅「他在」" value="敬请期待" dim />
      </Section>

      <Section title="素材开关">
        <Row label="分享给他" value="即将上线" dim />
        <Row label="口味偏好" value="即将上线" dim />
        <Row label="日记本（私密）" value="即将上线" dim />
        <Text style={styles.footHint}>开得越多，TA 越懂你。全部可随时关闭。</Text>
      </Section>

      <Section title="我的创作">
        <Row label="捏出的角色" value={`${customs.length} 个`} />
        <Row label="被领养数 · 分成" value="敬请期待" dim />
      </Section>

      <Section title="开发者（试装）">
        <View style={styles.engineRow}>
          {(
            [
              ['mock', '脚本引擎'],
              ['anthropic', 'Claude'],
              ['qianfan', `千帆·${QIANFAN_MODEL}`],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              style={[styles.engineBtn, engine === id && styles.engineBtnActive]}
              onPress={() => useAppStore.getState().setEngine(id)}>
              <Text style={[styles.engineText, engine === id && styles.engineTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {engine === 'anthropic' && (
          <>
            <TextInput
              style={styles.keyInput}
              value={anthropicKey}
              onChangeText={(t) => useAppStore.getState().setAnthropicKey(t.trim())}
              placeholder={
                ENV_ANTHROPIC_KEY
                  ? '已读取工程配置 .env.local，此处填写可覆盖'
                  : 'sk-ant-…（推荐填在 .env.local，仅存本机）'
              }
              placeholderTextColor={Romance.faint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.footHint}>没有 key 或调用失败时，自动回落脚本引擎。</Text>
          </>
        )}
        {engine === 'qianfan' && (
          <>
            <TextInput
              style={styles.keyInput}
              value={qianfanKey}
              onChangeText={(t) => useAppStore.getState().setQianfanKey(t.trim())}
              placeholder={
                ENV_QIANFAN_KEY
                  ? '已读取工程配置 .env.local，此处填写可覆盖'
                  : '千帆 API Key（推荐填在 .env.local，仅存本机）'
              }
              placeholderTextColor={Romance.faint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.footHint}>
              模型 {QIANFAN_MODEL}，可在 .env.local 用 EXPO_PUBLIC_QIANFAN_MODEL 换；失败回落脚本引擎。
            </Text>
          </>
        )}
        <Row label="让 TA 3 分钟后来开门（测试）" onPress={testArrival} />
        <Row
          label={`让 TA 送一张漫画（测试）${imageKeyReady() ? '' : ' · 未配 key'}`}
          onPress={testComic}
        />
        <Row label="重置全部数据" onPress={reset} />
      </Section>

      <Text style={styles.about}>全自动恋爱（代号） · 试装 0.1.0{'\n'}零劳动被爱 · 他说到做到</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Romance.ink, marginBottom: 6 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub, marginBottom: 8 },
  sectionBody: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Romance.line,
  },
  rowLabel: { fontSize: 14, color: Romance.ink },
  rowValue: { fontSize: 13, color: Romance.sub },
  footHint: { fontSize: 11, color: Romance.faint, padding: 12 },
  engineRow: { flexDirection: 'row', gap: 8, padding: 12 },
  engineBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Romance.bg,
  },
  engineBtnActive: { backgroundColor: Romance.accent },
  engineText: { fontSize: 13, color: Romance.sub, fontWeight: '500' },
  engineTextActive: { color: '#fff' },
  keyInput: {
    marginHorizontal: 12,
    backgroundColor: Romance.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Romance.ink,
  },
  about: {
    textAlign: 'center',
    fontSize: 11,
    color: Romance.faint,
    marginTop: 30,
    lineHeight: 18,
  },
});

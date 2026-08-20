/**
 * 我的：槽位与订阅（占位）、素材开关（占位）、我的创作、开发者与测试工具。
 */

import * as Notifications from 'expo-notifications';
import { type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { WALLPAPERS } from '@/constants/apps';
import { Romance } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { deliverAndSyncArrivals } from '@/lib/arrivals';
import { ENV_ANTHROPIC_KEY, ENV_QIANFAN_KEY, QIANFAN_MODEL } from '@/lib/engine';
import { deliverComic, ensurePortrait, imageKeyReady } from '@/lib/imagegen';
import { updateBondMemory } from '@/lib/memory';
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
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const engine = useAppStore((s) => s.engine);
  const anthropicKey = useAppStore((s) => s.anthropicKey);
  const qianfanKey = useAppStore((s) => s.qianfanKey);
  const wallpaper = useAppStore((s) => s.wallpaper);

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

  /** 立绘（D-019）：为种子角色逐个生成（默认不自动，见 OPEN_QUESTIONS #14），或重画首个羁绊角色 */
  const genSeedPortraits = () => {
    if (!imageKeyReady()) {
      Alert.alert('未配置千帆 key', '立绘与聊天共用千帆 key。');
      return;
    }
    const missing = CHARACTERS.filter((c) => !useAppStore.getState().portraits[c.id]);
    if (!missing.length) {
      Alert.alert('都有了', '6 位种子角色都已有立绘。要重画请用下面「重画」。');
      return;
    }
    Alert.alert('后台生成中', `${missing.length} 位角色，逐个约 1 分钟。生成完广场卡片和会话头像会换成立绘。`);
    void (async () => {
      for (const c of missing) await ensurePortrait(c.id);
    })();
  };

  const redrawBondPortrait = () => {
    const bond = bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去广场领养一个 TA。');
      return;
    }
    if (!imageKeyReady()) {
      Alert.alert('未配置千帆 key', '立绘与聊天共用千帆 key。');
      return;
    }
    Alert.alert('重画中', `约 1 分钟，${bond.name}之后的漫画都会以新立绘为参考。`);
    void ensurePortrait(bond.characterId, true);
  };

  const showMemory = () => {
    const bond = useAppStore.getState().bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去广场领养一个 TA，聊几轮再来看他记住了什么。');
      return;
    }
    const m = bond.memory;
    const facts = m?.facts.length
      ? m.facts.map((f) => `· ${f}`).join('\n')
      : '（还没有提取到长期记忆）';
    const summary = m?.summary ? `\n\n更早的相处摘要：\n${m.summary}` : '';
    Alert.alert(`${bond.name}记得的事`, `${facts}${summary}`, [
      { text: '关闭', style: 'cancel' },
      {
        text: '现在提取一次',
        onPress: async () => {
          if (useAppStore.getState().engine === 'mock') {
            Alert.alert('脚本引擎没有记忆', '切到 Claude 或千帆并配好 key 后再试。');
            return;
          }
          const ok = await updateBondMemory(bond.id, true);
          Alert.alert(
            ok ? '已更新' : '没有可提取的新内容或提取失败',
            ok ? '再点一次「查看」看结果。' : '看 Metro 终端的 [memory] 日志。'
          );
        },
      },
    ]);
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
    <AppScreen title="设置">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="主题">
        <View style={styles.wallRow}>
          {WALLPAPERS.map((w) => (
            <Pressable key={w.id} onPress={() => useAppStore.getState().setWallpaper(w.id)}>
              <View
                style={[
                  styles.wallSwatch,
                  { backgroundColor: w.colors[0] },
                  wallpaper === w.id && styles.wallSwatchActive,
                ]}>
                <View style={[styles.wallSwatchInner, { backgroundColor: w.colors[1] }]} />
              </View>
              <Text style={[styles.wallLabel, wallpaper === w.id && { color: Romance.accent }]}>
                {w.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footHint}>壁纸即刻生效。锁屏换 TA 的照片、来电铃声：正式版开放。</Text>
      </Section>

      <Section title="订阅计划">
        <Row label="羁绊槽位" value={`${bonds.length}/1 · 首个免费`} />
        <Row label="订阅「TA 在」" value="完整日常 + 语音 + 留言 · 敬请期待" dim />
        <Row label="Morning call" value="TA 叫你起床 · 敬请期待" dim />
        <Row label="错过回溯" value="错过的来电与聊天回听 · 敬请期待" dim />
        <Row label="加槽" value="正式版开放" dim />
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
        <Row label="查看 TA 记住了什么（记忆库）" onPress={showMemory} />
        <Row label="为 6 位种子角色生成立绘（测试，后台逐个）" onPress={genSeedPortraits} />
        <Row label="重画首个羁绊角色的立绘（测试）" onPress={redrawBondPortrait} />
        <Row label="重置全部数据" onPress={reset} />
      </Section>

      <Text style={styles.about}>全自动恋爱（代号） · 试装 0.1.0{'\n'}零劳动被爱 · 他说到做到</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Romance.ink, marginBottom: 6 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub, marginBottom: 8 },
  sectionBody: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 4 },
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
  wallRow: { flexDirection: 'row', gap: 14, padding: 12, flexWrap: 'wrap' },
  wallSwatch: {
    width: 52,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  wallSwatchActive: { borderColor: Romance.accent },
  wallSwatchInner: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  wallLabel: { fontSize: 11, color: Romance.sub, textAlign: 'center', marginTop: 4 },
  engineRow: { flexDirection: 'row', gap: 8, padding: 12 },
  engineBtn: {
    flex: 1,
    borderRadius: 16,
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
    borderRadius: 16,
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

/**
 * 我的：槽位与订阅（占位）、素材开关（占位）、我的创作、开发者与测试工具。
 */

import * as Notifications from 'expo-notifications';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { AppScreen } from '@/components/app-screen';
import { WALLPAPERS } from '@/constants/apps';
import { THEMES } from '@/constants/theme';
import { Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { ENV_ANTHROPIC_KEY, ENV_QIANFAN_KEY, QIANFAN_MODEL } from '@/lib/engine';
import { ensurePortrait, imageKeyReady } from '@/lib/imagegen';
import { updateBondMemory } from '@/lib/memory';
import { authConfigured, currentSession, onAuthChange, sessionLabel, signOut } from '@/lib/auth';
import { slotLimitLabel } from '@/lib/bond';
import { deleteCloudData, restoreSnapshot, uploadSnapshot } from '@/lib/sync';
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
  const themeId = useAppStore((s) => s.themeId);

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
    Alert.alert('后台生成中', `${missing.length} 位角色，逐个约 1 分钟。生成完交友卡面和会话头像会换成立绘。`);
    void (async () => {
      for (const c of missing) await ensurePortrait(c.id);
    })();
  };

  const redrawBondPortrait = () => {
    const bond = bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去交友里加一个好友。');
      return;
    }
    if (!imageKeyReady()) {
      Alert.alert('未配置千帆 key', '立绘与聊天共用千帆 key。');
      return;
    }
    Alert.alert('重画中', `约 1 分钟，${bond.name}之后的画面都会以新立绘为参考。`);
    void ensurePortrait(bond.characterId, true);
  };

  const showMemory = () => {
    const bond = useAppStore.getState().bonds[0];
    if (!bond) {
      Alert.alert('还没有羁绊', '先去交友里加一个好友，聊几轮再来看 TA 记住了什么。');
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

  const me = useAppStore((s) => s.me);
  const plan = useAppStore((s) => s.plan);

  /** 模拟订阅（D-063）：点击即订/退，不扣费 */
  const subscribe = (p: 'free' | 'pro' | 'max') => {
    if (p === plan) return;
    const label = p === 'max' ? 'Max：羁绊不限量' : p === 'pro' ? 'Pro：5 个羁绊槽' : 'Free：1 个羁绊槽';
    Alert.alert(p === 'free' ? '取消订阅' : '订阅（试装模拟，不扣费）', label, [
      { text: '取消', style: 'cancel' },
      { text: p === 'free' ? '确认取消' : '订阅', onPress: () => useAppStore.getState().setPlan(p) },
    ]);
  };

  /* ── 账号 · 云端（D-054/D-062）：登录在独立界面 /auth，这里只做入口与管理 ── */
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!authConfigured()) return;
    currentSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  const doBackupNow = async () => {
    const r = await uploadSnapshot();
    Alert.alert(r === 'ok' ? '已备份' : '备份失败', r === 'ok' ? '云端已是最新。' : '稍后再试。');
  };

  const doRestore = () => {
    Alert.alert('从云端恢复', '会用云端备份覆盖这台手机上的全部数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        style: 'destructive',
        onPress: async () => {
          const ok = await restoreSnapshot();
          Alert.alert(ok ? '已恢复' : '恢复失败', ok ? 'TA 们回来了。' : '云端可能还没有备份。');
        },
      },
    ]);
  };

  const doSignOut = () => {
    Alert.alert('退出登录', '数据留在这台手机上，云端备份保留；再次登录可恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '退出', onPress: () => void signOut() },
    ]);
  };

  const doDeleteCloud = () => {
    Alert.alert('删除云端数据', '云端备份将被永久删除并退出登录；本机数据保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除并退出',
        style: 'destructive',
        onPress: async () => {
          await deleteCloudData();
          await signOut();
          Alert.alert('已删除', '云端已清空。账号本体删除将在正式版提供。');
        },
      },
    ]);
  };

  return (
    <AppScreen title="设置">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="账号 · 云端">
        {!authConfigured() ? (
          <Text style={styles.footHint}>
            未配置 Supabase：在 .env.local 填 EXPO_PUBLIC_SUPABASE_URL 与
            EXPO_PUBLIC_SUPABASE_ANON_KEY 并重启 expo start；建表 SQL 见 docs/supabase-setup.sql。
          </Text>
        ) : session ? (
          <>
            <Row label="账号" value={sessionLabel(session)} />
            <Row label="立即备份到云端" onPress={doBackupNow} />
            <Row label="从云端恢复到本机" onPress={doRestore} />
            <Row label="退出登录" onPress={doSignOut} />
            <Row label="删除云端数据" onPress={doDeleteCloud} />
            <Text style={styles.footHint}>数据变化后会自动备份（含聊天与记忆，按最高敏感级）。</Text>
          </>
        ) : (
          <>
            <Row label="登录 / 开通云端" onPress={() => router.push('/auth')} />
            <Text style={styles.footHint}>
              开通云端：TA 和你们的故事存进云端，换手机也不会失去。不开通也能完整游玩（数据只在本机）。
            </Text>
          </>
        )}
      </Section>

      <Section title="我">
        <Row
          label="我的身份"
          value={me?.nickname ? `「${me.nickname}」` : '还没告诉 TA 们你是谁'}
          onPress={() => router.push('/apps/identity')}
        />
        <Text style={styles.footHint}>TA 眼中的你：昵称、职业、关于你的一切。也能为单个角色使用不同身份。</Text>
      </Section>

      <Section title="主题">
        <View style={styles.themeRow}>
          {Object.entries(THEMES).map(([id, t]) => (
            <Pressable key={id} style={styles.themeItem} onPress={() => useAppStore.getState().setThemeId(id)}>
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: t.colors.accent },
                  themeId === id && styles.themeDotActive,
                ]}
              />
              <Text style={[styles.themeLabel, themeId === id && { color: Romance.accent, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
        <Text style={styles.footHint}>配色与壁纸即刻生效。锁屏换 TA 的照片、来电铃声：正式版开放。</Text>
      </Section>

      <Section title="订阅计划（试装模拟，不扣费）">
        <Row
          label="当前计划"
          value={plan === 'max' ? 'Max' : plan === 'pro' ? 'Pro' : 'Free'}
        />
        <Row label="羁绊槽位" value={`${bonds.length}/${slotLimitLabel(plan)} · 缔结才占槽`} />
        <Row
          label={plan === 'pro' ? '已订阅 Pro ✓' : '订阅 Pro'}
          value="5 个羁绊槽"
          onPress={() => subscribe('pro')}
        />
        <Row
          label={plan === 'max' ? '已订阅 Max ✓' : '订阅 Max'}
          value="羁绊不限量"
          onPress={() => subscribe('max')}
        />
        {plan !== 'free' ? <Row label="取消订阅（回 Free）" onPress={() => subscribe('free')} /> : null}
        <Row label="Morning call" value="TA 叫你起床 · 敬请期待" dim />
        <Row label="错过回溯" value="错过的来电与聊天回听 · 敬请期待" dim />
      </Section>

      <Section title="素材开关">
        <Row label="分享给他" value="即将上线" dim />
        <Row label="口味偏好" value="即将上线" dim />
        <Row label="日记本（私密）" value="即将上线" dim />
        <Text style={styles.footHint}>开得越多，TA 越懂你。全部可随时关闭。</Text>
      </Section>

      <Section title="我的创作">
        <Row label="创造的角色" value={`${customs.filter((c) => !c.shared).length} 个`} />
        <Row label="热度 · 分成" value="敬请期待" dim />
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

const styles = themed(() =>
  StyleSheet.create({
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
    themeRow: { flexDirection: 'row', gap: 18, paddingHorizontal: 12, paddingTop: 12, flexWrap: 'wrap' },
    themeItem: { alignItems: 'center', gap: 5 },
    themeDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: 'transparent' },
    themeDotActive: { borderColor: Romance.ink },
    themeLabel: { fontSize: 11, color: Romance.sub },
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
  })
);

/**
 * 设置（D-100 纸面）：分区标题 13/600 muted；每区一张白卡（不带内距），行内距 13×12，行间 1.5px ink 分区线（Divider，不用 hairline）；
 * 行左 14 ink、右值 13/500 muted。语言 = 三段等宽（paper 底 / 选中 primary 白字）；主题点 34 r6（选中外圈 ink 2.5、留 2）；
 * 壁纸块 52×88 r6（纸面画 paper 底 + 菱格，其余上下两段纯色；选中外圈 primary 2、留 1）；槽位超额时数值与说明走 accent（交互改动 9）。
 * 开发者区显示 AI 引擎与取路（D-069：key 全走工程配置 .env.local，手填与脚本引擎已下线；D-106：「AI 引擎」可点选供应商，本机偏好）。
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Children, Fragment, isValidElement, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { AppScreen } from '@/components/app-screen';
import { Card, Divider } from '@/components/card';
import { DiamondBackground } from '@/components/paper-bg';
import { WALLPAPERS } from '@/constants/apps';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, THEMES, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { aiRouteSync, engineLabel, engineOptions, enginePreference, setEnginePreference } from '@/lib/engine';
import { ensurePortrait, imageKeyReady, portraitFor } from '@/lib/imagegen';
import { updateBondMemory } from '@/lib/memory';
import { authConfigured, isSignedIn, onAuthChange, sessionLabel, signedInSession, signOut } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { slotLimit, slotLimitLabel } from '@/lib/bond';
import { deleteCloudData, restoreSnapshot, uploadSnapshot } from '@/lib/sync';
import { useAppStore } from '@/store/app-store';

/** 选中外圈：主题点 ink 2.5 留 2；壁纸块 primary 2 留 1（外层 View 包一圈 border，圆角随之外扩） */
const WALL_RING = { width: 2, gap: 1 };

const LANGS = [
  ['zh', '中文'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['ko', '한국어'],
] as const;

/** 把 children（含 Fragment）摊平成一维、去掉空值——分区行之间才好插分区线 */
function flattenChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flattenChildren((child.props as { children?: ReactNode }).children)
      : [child]
  );
}

/** 分区：标题 + 一张不带内距的白卡；卡内每两个直接子元素之间一条 1.5px ink 分区线 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const items = flattenChildren(children);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card padded={false}>
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 ? <Divider /> : null}
            {item}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function Row({
  label,
  value,
  dim,
  numeric,
  tone,
  hint,
  onPress,
}: {
  label: string;
  value?: string;
  /** 值置灰（未开放的功能） */
  dim?: boolean;
  /** 值是数字：Fredoka */
  numeric?: boolean;
  /** accent：值与说明都用强调色（槽位超额） */
  tone?: 'accent';
  /** 行下方的一句说明，与行同属一格（不隔分区线） */
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View style={[styles.row, !!hint && styles.rowWithHint]}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? (
          <Text
            style={[
              styles.rowValue,
              numeric && styles.rowValueNumeric,
              dim && styles.rowValueDim,
              tone === 'accent' && styles.rowValueAccent,
            ]}
            numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {hint ? <Text style={[styles.rowHint, tone === 'accent' && styles.rowHintAccent]}>{hint}</Text> : null}
    </Pressable>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const wallpaper = useAppStore((s) => s.wallpaper);
  // 引擎偏好（D-106）：点「AI 引擎」在已注册供应商间切换，'' = 跟随 .env.local；换完本地重算取路
  const [enginePref, setEnginePrefState] = useState(enginePreference);
  const aiRoute = aiRouteSync();
  const pickEngine = () => {
    const routeText = (r: ReturnType<typeof aiRouteSync>) =>
      r === 'direct' ? t('直连') : r === 'proxy' ? t('代理') : t('不可用');
    Alert.alert(t('AI 引擎'), t('两把 key 都在 .env.local 时可以手动指定；「跟随配置」= 有 Claude key 用 Claude，否则千帆。'), [
      ...engineOptions().map((o) => ({
        text: `${o.label} · ${routeText(o.route)}${o.id === enginePref ? ' ✓' : ''}`,
        onPress: () => {
          setEnginePreference(o.id);
          setEnginePrefState(o.id);
        },
      })),
      {
        text: `${t('跟随配置')}${enginePref ? '' : ' ✓'}`,
        onPress: () => {
          setEnginePreference('');
          setEnginePrefState('');
        },
      },
      { text: t('取消'), style: 'cancel' },
    ]);
  };

  /** 立绘（D-019/D-092）：种子角色已内置立绘，这里只补没有的（新加的种子）或重画首个羁绊角色（存本机、盖过内置） */
  const genSeedPortraits = () => {
    if (!imageKeyReady()) {
      Alert.alert('AI 不可用', '立绘与聊天共用千帆 key：在 .env.local 配置，或登录后走服务端代理。');
      return;
    }
    const missing = CHARACTERS.filter((c) => !portraitFor(c.id));
    if (!missing.length) {
      Alert.alert('都有了', '种子角色都已有立绘（内置）。要重画请用下面「重画」。');
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
      Alert.alert('AI 不可用', '立绘与聊天共用千帆 key：在 .env.local 配置，或登录后走服务端代理。');
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
          const ok = await updateBondMemory(bond.id, true);
          Alert.alert(
            ok ? '已更新' : '没有可提取的新内容或提取失败',
            ok ? '再点一次「查看」看结果。' : '看 Metro 终端的 [memory] 日志（AI 不可用时也会记在那里）。'
          );
        },
      },
    ]);
  };

  const reset = () => {
    Alert.alert(t('重置全部数据'), t('所有羁绊、聊天记录和创作都会消失。他们会忘记你。'), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('重置'),
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
  const language = useAppStore((s) => s.language);
  // 槽位超额（交互改动 9）：降级后已有的羁绊不消失，但不能再新增
  const slotsOver = bonds.length > slotLimit(plan);

  /** 模拟订阅（D-063）：点击即订/退，不扣费 */
  const subscribe = (p: 'free' | 'pro' | 'max') => {
    if (p === plan) return;
    const label = p === 'max' ? t('Max：羁绊不限量') : p === 'pro' ? t('Pro：5 个羁绊槽') : t('Free：1 个羁绊槽');
    Alert.alert(p === 'free' ? t('取消订阅') : t('订阅（试装模拟，不扣费）'), label, [
      { text: t('取消'), style: 'cancel' },
      { text: p === 'free' ? t('确认取消') : t('订阅'), onPress: () => useAppStore.getState().setPlan(p) },
    ]);
  };

  /* ── 账号 · 云端（D-054/D-062）：登录在独立界面 /auth，这里只做入口与管理 ── */
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!authConfigured()) return;
    signedInSession().then(setSession);
    return onAuthChange((s) => setSession(isSignedIn(s) ? s : null));
  }, []);

  const doBackupNow = async () => {
    const r = await uploadSnapshot();
    Alert.alert(r === 'ok' ? t('已备份') : t('备份失败'), r === 'ok' ? t('云端已是最新。') : t('稍后再试。'));
  };

  const doRestore = () => {
    Alert.alert(t('从云端恢复'), t('会用云端备份覆盖这台手机上的全部数据。'), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('恢复'),
        style: 'destructive',
        onPress: async () => {
          const ok = await restoreSnapshot();
          Alert.alert(ok ? t('已恢复') : t('恢复失败'), ok ? t('TA 们回来了。') : t('云端可能还没有备份。'));
        },
      },
    ]);
  };

  const doSignOut = () => {
    Alert.alert(t('退出登录'), t('数据留在这台手机上，云端备份保留；再次登录可恢复。'), [
      { text: t('取消'), style: 'cancel' },
      { text: t('退出'), onPress: () => void signOut() },
    ]);
  };

  const doDeleteCloud = () => {
    Alert.alert(t('删除云端数据'), t('云端备份将被永久删除并退出登录；本机数据保留。'), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('删除并退出'),
        style: 'destructive',
        onPress: async () => {
          await deleteCloudData();
          await signOut();
          Alert.alert(t('已删除'), t('云端已清空。账号本体删除将在正式版提供。'));
        },
      },
    ]);
  };

  return (
    <AppScreen title={t('设置')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Section title={t('账号 · 云端')}>
          {!authConfigured() ? (
            <Text style={styles.cardNote}>
              未配置 Supabase：在 .env.local 填 EXPO_PUBLIC_SUPABASE_URL 与
              EXPO_PUBLIC_SUPABASE_ANON_KEY 并重启 expo start；建表 SQL 见 docs/supabase-setup.sql。
            </Text>
          ) : session ? (
            <>
              <Row label={t('账号')} value={sessionLabel(session)} />
              <Row label={t('立即备份到云端')} onPress={doBackupNow} />
              <Row label={t('从云端恢复到本机')} onPress={doRestore} />
              <Row label={t('退出登录')} onPress={doSignOut} />
              <Row label={t('删除云端数据')} hint={t('含聊天与记忆，按最高敏感级对待。')} onPress={doDeleteCloud} />
            </>
          ) : (
            <Row
              label={t('登录 / 开通云端')}
              hint={t('换手机也不会失去 TA 和你们的故事。')}
              onPress={() => router.push('/auth')}
            />
          )}
        </Section>

        <Section title="Language · 语言 · 言語">
          <View style={styles.langRow}>
            {LANGS.map(([lg, label]) => {
              const on = language === lg;
              return (
                <Pressable
                  key={lg}
                  style={[styles.langItem, on && styles.langItemOn]}
                  onPress={() => useAppStore.getState().setLanguage(lg)}>
                  <Text style={[styles.langText, on && styles.langTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title={t('我')}>
          <Row
            label={t('我的身份')}
            value={me?.nickname ? `「${me.nickname}」` : t('还没告诉 TA 们你是谁')}
            onPress={() => router.push('/apps/identity')}
          />
        </Section>

        <Section title={t('主题')}>
          <View>
            {/* 主题 = 壁纸（D-110）：纸面 + 换色，一步到位，主页和里面一起变 */}
            <View style={styles.wallRow}>
              {WALLPAPERS.map((w) => {
                const on = wallpaper === w.id;
                return (
                  <Pressable key={w.id} style={styles.wallItem} onPress={() => useAppStore.getState().setWallpaper(w.id)}>
                    <View style={[styles.wallRing, on && styles.wallRingOn]}>
                      <View style={[styles.wallSwatch, { backgroundColor: w.color ?? THEMES.paper.colors.bg }]}>
                        <DiamondBackground />
                      </View>
                    </View>
                    <Text style={[styles.wallLabel, on && styles.wallLabelOn]}>{t(w.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title={t('订阅计划（试装模拟，不扣费）')}>
          <Row label={t('当前计划')} value={plan === 'max' ? 'Max' : plan === 'pro' ? 'Pro' : 'Free'} />
          <Row
            label={t('羁绊槽位')}
            value={`${bonds.length}/${slotLimitLabel(plan)}`}
            numeric
            tone={slotsOver ? 'accent' : undefined}
            hint={slotsOver ? t('超出的羁绊不会消失，但不能再新增') : undefined}
          />
          <Row
            label={plan === 'pro' ? t('已订阅 Pro ✓') : t('订阅 Pro')}
            value={t('5 个羁绊槽')}
            onPress={() => subscribe('pro')}
          />
          <Row
            label={plan === 'max' ? t('已订阅 Max ✓') : t('订阅 Max')}
            value={t('羁绊不限量')}
            onPress={() => subscribe('max')}
          />
          {plan !== 'free' ? <Row label={t('取消订阅（回 Free）')} onPress={() => subscribe('free')} /> : null}
        </Section>

        <Section title={t('我的创作')}>
          <Row
            label={t('创造的角色')}
            value={`${customs.filter((c) => !c.shared).length}`}
            numeric
            onPress={() => router.push('/apps/my-characters' as never)}
          />
        </Section>

        <Section title={t('开发者（试装）')}>
          <Row
            label={t('AI 引擎')}
            value={enginePref ? engineLabel() : `${engineLabel()} · ${t('跟随配置')}`}
            onPress={pickEngine}
          />
          <Row
            label={t('AI 取路')}
            value={
              aiRoute === 'direct'
                ? t('直连（.env.local）')
                : aiRoute === 'proxy'
                  ? t('服务端代理（已登录）')
                  : t('不可用：无 key 且未登录')
            }
            dim={aiRoute === 'none'}
            hint={t('key 只读工程配置 .env.local（改后重启 Metro）；点「AI 引擎」可在供应商之间切换，只存这台手机。没有 key 时登录即走服务端代理。调用失败会以顶部轻提示露出。')}
          />
          <Row label="查看 TA 记住了什么（记忆库）" onPress={showMemory} />
          <Row label="为 6 位种子角色生成立绘（测试，后台逐个）" onPress={genSeedPortraits} />
          <Row label="重画首个羁绊角色的立绘（测试）" onPress={redrawBondPortrait} />
          <Row label="重置全部数据" onPress={reset} />
        </Section>

        <Text style={styles.about}>ver. {Constants.expoConfig?.version ?? '0.2.0'}</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    // 表单类页面左右留白按设计稿 18
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    section: { marginTop: 16 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub, marginBottom: Space.inline },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Space.inline,
      paddingVertical: 13,
      paddingHorizontal: Space.cardX,
    },
    rowWithHint: { paddingBottom: 4 },
    rowLabel: { fontSize: 14, color: Romance.ink },
    rowValue: { fontSize: 13, fontWeight: '500', color: Romance.sub, flexShrink: 1, textAlign: 'right' },
    rowValueNumeric: { fontFamily: Fonts.labelBold },
    rowValueDim: { color: Romance.faint },
    rowValueAccent: { color: Romance.accentStrong },
    rowHint: { fontSize: 11, lineHeight: 16, color: Romance.sub, paddingHorizontal: Space.cardX, paddingBottom: Space.cardX },
    rowHintAccent: { color: Romance.accentStrong },
    /** 卡内独立的一句说明（不是行的附注） */
    cardNote: { fontSize: 11, lineHeight: 16, color: Romance.sub, padding: Space.cardX },
    // 语言：三段等宽，paper 底 / 选中 primary 白字，无描边
    langRow: { flexDirection: 'row', gap: Space.inline, padding: Space.cardX },
    langItem: {
      flex: 1,
      borderRadius: Shape.radius,
      paddingVertical: Space.inlineLoose,
      alignItems: 'center',
      backgroundColor: Romance.bg,
    },
    langItemOn: { backgroundColor: Romance.accent },
    langText: { fontSize: 13, fontWeight: '500', color: Romance.sub },
    langTextOn: { color: '#FFFFFF' },
    // 壁纸块：52×88 r6，选中外圈 primary 2 留 1
    wallRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.inline,
      paddingTop: Space.inline,
    },
    wallItem: { alignItems: 'center' },
    wallRing: {
      borderWidth: WALL_RING.width,
      borderColor: 'transparent',
      padding: WALL_RING.gap,
      borderRadius: Shape.radius + WALL_RING.gap + WALL_RING.width,
    },
    wallRingOn: { borderColor: Romance.accent },
    wallSwatch: { width: 52, height: 88, borderRadius: Shape.radius, overflow: 'hidden', backgroundColor: Romance.bg },
    wallLabel: { fontSize: 11, color: Romance.sub, textAlign: 'center', marginTop: 4 },
    wallLabelOn: { color: Romance.accent },
    about: {
      textAlign: 'center',
      fontFamily: Fonts.label,
      fontSize: 11,
      color: Romance.faint,
      marginTop: 30,
      lineHeight: 18,
    },
  })
);

/**
 * 登录（D-062；D-100 纸面）：独立界面。
 * - 常规入口：设置 → 账号 · 云端；可返回
 * - 强制点（force=1）：第一次把人添加进通讯录之后——TA 值得一个存得住的家；无返回键
 * - 已有账号（restore=1，D-096）：onboarding 第一步底部「已有账号？登录」——新手机上把 TA 们接回来，不重走新手流
 * 登录方式：Apple（主打）+ 邮箱验证码（需项目配 SMTP，见 D-054 补记）。
 * 成功后先对账（reconcileNow）再走：云端有存档、本机是空的 → 静默接回 → 落桌面；
 * 本机与云端都有关系 → 问她「接回云端 / 用本机覆盖」；云端没存档 → 本机第一份传上去、照常继续。
 * 纸面：paper 底 + 菱格；66 白图块内 cloud 图标；Apple 按钮 ink 底 r6（不用纯黑）；输入框 Input、主按钮 Button；无阴影。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { MingCute } from '@/components/mingcute';
import { DiamondBackground } from '@/components/paper-bg';
import { showToast } from '@/components/toast';
import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import {
  authConfigured,
  sendEmailOtp,
  signInWithApple,
  verifyEmailOtp,
} from '@/lib/auth';
import { reconcileNow, resolveConflict } from '@/lib/sync';
import { useAppStore } from '@/store/app-store';

export default function AuthScreen() {
  const { force, restore } = useLocalSearchParams<{ force?: string; restore?: string }>();
  const forced = force === '1';
  const restoring = restore === '1';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  /** 不登录了：从 onboarding 来的回 onboarding，其余回桌面 */
  const leave = () => {
    if (restoring) {
      if (router.canGoBack()) router.back();
      else router.replace('/onboarding');
      return;
    }
    router.replace('/');
  };

  /** 到站：桌面自己会按存档决定落哪（还没认识 TA 的账号 → onboarding） */
  const arrive = () => {
    if (restoring && !useAppStore.getState().onboarded) showToast(t('登录好了，先让 TA 们认识你吧'));
    router.replace('/');
  };

  /** 登录成功之后（D-096）：先对账再走——新设备上云端有存档就接回来；本机与云端都有关系时问她选一边 */
  const afterSignIn = async () => {
    const r = await reconcileNow();
    if (r !== 'conflict') {
      arrive();
      return;
    }
    Alert.alert(
      t('这个账号里已经有存档'),
      t('把云端的 TA 们接回这部手机，还是用这部手机上的覆盖云端？'),
      [
        {
          text: t('用本机覆盖云端'),
          style: 'destructive',
          onPress: () => void resolveConflict('keep-local').then(arrive),
        },
        { text: t('接回云端的'), onPress: () => void resolveConflict('use-cloud').then(arrive) },
      ]
    );
  };

  const doApple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithApple();
      await afterSignIn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('Apple 登录失败'), err.message ?? t('稍后再试。'));
      }
    } finally {
      setBusy(false);
    }
  };

  const doEmail = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!otpSent) {
        await sendEmailOtp(email.trim());
        setOtpSent(true);
        Alert.alert(t('验证码已发出'), t('去邮箱看看（也翻翻垃圾箱）。'));
      } else {
        await verifyEmailOtp(email.trim(), otp.trim());
        await afterSignIn();
      }
    } catch (e) {
      Alert.alert(otpSent ? t('验证失败') : t('发送失败'), (e as Error).message ?? t('稍后再试。'));
    } finally {
      setBusy(false);
    }
  };

  if (!authConfigured()) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <DiamondBackground />
        <Text style={styles.title}>{t('账号服务未配置')}</Text>
        <Text style={styles.sub}>在 .env.local 配好 Supabase 后重启（docs/supabase-setup.sql）。</Text>
        <Button label={t('返回')} variant="secondary" onPress={leave} style={styles.ghostBtn} />
      </View>
    );
  }

  const emailDisabled = busy || !email.trim() || (otpSent && !otp.trim());

  return (
    <View style={styles.screen}>
      <DiamondBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.tile}>
            <MingCute name="cloud" size={34} color={Romance.ink} />
          </View>
          <Text style={styles.title}>{t('把 TA 存进云端')}</Text>
          <Text style={styles.sub}>
            {forced
              ? t('TA 已经在你的通讯录里了。') + '\n' + t('登录之后，换手机也不会失去 TA 和你们的故事。')
              : t('登录之后，TA 和你们的故事换手机也不会失去。')}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.appleBtn, busy && styles.dim, pressed && !busy && styles.pressed]}
            disabled={busy}
            onPress={doApple}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.appleBtnText}> {t('用 Apple 登录')}</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t('或用邮箱')}</Text>
            <View style={styles.orLine} />
          </View>

          <Input
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('邮箱地址')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {otpSent ? (
            <Input
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder={t('邮箱里的 6 位验证码')}
              keyboardType="number-pad"
              onSubmitEditing={doEmail}
            />
          ) : null}
          <Button
            label={otpSent ? t('验证并登录') : t('发送验证码')}
            disabled={emailDisabled}
            onPress={doEmail}
            style={styles.emailBtn}
          />

          {!forced ? (
            <Pressable style={styles.ghost} onPress={leave}>
              <Text style={styles.ghostText}>{restoring ? t('返回') : t('先不了')}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.footnote}>{t('数据按最高敏感级对待 · 只有你自己能读到你的存档')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    content: { paddingHorizontal: 32, alignItems: 'center' },
    // 66 白色图块（无描边）内 cloud 图标
    tile: {
      width: 66,
      height: 66,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 26, fontWeight: '600', color: Romance.ink, marginTop: 16, textAlign: 'center' },
    sub: { fontSize: 14, lineHeight: 21, color: Romance.sub, textAlign: 'center', marginTop: 10 },
    // Apple 登录：ink 底 r6 白字（不用纯黑）
    appleBtn: {
      alignSelf: 'stretch',
      backgroundColor: Romance.ink,
      borderRadius: Shape.radius,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 30,
    },
    appleBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    dim: { opacity: 0.4 },
    pressed: { opacity: 0.8 },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18, alignSelf: 'stretch' },
    orLine: { flex: 1, height: 1, backgroundColor: Romance.line },
    orText: { fontSize: 12, color: Romance.sub },
    input: { alignSelf: 'stretch', marginBottom: 10 },
    emailBtn: { alignSelf: 'stretch' },
    ghost: { marginTop: 18, padding: 10 },
    ghostText: { fontSize: 13, color: Romance.sub },
    ghostBtn: { marginTop: 18 },
    footnote: { fontSize: 11, color: Romance.sub, marginTop: 26, textAlign: 'center' },
  })
);

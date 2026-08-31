/**
 * 登录（D-062）：独立界面。
 * - 常规入口：设置 → 账号 · 云端；可返回
 * - 强制点（force=1）：第一次把人添加进通讯录之后——TA 值得一个存得住的家；无返回键
 * 登录方式：Apple（主打）+ 邮箱验证码（需项目配 SMTP，见 D-054 补记）。
 * 成功后回桌面；云同步的对账由 initCloudSync 的 onAuthChange 自动完成。
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Romance, themed } from '@/constants/theme';
import {
  authConfigured,
  sendEmailOtp,
  signInWithApple,
  verifyEmailOtp,
} from '@/lib/auth';

export default function AuthScreen() {
  const { force } = useLocalSearchParams<{ force?: string }>();
  const forced = force === '1';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = () => router.replace('/');

  const doApple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithApple();
      done();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple 登录失败', err.message ?? '稍后再试。');
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
        Alert.alert('验证码已发出', '去邮箱看看（也翻翻垃圾箱）。');
      } else {
        await verifyEmailOtp(email.trim(), otp.trim());
        done();
      }
    } catch (e) {
      Alert.alert(otpSent ? '验证失败' : '发送失败', (e as Error).message ?? '稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  if (!authConfigured()) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>账号服务未配置</Text>
        <Text style={styles.sub}>在 .env.local 配好 Supabase 后重启（docs/supabase-setup.sql）。</Text>
        <Pressable style={styles.ghostBtn} onPress={done}>
          <Text style={styles.ghostBtnText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>☁️</Text>
        <Text style={styles.title}>把 TA 存进云端</Text>
        <Text style={styles.sub}>
          {forced
            ? 'TA 已经在你的通讯录里了。\n登录之后，换手机也不会失去 TA 和你们的故事。'
            : '登录之后，TA 和你们的故事换手机也不会失去。'}
        </Text>

        <Pressable style={[styles.appleBtn, busy && styles.dim]} disabled={busy} onPress={doApple}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.appleBtnText}> 用 Apple 登录</Text>
          )}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>或用邮箱</Text>
          <View style={styles.orLine} />
        </View>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="邮箱地址"
          placeholderTextColor={Romance.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {otpSent ? (
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder="邮箱里的 6 位验证码"
            placeholderTextColor={Romance.faint}
            keyboardType="number-pad"
            onSubmitEditing={doEmail}
          />
        ) : null}
        <Pressable
          style={[styles.emailBtn, (busy || !email.trim() || (otpSent && !otp.trim())) && styles.dim]}
          disabled={busy || !email.trim() || (otpSent && !otp.trim())}
          onPress={doEmail}>
          <Text style={styles.emailBtnText}>{otpSent ? '验证并登录' : '发送验证码'}</Text>
        </Pressable>

        {!forced ? (
          <Pressable style={styles.ghostBtn} onPress={done}>
            <Text style={styles.ghostBtnText}>先不了</Text>
          </Pressable>
        ) : null}
        <Text style={styles.footnote}>数据按最高敏感级对待 · 只有你自己能读到你的存档</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    content: { paddingHorizontal: 32, alignItems: 'center' },
    emoji: { fontSize: 46 },
    title: { fontSize: 26, fontWeight: '800', color: Romance.ink, marginTop: 14, textAlign: 'center' },
    sub: {
      fontSize: 14,
      color: Romance.sub,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 10,
      marginBottom: 30,
    },
    appleBtn: {
      alignSelf: 'stretch',
      backgroundColor: '#000000',
      borderRadius: 24,
      paddingVertical: 15,
      alignItems: 'center',
    },
    appleBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18, alignSelf: 'stretch' },
    orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Romance.line },
    orText: { fontSize: 12, color: Romance.faint },
    input: {
      alignSelf: 'stretch',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      color: Romance.ink,
      marginBottom: 10,
    },
    emailBtn: {
      alignSelf: 'stretch',
      backgroundColor: Romance.accent,
      borderRadius: 24,
      paddingVertical: 14,
      alignItems: 'center',
    },
    emailBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    dim: { opacity: 0.5 },
    ghostBtn: { marginTop: 18, padding: 10 },
    ghostBtnText: { fontSize: 13, color: Romance.sub },
    footnote: { fontSize: 11, color: Romance.faint, marginTop: 26, textAlign: 'center' },
  })
);

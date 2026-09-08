/**
 * Onboarding（D-035；D-080 并成一步；D-100 纸面）：语言 →「先让 TA 们认识你」。
 * 昵称与「更倾向于和什么样的人建立关系」必填（后者既是全性向声明，也是交友推荐的口味过滤，原独立一步「你想被谁爱？」并入此处）；
 * 其余（性别/称呼/职业/生日）都可跳过，完整设定稍后在 设置 → 我的身份 里补充，也能为单个角色使用不同身份。
 * 第一步底部「已有账号？登录」（D-096）：换了手机的老用户直接登录把 TA 们接回来，不重走新手流（语言还没选，所以三语并排）。
 * 纸面：paper 底 + 菱格暗纹；字段用 Field / Input，选项用 Chip，主按钮 Button——无阴影、无描边输入框、r6。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { DiamondBackground } from '@/components/paper-bg';
import { Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { authConfigured } from '@/lib/auth';
import { t, type Lang } from '@/lib/i18n';
import type { LovePref, UserProfile } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const LANGS: { key: Lang; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

const PREFS: { key: LovePref; label: string }[] = [
  { key: 'male', label: '男生' },
  { key: 'female', label: '女生' },
  { key: 'any', label: '都可以' },
  { key: 'nonhuman', label: '非人类' },
];

const GENDERS: { key: NonNullable<UserProfile['gender']>; label: string }[] = [
  { key: 'unspecified', label: '不指定' },
  { key: 'female', label: '女生' },
  { key: 'male', label: '男生' },
  { key: 'nonbinary', label: '非二元' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<'lang' | 'me'>('lang');
  useAppStore((s2) => s2.language); // 语言切换即重渲染
  const [pref, setPref] = useState<LovePref | null>(null);
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<NonNullable<UserProfile['gender']>>('unspecified');
  const [pronoun, setPronoun] = useState('');
  const [occupation, setOccupation] = useState('');
  const [birthday, setBirthday] = useState('');

  if (step === 'lang') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 80, paddingBottom: insets.bottom }]}>
        <DiamondBackground />
        <Text style={styles.title}>选择语言{'\n'}Language · 言語</Text>
        <View style={styles.options}>
          {LANGS.map((l) => (
            <Button
              key={l.key}
              label={l.label}
              variant="secondary"
              onPress={() => {
                useAppStore.getState().setLanguage(l.key);
                setStep('me');
              }}
            />
          ))}
        </View>
        {authConfigured() ? (
          <Pressable
            style={styles.signIn}
            hitSlop={12}
            onPress={() => router.push({ pathname: '/auth', params: { restore: '1' } })}>
            <Text style={styles.signInText}>已有账号？登录 · Sign in · ログイン</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const ready = !!nickname.trim() && !!pref;

  const finish = () => {
    const name = nickname.trim();
    if (!name || !pref) return;
    useAppStore.getState().setMe({
      nickname: name,
      gender,
      pronoun: pronoun.trim() || undefined,
      occupation: occupation.trim() || undefined,
      birthday: birthday.trim() || undefined,
    });
    useAppStore.getState().completeOnboarding(pref);
    router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <DiamondBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.meContent,
            { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('先让 TA 们认识你')}</Text>
          <Text style={styles.hint}>{t('只用填最基本的，其余都可以跳过。')}</Text>

          <Field label={t('昵称')} hint={t('角色看到的名字')} required>
            <Input
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('怎么称呼你？')}
              maxLength={12}
            />
          </Field>

          <Field label={t('性别')}>
            <View style={styles.chips}>
              {GENDERS.map((g) => (
                <Chip
                  key={g.key}
                  label={t(g.label)}
                  selected={gender === g.key}
                  onPress={() => setGender(g.key)}
                />
              ))}
            </View>
          </Field>

          <Field label={t('更倾向于和什么样的人建立关系？')} required>
            <View style={styles.chips}>
              {PREFS.map((o) => (
                <Chip
                  key={o.key}
                  label={t(o.label)}
                  selected={pref === o.key}
                  onPress={() => setPref(o.key)}
                />
              ))}
            </View>
          </Field>

          <Field label={t('称呼 / 代词')}>
            <Input value={pronoun} onChangeText={setPronoun} placeholder={t('可不填')} maxLength={12} />
          </Field>

          <Field label={t('职业')}>
            <Input
              value={occupation}
              onChangeText={setOccupation}
              placeholder={t('可不填')}
              maxLength={20}
            />
          </Field>

          <Field label={t('生日')}>
            <Input value={birthday} onChangeText={setBirthday} placeholder={t('比如 05-20')} maxLength={5} />
          </Field>

          <Button label={t('进去看看')} disabled={!ready} onPress={finish} style={styles.submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg, paddingHorizontal: 28 },
    title: {
      fontSize: Type.scale.display.size,
      lineHeight: Math.round(Type.scale.display.size * 1.25),
      fontWeight: '600',
      color: Romance.ink,
    },
    hint: { fontSize: 14, color: Romance.sub, marginTop: 10 },
    options: { marginTop: 40, gap: 10 },
    signIn: { marginTop: 'auto', alignSelf: 'center', paddingVertical: 18 },
    signInText: { fontSize: 14, fontWeight: '500', color: Romance.sub },
    meContent: { flexGrow: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    submit: { marginTop: 30 },
  })
);

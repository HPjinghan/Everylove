/**
 * Onboarding 两步（D-035）：
 * 1.「你想被谁爱？」——既是全性向声明，也是交友推荐的口味过滤。
 * 2.「先让 TA 们认识你」——只填最基本的：昵称必填，其余（性别/称呼/职业）都可跳过；
 *    完整设定稍后在 设置 → 我的身份 里补充，也能为单个角色使用不同身份。
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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Romance, themed } from '@/constants/theme';
import { t, type Lang } from '@/lib/i18n';
import type { LovePref, UserProfile } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const LANGS: { key: Lang; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

const OPTIONS: { key: LovePref; label: string; sub: string }[] = [
  { key: 'male', label: '男生', sub: '他会先来找你' },
  { key: 'female', label: '女生', sub: '她会先来找你' },
  { key: 'any', label: '都可以', sub: '心动没有条件' },
  { key: 'nonhuman', label: '非人类', sub: '有什么正朝你走来' },
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

  const [step, setStep] = useState<'lang' | 'pref' | 'me'>('lang');
  useAppStore((s2) => s2.language); // 语言切换即重渲染
  const [pref, setPref] = useState<LovePref>('male');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<NonNullable<UserProfile['gender']>>('unspecified');
  const [pronoun, setPronoun] = useState('');
  const [occupation, setOccupation] = useState('');

  const choose = (p: LovePref) => {
    setPref(p);
    setStep('me');
  };

  if (step === 'lang') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 80, paddingBottom: insets.bottom }]}>
        <Text style={styles.question}>选择语言{'\n'}Language · 言語</Text>
        <View style={styles.options}>
          {LANGS.map((l) => (
            <Pressable
              key={l.key}
              style={styles.option}
              onPress={() => {
                useAppStore.getState().setLanguage(l.key);
                setStep('pref');
              }}>
              <Text style={styles.optionLabel}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const finish = () => {
    const name = nickname.trim();
    if (!name) return;
    useAppStore.getState().setMe({
      nickname: name,
      gender,
      pronoun: pronoun.trim() || undefined,
      occupation: occupation.trim() || undefined,
    });
    useAppStore.getState().completeOnboarding(pref);
    router.replace('/');
  };

  if (step === 'pref') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 80, paddingBottom: insets.bottom }]}>
        <Text style={styles.question}>{t('你想被谁爱？')}</Text>
        <Text style={styles.hint}>{t('不用你主动。选好之后，等他来。')}</Text>
        <View style={styles.options}>
          {OPTIONS.map((o) => (
            <Pressable key={o.key} style={styles.option} onPress={() => choose(o.key)}>
              <Text style={styles.optionLabel}>{t(o.label)}</Text>
              <Text style={styles.optionSub}>{t(o.sub)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.footnote}>{t('交友会记住你的口味 · 随时可以换着看')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.meContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>{t('先让 TA 们认识你')}</Text>
        <Text style={styles.hint}>{t('只用填最基本的——除了名字，都可以跳过。')}</Text>

        <View style={styles.meField}>
          <Text style={styles.meLabel}>{t('昵称 *')}</Text>
          <Text style={styles.meHint}>{t('角色看到的名字')}</Text>
          <TextInput
            style={styles.meInput}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('怎么称呼你？')}
            placeholderTextColor={Romance.faint}
            maxLength={12}
          />
        </View>

        <View style={styles.meField}>
          <Text style={styles.meLabel}>{t('性别')}</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => {
              const active = gender === g.key;
              return (
                <Pressable
                  key={g.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setGender(g.key)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(g.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.meField}>
          <Text style={styles.meLabel}>{t('称呼 / 代词')}</Text>
          <TextInput
            style={styles.meInput}
            value={pronoun}
            onChangeText={setPronoun}
            placeholder={t('可不填')}
            placeholderTextColor={Romance.faint}
            maxLength={12}
          />
        </View>

        <View style={styles.meField}>
          <Text style={styles.meLabel}>{t('职业')}</Text>
          <TextInput
            style={styles.meInput}
            value={occupation}
            onChangeText={setOccupation}
            placeholder={t('可不填 · TA 会稳定记住')}
            placeholderTextColor={Romance.faint}
            maxLength={20}
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, !nickname.trim() && styles.primaryBtnDisabled]}
          disabled={!nickname.trim()}
          onPress={finish}>
          <Text style={styles.primaryBtnText}>{t('进去看看')}</Text>
        </Pressable>

        <Text style={styles.footnote}>
          {t('稍后可以在 设置 → 我的身份 里继续补充，')}{'\n'}{t('也能为单个角色使用不同身份。')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg, paddingHorizontal: 28 },
    question: { fontSize: 32, fontWeight: '700', color: Romance.ink },
    hint: { fontSize: 14, color: Romance.sub, marginTop: 10 },
    options: { marginTop: 40, gap: 12 },
    option: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionLabel: { fontSize: 18, fontWeight: '600', color: Romance.ink },
    optionSub: { fontSize: 12, color: Romance.faint },
    footnote: {
      marginTop: 'auto',
      marginBottom: 24,
      paddingTop: 24,
      fontSize: 11,
      color: Romance.faint,
      textAlign: 'center',
      lineHeight: 17,
    },
    meContent: { flexGrow: 1 },
    meField: { marginTop: 22 },
    meLabel: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    meHint: { fontSize: 11, color: Romance.faint, marginTop: 2 },
    meInput: {
      marginTop: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
      color: Romance.ink,
    },
    chips: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    chip: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    chipActive: { backgroundColor: Romance.accent },
    chipText: { fontSize: 13, color: Romance.sub },
    chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
    primaryBtn: {
      marginTop: 32,
      backgroundColor: Romance.accent,
      borderRadius: 24,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  })
);

/**
 * 我的身份（D-035）：TA 眼中的你。
 * - 默认身份：onboarding 时建立的那份，在这里补充完整（头像/昵称/性别/称呼/职业/取向/签名/完整设定）。
 * - 按角色身份：带 characterId 参数进来 = 为这个 TA 定制一份独立身份（初值抄默认），可随时恢复默认。
 * 全部字段除昵称外可空；没填的不进 prompt（content/prompts.ts 的 userProfileBlock）。
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { t } from '@/lib/i18n';
import type { UserProfile } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const GENDERS: { key: NonNullable<UserProfile['gender']>; label: string }[] = [
  { key: 'unspecified', label: '不指定' },
  { key: 'female', label: '女生' },
  { key: 'male', label: '男生' },
  { key: 'nonbinary', label: '非二元' },
];

function Field({
  label,
  hint,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t('可不填')}
        placeholderTextColor={Romance.faint}
        multiline={multiline}
      />
    </View>
  );
}

export default function IdentityScreen() {
  const { characterId } = useLocalSearchParams<{ characterId?: string }>();
  const router = useRouter();
  const me = useAppStore((s) => s.me);
  const meByCharacter = useAppStore((s) => s.meByCharacter);
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);

  const forCharacter = characterId ? bonds.find((b) => b.characterId === characterId) : undefined;
  const base: UserProfile =
    (characterId ? meByCharacter[characterId] : undefined) ?? me ?? { nickname: '' };
  const [draft, setDraft] = useState<UserProfile>({ ...base });
  const patch = (p: Partial<UserProfile>) => setDraft((d) => ({ ...d, ...p }));

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      patch({ avatarUri: result.assets[0].uri });
    }
  };

  const save = () => {
    if (!draft.nickname.trim()) {
      Alert.alert(t('昵称不能为空'), t('这是角色看到的名字。'));
      return;
    }
    const clean: UserProfile = { ...draft, nickname: draft.nickname.trim() };
    if (characterId) {
      useAppStore.getState().setMeForCharacter(characterId, clean);
    } else {
      useAppStore.getState().setMe(clean);
    }
    Alert.alert(t('已保存'), characterId ? t('{name}眼中的你已更新。', { name: forCharacter?.name ?? 'TA' }) : t('TA 们眼中的你已更新。'));
    router.back();
  };

  const restoreDefault = () => {
    if (!characterId) return;
    Alert.alert(t('恢复默认身份'), t('{name}将改用你的默认身份。', { name: forCharacter?.name ?? t('这个角色') }), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('恢复'),
        onPress: () => {
          useAppStore.getState().setMeForCharacter(characterId, undefined);
          router.back();
        },
      },
    ]);
  };

  const colorOf = (cid: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === cid)?.color ?? Romance.accent;

  return (
    <AppScreen title={forCharacter ? t('对{name}的身份', { name: forCharacter.name }) : t('我的身份')}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {forCharacter ? (
            <Text style={styles.scopeHint}>
              {t('这份身份只有{name}看得到；其他角色仍用默认身份。', { name: forCharacter.name })}
            </Text>
          ) : null}

          <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
            {draft.avatarUri ? (
              <Image source={{ uri: draft.avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarEmptyText}>{draft.nickname.trim().slice(0, 1) || t('我')}</Text>
              </View>
            )}
            <Text style={styles.avatarAction}>{draft.avatarUri ? t('更换头像') : t('选一张头像')}</Text>
          </Pressable>

          <Field
            label={t('昵称 *')}
            hint={t('角色看到的名字')}
            value={draft.nickname}
            onChange={(t) => patch({ nickname: t })}
            placeholder={t('必填')}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('性别')}</Text>
            <View style={styles.chips}>
              {GENDERS.map((g) => {
                const active = (draft.gender ?? 'unspecified') === g.key;
                return (
                  <Pressable
                    key={g.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => patch({ gender: g.key })}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(g.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label={t('称呼 / 代词')}
            value={draft.pronoun ?? ''}
            onChange={(t) => patch({ pronoun: t })}
          />
          <Field
            label={t('职业')}
            hint={t('角色必须稳定记住的职业')}
            value={draft.occupation ?? ''}
            onChange={(t) => patch({ occupation: t })}
          />
          <Field
            label={t('情感取向')}
            hint={t('例如：喜欢女生')}
            value={draft.orientation ?? ''}
            onChange={(t) => patch({ orientation: t })}
          />
          <Field
            label={t('个性签名')}
            hint={t('一句现在的状态')}
            value={draft.signature ?? ''}
            onChange={(t) => patch({ signature: t })}
          />

          <Text style={styles.sectionTitle}>{t('完整设定')}</Text>
          <Field
            label={t('背景')}
            hint={t('成长背景、家庭或当前生活背景等稳定事实')}
            value={draft.background ?? ''}
            onChange={(t) => patch({ background: t })}
            multiline
          />
          <Field
            label={t('关于我')}
            hint={t('身份、经历、性格、兴趣，以及希望角色记住的事实')}
            value={draft.about ?? ''}
            onChange={(t) => patch({ about: t })}
            multiline
          />
          <Field
            label={t('我的边界')}
            hint={t('不希望角色替你决定、猜测或触碰的内容')}
            value={draft.boundaries ?? ''}
            onChange={(t) => patch({ boundaries: t })}
            multiline
          />

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>{t('保存')}</Text>
          </Pressable>

          {characterId ? (
            meByCharacter[characterId] ? (
              <Pressable style={styles.restoreBtn} onPress={restoreDefault}>
                <Text style={styles.restoreBtnText}>{t('恢复使用默认身份')}</Text>
              </Pressable>
            ) : null
          ) : bonds.length ? (
            <View style={styles.perChar}>
              <Text style={styles.sectionTitle}>{t('为单个角色使用不同身份')}</Text>
              <Text style={styles.fieldHint}>
                {t('想在某个 TA 面前换一种活法？给 TA 一份独立的身份。')}
              </Text>
              {bonds.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.charRow}
                  onPress={() =>
                    router.push({ pathname: '/apps/identity', params: { characterId: b.characterId } })
                  }>
                  <CharAvatar
                    name={b.name}
                    color={colorOf(b.characterId)}
                    size={40}
                    characterId={b.characterId}
                  />
                  <View style={styles.charRowText}>
                    <Text style={styles.charRowName}>{b.name}</Text>
                    <Text style={styles.charRowSub}>
                      {meByCharacter[b.characterId]
                        ? t('独立身份 ·「{n}」', { n: meByCharacter[b.characterId].nickname })
                        : t('使用默认身份')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { padding: 18, paddingBottom: 60 },
    scopeHint: {
      fontSize: 12,
      color: Romance.accent,
      backgroundColor: Romance.accentSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 14,
      overflow: 'hidden',
    },
    avatarWrap: { alignItems: 'center', marginBottom: 18 },
    avatar: { width: 84, height: 84, borderRadius: 42 },
    avatarEmpty: {
      backgroundColor: Romance.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmptyText: { fontSize: 30, fontWeight: '700', color: Romance.accent },
    avatarAction: { fontSize: 12, color: Romance.accent, marginTop: 8, fontWeight: '600' },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    fieldHint: { fontSize: 11, color: Romance.faint, marginTop: 2 },
    input: {
      marginTop: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      color: Romance.ink,
    },
    inputMulti: { minHeight: 88, textAlignVertical: 'top' },
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Romance.sub,
      marginTop: 10,
      marginBottom: 8,
    },
    saveBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 22,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    restoreBtn: { alignItems: 'center', marginTop: 16, padding: 8 },
    restoreBtnText: { fontSize: 13, color: Romance.sub },
    perChar: { marginTop: 22 },
    charRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 12,
      marginTop: 8,
    },
    charRowText: { flex: 1 },
    charRowName: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    charRowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
  })
);

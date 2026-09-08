/**
 * 我的身份（D-035；D-100 纸面）：TA 眼中的你。
 * - 默认身份：onboarding 时建立的那份，在这里补充完整（头像/昵称/性别/称呼/职业/取向/签名/生日/完整设定）。
 * - 按角色身份：带 characterId 参数进来 = 为这个 TA 定制一份独立身份（初值抄默认），可随时恢复默认。
 * 全部字段除昵称外可空；没填的不进 prompt（content/prompts/shared.ts 的 userProfileBlock）。
 * 界面：头像 84 r6 白底 + accent 首字 30/600（衬线）、「更换头像」12/600 primary；字段同 onboarding（Field + Input + Chip）。
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
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
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

/** 文本字段：Field + Input；numeric = 值是数字（生日）时用 Fredoka */
function TextField({
  label,
  hint,
  value,
  onChange,
  multiline,
  placeholder,
  numeric,
  style,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Field label={label} hint={hint} style={style}>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t('可不填')}
        multiline={multiline}
        style={numeric && value ? styles.inputNumeric : undefined}
      />
    </Field>
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
              {t('只对{name}生效。', { name: forCharacter.name })}
            </Text>
          ) : null}

          <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
            {draft.avatarUri ? (
              <Image source={{ uri: draft.avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarInitial}>{draft.nickname.trim().slice(0, 1) || t('我')}</Text>
              </View>
            )}
            <Text style={styles.avatarAction}>{draft.avatarUri ? t('更换头像') : t('选一张头像')}</Text>
          </Pressable>

          <TextField
            label={t('昵称 *')}
            hint={t('角色看到的名字')}
            value={draft.nickname}
            onChange={(v) => patch({ nickname: v })}
            placeholder={t('必填')}
          />

          <Field label={t('性别')}>
            <View style={styles.chips}>
              {GENDERS.map((g) => (
                <Chip
                  key={g.key}
                  label={t(g.label)}
                  selected={(draft.gender ?? 'unspecified') === g.key}
                  onPress={() => patch({ gender: g.key })}
                />
              ))}
            </View>
          </Field>

          <TextField
            label={t('称呼 / 代词')}
            value={draft.pronoun ?? ''}
            onChange={(v) => patch({ pronoun: v })}
          />
          <TextField
            label={t('职业')}
            value={draft.occupation ?? ''}
            onChange={(v) => patch({ occupation: v })}
          />
          <TextField
            label={t('情感取向')}
            hint={t('例如：喜欢女生')}
            value={draft.orientation ?? ''}
            onChange={(v) => patch({ orientation: v })}
          />
          <TextField
            label={t('个性签名')}
            hint={t('一句现在的状态')}
            value={draft.signature ?? ''}
            onChange={(v) => patch({ signature: v })}
          />
          <TextField
            label={t('生日')}
            value={draft.birthday ?? ''}
            onChange={(v) => patch({ birthday: v })}
            placeholder={t('比如 05-20')}
            numeric
          />

          <Text style={styles.sectionTitle}>{t('完整设定')}</Text>
          <TextField
            label={t('背景')}
            hint={t('成长背景、家庭或当前生活背景等稳定事实')}
            value={draft.background ?? ''}
            onChange={(v) => patch({ background: v })}
            multiline
            style={styles.firstField}
          />
          <TextField
            label={t('关于我')}
            hint={t('身份、经历、性格、兴趣……')}
            value={draft.about ?? ''}
            onChange={(v) => patch({ about: v })}
            multiline
          />
          <TextField
            label={t('我的边界')}
            hint={t('不希望角色替你决定、猜测或触碰的内容')}
            value={draft.boundaries ?? ''}
            onChange={(v) => patch({ boundaries: v })}
            multiline
          />

          <Button label={t('保存')} style={styles.saveBtn} onPress={save} />

          {characterId ? (
            meByCharacter[characterId] ? (
              <Pressable style={styles.restoreBtn} onPress={restoreDefault}>
                <Text style={styles.restoreBtnText}>{t('恢复使用默认身份')}</Text>
              </Pressable>
            ) : null
          ) : bonds.length ? (
            <View style={styles.perChar}>
              <Text style={styles.sectionTitle}>{t('为单个角色使用不同身份')}</Text>
              {bonds.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    router.push({ pathname: '/apps/identity', params: { characterId: b.characterId } })
                  }>
                  <Card style={styles.charRow}>
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
                    <Text style={styles.charRowChevron}>›</Text>
                  </Card>
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
    // 表单类页面左右留白按设计稿 18
    content: { padding: 18, paddingBottom: 60 },
    scopeHint: {
      fontSize: 12,
      color: Romance.accent,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radius,
      paddingHorizontal: Space.cardX,
      paddingVertical: Space.inline,
      marginBottom: Space.screen,
      overflow: 'hidden',
    },
    avatarWrap: { alignItems: 'center' },
    avatar: { width: 84, height: 84, borderRadius: Shape.radius },
    avatarEmpty: {
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontFamily: Fonts.initial, fontSize: 30, fontWeight: '600', color: Romance.accentStrong },
    avatarAction: { fontSize: 12, fontWeight: '600', color: Romance.accent, marginTop: Space.inline },
    inputNumeric: { fontFamily: Fonts.label },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Romance.sub,
      marginTop: 28,
    },
    firstField: { marginTop: Space.inline },
    saveBtn: { marginTop: 28 },
    restoreBtn: { alignItems: 'center', marginTop: 16, padding: Space.inline },
    restoreBtnText: { fontSize: 13, color: Romance.sub },
    perChar: { marginTop: Space.inline },
    charRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      marginTop: Space.inline,
    },
    charRowText: { flex: 1 },
    charRowName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    charRowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    charRowChevron: { fontSize: 18, color: Romance.sub },
  })
);

/**
 * 我的身份（D-035；D-100 纸面）：TA 眼中的你。
 * - 默认身份：onboarding 时建立的那份，在这里补充完整（头像/昵称/性别/称呼/职业/偏好/签名/生日/完整设定）。
 *   偏好 = onboarding 那道「更倾向于和什么样的人建立关系？」（store.lovePref，全局、不分角色）；旧的自由文本「情感取向」不再显示，已填的照旧进 prompt。
 *   各字段占位写举例，不写「可不填」。
 * - 按角色身份：带 characterId 参数进来 = 为这个 TA 定制一份独立身份（初值抄默认），可随时恢复默认。
 * 全部字段除昵称外可空；没填的不进 prompt（content/prompts/shared.ts 的 userProfileBlock）。
 * 界面：头像 84 r6 白底 + accent 首字 30/600（衬线）、「更换头像」12/600 primary；字段同 onboarding（Field + Input + Chip）。
 */

import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

import { showAlert } from '@/components/action-sheet';
import { AppScreen } from '@/components/app-screen';
import { BirthdayPicker } from '@/components/birthday-picker';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Chip } from '@/components/chip';
import { Field, Input } from '@/components/input';
import { showToast } from '@/components/toast';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { t } from '@/lib/i18n';
import { copyIntoDocuments } from '@/lib/media-paths';
import type { LovePref, UserProfile } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const GENDERS: { key: NonNullable<UserProfile['gender']>; label: string }[] = [
  { key: 'female', label: '女生' },
  { key: 'male', label: '男生' },
  { key: 'nonbinary', label: '非二元' },
  { key: 'unspecified', label: '不想说' },
];

/** 和 onboarding「更倾向于和什么样的人建立关系？」同一份选项、同一个值（store.lovePref，也是交友的口味过滤） */
const PREFS: { key: LovePref; label: string }[] = [
  { key: 'male', label: '男生' },
  { key: 'female', label: '女生' },
  { key: 'any', label: '都可以' },
  { key: 'nonhuman', label: '非人类' },
];

/** 文本字段：Field + Input；占位写举例，不写「可不填」；numeric = 值是数字（生日）时用 Fredoka */
function TextField({
  label,
  hint,
  required,
  value,
  onChange,
  multiline,
  placeholder,
  numeric,
  style,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (t: string) => void;
  multiline?: boolean;
  placeholder?: string;
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Field label={label} hint={hint} required={required} style={style}>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
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
  // 偏好是全局的（不分角色）：只在默认身份里改，保存时一起写回
  const [pref, setPref] = useState<LovePref>(() => useAppStore.getState().lovePref ?? 'any');

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    // 相册给的是缓存路径，系统随时会清：拷进 App 自己的目录再存（D-203）
    if (!result.canceled && result.assets[0]?.uri) {
      patch({ avatarUri: await copyIntoDocuments(result.assets[0].uri, 'photos') });
    }
  };

  const save = () => {
    if (!draft.nickname.trim()) {
      showAlert(t('昵称不能为空'));
      return;
    }
    const clean: UserProfile = { ...draft, nickname: draft.nickname.trim() };
    if (characterId) {
      useAppStore.getState().setMeForCharacter(characterId, clean);
    } else {
      useAppStore.getState().setMe(clean);
      useAppStore.getState().setLovePref(pref);
    }
    showToast(t('已保存'));
    router.back();
  };

  const restoreDefault = () => {
    if (!characterId) return;
    showAlert(t('恢复默认身份'), t('{name}将改用你的默认身份。', { name: forCharacter?.name ?? t('这个角色') }), [
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
            label={t('昵称')}
            required
            value={draft.nickname}
            onChange={(v) => patch({ nickname: v })}
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
            placeholder={t('比如：她、他，或你喜欢的叫法')}
            value={draft.pronoun ?? ''}
            onChange={(v) => patch({ pronoun: v })}
          />
          <TextField
            label={t('职业')}
            placeholder={t('比如：学生、设计师、护士')}
            value={draft.occupation ?? ''}
            onChange={(v) => patch({ occupation: v })}
          />
          {/* 取向 = onboarding 那道必选题（同一个值），不再另开一格自由文本；偏好不分角色，单角色身份里不出现 */}
          {characterId ? null : (
            <Field label={t('更倾向于和什么样的人建立关系？')}>
              <View style={styles.chips}>
                {PREFS.map((p) => (
                  <Chip key={p.key} label={t(p.label)} selected={pref === p.key} onPress={() => setPref(p.key)} />
                ))}
              </View>
            </Field>
          )}
          <TextField
            label={t('个性签名')}
            placeholder={t('一句现在的状态')}
            value={draft.signature ?? ''}
            onChange={(v) => patch({ signature: v })}
          />
          <Field label={t('生日')}>
            <BirthdayPicker value={draft.birthday ?? ''} onChange={(v) => patch({ birthday: v || undefined })} />
          </Field>

          <Text style={styles.sectionTitle}>{t('完整设定')}</Text>
          <TextField
            label={t('背景')}
            placeholder={t('成长背景、家庭或当前生活背景等稳定事实')}
            value={draft.background ?? ''}
            onChange={(v) => patch({ background: v })}
            multiline
            style={styles.firstField}
          />
          <TextField
            label={t('关于我')}
            placeholder={t('身份、经历、性格、兴趣……')}
            value={draft.about ?? ''}
            onChange={(v) => patch({ about: v })}
            multiline
          />
          <TextField
            label={t('我的边界')}
            placeholder={t('不希望角色替你决定、猜测或触碰的内容')}
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
    avatarWrap: { alignItems: 'center' },
    avatar: { width: 84, height: 84, borderRadius: Shape.radius },
    avatarEmpty: {
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontFamily: Fonts.initial, fontSize: Type.scale.display.size, fontWeight: '600', color: Romance.accentStrong },
    avatarAction: { fontSize: Type.scale.caption.size, fontWeight: '600', color: Romance.accent, marginTop: Space.inline },
    inputNumeric: { fontFamily: Fonts.label },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.inline },
    sectionTitle: {
      fontSize: Type.scale.label.size,
      fontWeight: '600',
      color: Romance.sub,
      marginTop: 28,
    },
    firstField: { marginTop: Space.inline },
    saveBtn: { marginTop: 28 },
    restoreBtn: { alignItems: 'center', marginTop: 16, padding: Space.inline },
    restoreBtnText: { fontSize: Type.scale.label.size, color: Romance.sub },
    perChar: { marginTop: Space.inline },
    charRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      marginTop: Space.inline,
    },
    charRowText: { flex: 1 },
    charRowName: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    charRowSub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
    charRowChevron: { fontSize: Type.scale.lg.size, color: Romance.sub },
  })
);

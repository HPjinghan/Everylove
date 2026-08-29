/**
 * 领养流：缔结关系的仪式（交友配对 = 交换联系方式；自创角色 = 确定关系，D-052）。
 * 槽位判定 → 起名/称呼/生日 → 迁移仪式动画 → 直接开聊（开门/推送步已随 D-046 下线）。
 * 首个羁绊免费，加槽付费（试装不开付费）——商业承重墙；自创角色同样占槽（D-052 修订 D-047）。
 */

import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

import { CharAvatar } from '@/components/char-avatar';
import { scriptFor } from '@/content/characters';
import { Romance, themed } from '@/constants/theme';
import { findCharacter, useAppStore } from '@/store/app-store';

type Step = 'slot' | 'names' | 'ceremony';

export default function AdoptScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const character = findCharacter(characterId);
  const bonds = useAppStore((s) => s.bonds);

  const [step, setStep] = useState<Step>('slot');
  const [hisName, setHisName] = useState(character?.name ?? '');
  const [nickname, setNickname] = useState('');
  const [customNickname, setCustomNickname] = useState('');
  const [birthday, setBirthday] = useState('');

  if (!character) return <Redirect href="/" />;

  const script = scriptFor(character);
  // 缔结即占槽（D-052）：自创与官方一视同仁——「心动中」的暧昧期不占，确定关系才占
  const slotFree = bonds.length === 0;
  const finalNickname = (customNickname.trim() || nickname).trim();

  const finish = () => {
    const bondId = useAppStore.getState().createBond({
      characterId: character.id,
      name: hisName.trim() || character.name,
      nickname: finalNickname || '你',
      birthday: birthday.trim() || undefined,
    });
    router.replace({ pathname: '/bond/[bondId]', params: { bondId } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        {step === 'slot' && (
          <View style={styles.center}>
            <CharAvatar name={character.name} color={character.color} size={84} characterId={character.id} />
            <Text style={styles.h1}>
              {character.custom ? `和${character.name}确定关系` : `和${character.name}交换联系方式`}
            </Text>
            {slotFree ? (
              <>
                <View style={styles.slotCard}>
                  <Text style={styles.slotFree}>首个羁绊 · 免费</Text>
                  <Text style={styles.slotDesc}>
                    交换之后 TA 会搬进你的消息里，{'\n'}随时都在，随时都回。
                  </Text>
                </View>
                <Pressable style={styles.primaryBtn} onPress={() => setStep('names')}>
                  <Text style={styles.primaryBtnText}>开始缔结</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.slotCard}>
                  <Text style={styles.slotFull}>羁绊槽位已满 · {bonds.length}/1</Text>
                  <Text style={styles.slotDesc}>加槽将在正式版开放。</Text>
                </View>
                <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
                  <Text style={styles.secondaryBtnText}>先回去聊聊</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => router.back()} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>再想想</Text>
            </Pressable>
          </View>
        )}

        {step === 'names' && (
          <View>
            <Text style={styles.h1}>在你的通讯录里，TA 叫——</Text>
            <TextInput
              style={styles.input}
              value={hisName}
              onChangeText={setHisName}
              placeholder={character.name}
              placeholderTextColor={Romance.faint}
              maxLength={12}
            />
            <Text style={styles.h2}>TA 会怎么叫你？</Text>
            <View style={styles.presetRow}>
              {script.nicknamePresets.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.preset, nickname === p && !customNickname && styles.presetActive]}
                  onPress={() => {
                    setNickname(p);
                    setCustomNickname('');
                  }}>
                  <Text
                    style={[
                      styles.presetText,
                      nickname === p && !customNickname && styles.presetTextActive,
                    ]}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={customNickname}
              onChangeText={setCustomNickname}
              placeholder="或者，告诉他你想被怎么叫"
              placeholderTextColor={Romance.faint}
              maxLength={8}
            />
            <Text style={styles.h2}>你的生日（可以不说）</Text>
            <TextInput
              style={styles.input}
              value={birthday}
              onChangeText={setBirthday}
              placeholder="比如 05-20"
              placeholderTextColor={Romance.faint}
              maxLength={5}
            />
            <Pressable
              style={[styles.primaryBtn, !finalNickname && styles.btnDisabled]}
              disabled={!finalNickname}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep('ceremony');
              }}>
              <Text style={styles.primaryBtnText}>交换</Text>
            </Pressable>
          </View>
        )}

        {step === 'ceremony' && (
          <Ceremony
            hisName={hisName.trim() || character.name}
            nickname={finalNickname || '你'}
            color={character.color}
            characterId={character.id}
            custom={!!character.custom}
            onDone={finish}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 迁移仪式：三行文字依次显影 + 心跳（自创角色有自己的仪式文案，D-052） */
function Ceremony({
  hisName,
  nickname,
  color,
  characterId,
  custom,
  onDone,
}: {
  hisName: string;
  nickname: string;
  color: string;
  characterId?: string;
  custom?: boolean;
  onDone: () => void;
}) {
  const lines = custom
    ? [
        `${hisName}不再只是你创造的角色`,
        '这一次，是 TA 自己选择留下',
        `TA 给你的备注是——「${nickname}」`,
      ]
    : [
        'TA 存下了你的号码',
        '你出现在了 TA 的通讯录里',
        `TA 给你的备注是——「${nickname}」`,
      ];
  const fades = useRef(lines.map(() => new Animated.Value(0))).current;
  const heart = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const anims = fades.map((f, i) =>
      Animated.timing(f, { toValue: 1, duration: 600, delay: i * 900, useNativeDriver: true })
    );
    Animated.parallel(anims).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(heart, { toValue: 1, duration: 500, useNativeDriver: true }).start(() =>
        setDone(true)
      );
    });
    const timers = lines.map((_, i) =>
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), i * 900 + 300)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.center}>
      <CharAvatar name={hisName} color={color} size={84} characterId={characterId} />
      <View style={styles.ceremonyLines}>
        {lines.map((l, i) => (
          <Animated.Text key={i} style={[styles.ceremonyLine, { opacity: fades[i] }]}>
            {l}
          </Animated.Text>
        ))}
      </View>
      <Animated.Text
        style={[
          styles.ceremonyHeart,
          {
            opacity: heart,
            transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}>
        ♥
      </Animated.Text>
      {done && (
        <Pressable style={styles.primaryBtn} onPress={onDone}>
          <Text style={styles.primaryBtnText}>去和 TA 说话</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { paddingHorizontal: 28, flexGrow: 1, justifyContent: 'center' },
    center: { alignItems: 'center' },
    h1: {
      fontSize: 22,
      fontWeight: '700',
      color: Romance.ink,
      marginTop: 20,
      textAlign: 'center',
    },
    h2: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 22, marginBottom: 8 },
    slotCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: 18,
      marginTop: 18,
      alignItems: 'center',
    },
    slotFree: { fontSize: 15, fontWeight: '700', color: Romance.accent },
    slotFull: { fontSize: 15, fontWeight: '700', color: Romance.sub },
    slotDesc: {
      fontSize: 13,
      color: Romance.sub,
      lineHeight: 20,
      marginTop: 8,
      textAlign: 'center',
    },
    input: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: Romance.ink,
      marginTop: 10,
    },
    presetRow: { flexDirection: 'row', gap: 8 },
    preset: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    presetActive: { backgroundColor: Romance.accent },
    presetText: { fontSize: 14, color: Romance.sub },
    presetTextActive: { color: '#fff', fontWeight: '600' },
    primaryBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 26,
      paddingHorizontal: 40,
      paddingVertical: 13,
      marginTop: 28,
      alignSelf: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
      backgroundColor: Romance.line,
      borderRadius: 26,
      paddingHorizontal: 32,
      paddingVertical: 13,
      marginTop: 28,
    },
    secondaryBtnText: { color: Romance.sub, fontSize: 15, fontWeight: '600' },
    cancelLink: { marginTop: 18, alignSelf: 'center' },
    cancelLinkText: { fontSize: 13, color: Romance.faint },
    ceremonyLines: { marginTop: 30, gap: 14, alignItems: 'center' },
    ceremonyLine: { fontSize: 16, color: Romance.ink },
    ceremonyHeart: { fontSize: 34, color: Romance.accent, marginTop: 22 },
    pushClock: { fontSize: 56, fontWeight: '200', color: Romance.ink, letterSpacing: 2 },
    pushSub: { fontSize: 15, color: Romance.sub, marginTop: 10 },
  })
);

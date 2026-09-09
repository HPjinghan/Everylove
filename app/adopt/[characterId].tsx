/**
 * 领养流：缔结关系的仪式（交友配对 = 交换联系方式；自创角色 = 确定关系，D-052；D-100 纸面）。
 * 槽位判定 → 给 TA 起名 → 迁移仪式动画 → 直接开聊（开门/推送步已随 D-046 下线；称呼与生日不再问，D-088：
 * TA 叫她的名字 = 她的昵称，生日在「我的身份」里）。
 * 首个羁绊免费，加槽付费（试装不开付费）——商业承重墙；自创角色同样占槽（D-052 修订 D-047）。
 * 纸面：paper 底 + 菱格；居中头像 84、标题 22、槽位卡 = 白卡描边（数字 Fredoka）、主按钮 Button、「再想想」13 muted；无阴影。
 */

import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Input } from '@/components/input';
import { DiamondBackground } from '@/components/paper-bg';
import { Fonts, Romance, themed } from '@/constants/theme';
import { authConfigured, signedInSession } from '@/lib/auth';
import { slotLimit, slotLimitLabel } from '@/lib/bond';
import { t } from '@/lib/i18n';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

type Step = 'slot' | 'names' | 'ceremony';

export default function AdoptScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const character = findCharacter(characterId);
  const bonds = useAppStore((s) => s.bonds);
  const plan = useAppStore((s) => s.plan);

  const [step, setStep] = useState<Step>('slot');
  const [hisName, setHisName] = useState(character?.name ?? '');

  if (!character) return <Redirect href="/" />;

  // 缔结即占槽（D-052）；槽位上限随订阅计划（D-063）：free 1 / pro 5 / max 不限
  const slotFree = bonds.length < slotLimit(plan);
  // TA 叫她的名字 = 她在这个角色眼中的昵称（D-088）
  const finalNickname = meForCharacter(character.id)?.nickname?.trim() || '你';

  const finish = async () => {
    // 强制登录判定（D-062）：这是不是第一次把人添加进通讯录
    const s = useAppStore.getState();
    const hadContacts = s.bonds.length > 0 || s.customCharacters.some((c) => !c.shared);
    useAppStore.getState().createBond({
      characterId: character.id,
      name: hisName.trim() || character.name,
    });
    if (!hadContacts && authConfigured() && !(await signedInSession())) {
      router.replace({ pathname: '/auth', params: { force: '1' } });
      return;
    }
    // 方案 B（D-058）：缔结后落桌面——首次会揭幕，TA 的第一句话在未读横幅里等她
    router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <DiamondBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 60 },
          ]}
          keyboardShouldPersistTaps="handled">
          {step === 'slot' && (
            <View style={styles.center}>
              <CharAvatar name={character.name} color={character.color} size={84} characterId={character.id} />
              <Text style={styles.h1}>
                {character.custom
                  ? t('和{name}确定关系', { name: character.name })
                  : t('和{name}交换联系方式', { name: character.name })}
              </Text>
              {slotFree ? (
                <>
                  <Card style={styles.slotCard}>
                    <Text style={styles.slotFree}>
                      {bonds.length === 0 ? (
                        t('首个羁绊 · 免费')
                      ) : (
                        <>
                          {t('羁绊槽位')}{' '}
                          <Text style={styles.slotNum}>
                            {bonds.length + 1}/{slotLimitLabel(plan)}
                          </Text>
                        </>
                      )}
                    </Text>
                  </Card>
                  <Button label={t('开始缔结')} onPress={() => setStep('names')} style={styles.primaryBtn} />
                </>
              ) : (
                <>
                  <Card style={styles.slotCard}>
                    <Text style={styles.slotFull}>
                      {t('羁绊槽位已满')} ·{' '}
                      <Text style={styles.slotNumMuted}>
                        {bonds.length}/{slotLimitLabel(plan)}
                      </Text>
                    </Text>
                    <Text style={styles.slotDesc}>{t('开通 Pro 或 Max，增加羁绊槽位')}</Text>
                  </Card>
                  <Button
                    label={t('去看订阅')}
                    onPress={() => router.push('/apps/settings')}
                    style={styles.primaryBtn}
                  />
                  <Button
                    label={t('先回去聊聊')}
                    variant="secondary"
                    onPress={() => router.back()}
                    style={styles.secondaryBtn}
                  />
                </>
              )}
              <Pressable onPress={() => router.back()} style={styles.cancelLink} hitSlop={8}>
                <Text style={styles.cancelLinkText}>{t('再想想')}</Text>
              </Pressable>
            </View>
          )}

          {step === 'names' && (
            <View>
              <Text style={styles.h1}>{t('在你的通讯录里，TA 叫——')}</Text>
              <Input
                style={styles.nameInput}
                value={hisName}
                onChangeText={setHisName}
                placeholder={character.name}
                maxLength={12}
              />
              <Button
                label={t('交换')}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep('ceremony');
                }}
                style={styles.primaryBtn}
              />
            </View>
          )}

          {step === 'ceremony' && (
            <Ceremony
              hisName={hisName.trim() || character.name}
              nickname={finalNickname}
              color={character.color}
              characterId={character.id}
              custom={!!character.custom}
              onDone={finish}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
        t('{name}不再只是你创造的角色', { name: hisName }),
        t('这一次，是 TA 自己选择留下'),
        t('TA 给你的备注是——「{nickname}」', { nickname }),
      ]
    : [
        t('TA 存下了你的号码'),
        t('你出现在了 TA 的通讯录里'),
        t('TA 给你的备注是——「{nickname}」', { nickname }),
      ];
  // 三行显影各一只 Animated 值（仪式固定三行，hook 个数固定）+ 心跳一只
  const fade0 = useAnimatedValue(0);
  const fade1 = useAnimatedValue(0);
  const fade2 = useAnimatedValue(0);
  const fades = [fade0, fade1, fade2];
  const heart = useAnimatedValue(0);
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
      {done && <Button label={t('去看看你们的手机')} onPress={onDone} style={styles.primaryBtn} />}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { paddingHorizontal: 28, flexGrow: 1, justifyContent: 'center' },
    center: { alignItems: 'center' },
    h1: { fontSize: 22, fontWeight: '600', color: Romance.ink, marginTop: 20, textAlign: 'center' },
    // 槽位卡：白卡描边，居中一行；数字 Fredoka
    slotCard: {
      alignSelf: 'stretch',
      alignItems: 'center',
      marginTop: 18,
      paddingVertical: 16,
      paddingHorizontal: 22,
    },
    slotFree: { fontSize: 15, fontWeight: '600', color: Romance.accentStrong, textAlign: 'center' },
    slotNum: { fontFamily: Fonts.labelBold, fontSize: 15, color: Romance.accentStrong },
    slotFull: { fontSize: 15, fontWeight: '600', color: Romance.sub, textAlign: 'center' },
    slotNumMuted: { fontFamily: Fonts.labelBold, fontSize: 15, color: Romance.sub },
    slotDesc: { fontSize: 13, lineHeight: 20, color: Romance.sub, marginTop: 8, textAlign: 'center' },
    nameInput: { marginTop: 10 },
    primaryBtn: { marginTop: 28, alignSelf: 'center', paddingHorizontal: 40 },
    secondaryBtn: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 32 },
    cancelLink: { marginTop: 18, alignSelf: 'center' },
    cancelLinkText: { fontSize: 13, color: Romance.sub },
    ceremonyLines: { marginTop: 30, gap: 14, alignItems: 'center' },
    ceremonyLine: { fontSize: 16, color: Romance.ink, textAlign: 'center' },
    ceremonyHeart: { fontSize: 34, color: Romance.accent, marginTop: 22 },
  })
);

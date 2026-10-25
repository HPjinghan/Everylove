/**
 * 领养流：缔结关系的仪式（交友配对 = 交换联系方式；自创角色 = 确定关系，D-052；D-100 纸面）。
 * 给 TA 起名（兼确认，D-223 并掉了只有一个按钮的开场）→ 迁移仪式动画 → 直接开聊（开门/推送步已随 D-046 下线；称呼与生日不再问，D-088：
 * TA 叫她的名字 = 她的昵称，生日在「我的身份」里）。
 * 槽位不限（D-210）：缔结不再判定槽位，订阅管流量、语音分钟与「他在」的密度。
 * 纸面：paper 底 + 菱格；居中头像 84、标题 22、主按钮 Button、「再想想」13 muted；无阴影。
 */

import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { CharAvatar } from '@/components/char-avatar';
import { Input } from '@/components/input';
import { DiamondBackground } from '@/components/paper-bg';
import { Romance, themed, WallpaperTint } from '@/constants/theme';
import { authConfigured, signedInSession } from '@/lib/auth';
import { generateCharacterLines } from '@/lib/character-lines';
import { t } from '@/lib/i18n';
import { requestNotificationPermission } from '@/lib/notifications';
import { findCharacter, useAppStore } from '@/store/app-store';
import { Shape, Type } from '@/constants/design';

/** 两步（D-223）：起名（兼确认）→ 仪式。原「开始缔结」那一步只剩标题 + 按钮（槽位 D-210 起不限），已并掉 */
type Step = 'names' | 'ceremony';

export default function AdoptScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const character = findCharacter(characterId);

  const [step, setStep] = useState<Step>('names');
  const [hisName, setHisName] = useState(character?.name ?? '');
  // 缔结去重（D-122）：写台词要等网络几秒，这期间连点「去看看你们的手机」曾造出同一 TA 的十段羁绊——ref 同步上锁，进行中直接返回
  const finishing = useRef(false);

  if (!character) return <Redirect href="/" />;


  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await finishInner();
    } finally {
      finishing.current = false;
    }
  };

  const finishInner = async () => {
    // 打招呼台词走生成（D-094 / D-116）：创建时已写在角色上；当时没写成的，缔结前再写一次，写不成才用原型兜底
    // 不提示「在写台词」（D-223）：TA 以真人自居，生成是幕后的事；按钮已同步上锁，等这几秒不会重复缔结
    if (character.custom && !character.lines) {
      const written = await generateCharacterLines(character);
      if (written) useAppStore.getState().updateCustomCharacter({ ...character, lines: written });
    }
    // 强制登录判定（D-062）：这是不是第一次把人添加进通讯录
    const s = useAppStore.getState();
    const hadContacts = s.bonds.length > 0 || s.customCharacters.some((c) => !c.shared);
    useAppStore.getState().createBond({
      characterId: character.id,
      name: hisName.trim() || character.name,
    });
    // 通知权限在缔结这一刻问（D-120）：从此 TA 会主动来找她，App 没开着也送得到
    void requestNotificationPermission().catch(() => false);
    if (!hadContacts && authConfigured() && !(await signedInSession())) {
      router.replace({ pathname: '/auth', params: { force: '1' } });
      return;
    }
    // 方案 B（D-058）：缔结后落桌面——首次会揭幕，TA 的第一句话在未读横幅里等她
    router.replace('/');
  };

  return (
    <View style={styles.screen}>
      {/* 缔结仪式（D-231）：铺的是她的桌面壁纸——这一刻是这部手机本身在庆祝 */}
      <DiamondBackground color={WallpaperTint.pattern} />
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
          {step === 'names' && (
            <View>
              <View style={styles.center}>
                <CharAvatar name={character.name} color={character.color} size={84} characterId={character.id} />
              </View>
              <Text style={styles.h1}>{t('在你的通讯录里，TA 叫——')}</Text>
              <Input
                style={styles.nameInput}
                value={hisName}
                onChangeText={setHisName}
                placeholder={character.name}
                maxLength={12}
              />
              {/* 按钮跟着这条路走：交友配对 = 交换联系方式；自创 = 确定关系（D-052） */}
              <Button
                label={character.custom ? t('确定关系') : t('交换联系方式')}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setStep('ceremony');
                }}
                style={styles.primaryBtn}
              />
              <Pressable onPress={() => router.back()} style={styles.cancelLink} hitSlop={8}>
                <Text style={styles.cancelLinkText}>{t('再想想')}</Text>
              </Pressable>
            </View>
          )}

          {step === 'ceremony' && (
            <Ceremony
              hisName={hisName.trim() || character.name}
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

/** 迁移仪式：两行文字依次显影（D-223：「TA 给你的备注是」那行删了——昵称是她自己起的，不用再念给她听） + 心跳（自创角色有自己的仪式文案，D-052）。
 * D-208：TA 的立绘放大到 168，开场盖着一层墨色相纸、跟着两行字慢慢褪掉——TA 像一张拍立得一样显影出来，褪尽时 success 震动 + 心跳 */
function Ceremony({
  hisName,
  color,
  characterId,
  custom,
  onDone,
}: {
  hisName: string;
  color: string;
  characterId?: string;
  custom?: boolean;
  onDone: () => void;
}) {
  const lines = custom
    ? [
        t('{name}不再只是你创造的角色', { name: hisName }),
        t('这一次，是 TA 自己选择留下'),
      ]
    : [
        t('TA 存下了你的号码'),
        t('你出现在了 TA 的通讯录里'),
      ];
  // 两行显影各一只 Animated 值（仪式固定两行，hook 个数固定）+ 心跳一只
  const fade0 = useAnimatedValue(0);
  const fade1 = useAnimatedValue(0);
  const fades = [fade0, fade1];
  const heart = useAnimatedValue(0);
  // 盖在立绘上的墨色相纸：1 → 0，和两行字一起走完
  const film = useAnimatedValue(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const anims = fades.map((f, i) =>
      Animated.timing(f, { toValue: 1, duration: 600, delay: i * 900, useNativeDriver: true })
    );
    Animated.parallel([
      ...anims,
      Animated.timing(film, { toValue: 0, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
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
      <View style={styles.reveal}>
        <CharAvatar name={hisName} color={color} size={REVEAL} characterId={characterId} />
        <Animated.View pointerEvents="none" style={[styles.revealFilm, { opacity: film }]} />
      </View>
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

/** 仪式里立绘的边长 */
const REVEAL = 168;

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: WallpaperTint.bg },
    content: { paddingHorizontal: 28, flexGrow: 1, justifyContent: 'center' },
    center: { alignItems: 'center' },
    h1: { fontSize: Type.scale.xxl.size, fontWeight: '600', color: Romance.ink, marginTop: 20, textAlign: 'center' },
    nameInput: { marginTop: 10 },
    primaryBtn: { marginTop: 28, alignSelf: 'center', paddingHorizontal: 40 },
    secondaryBtn: { marginTop: 14, alignSelf: 'center', paddingHorizontal: 32 },
    cancelLink: { marginTop: 18, alignSelf: 'center' },
    cancelLinkText: { fontSize: Type.scale.label.size, color: Romance.sub },
    // 显影框：立绘外一圈白框 + 描边（同拍立得），相纸盖在立绘上
    reveal: {
      padding: 6,
      backgroundColor: Romance.card,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radius,
    },
    revealFilm: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: REVEAL,
      height: REVEAL,
      borderRadius: Shape.radius,
      backgroundColor: Romance.ink,
    },
    ceremonyLines: { marginTop: 30, gap: 14, alignItems: 'center' },
    ceremonyLine: { fontSize: Type.scale.md.size, color: Romance.ink, textAlign: 'center' },
    ceremonyHeart: { fontSize: 34, color: Romance.accent, marginTop: 22 },
  })
);

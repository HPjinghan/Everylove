/**
 * TA 的手机锁屏（D-082/D-084；D-100 纸面）：角色色通底 + 白色 8% 菱格，时钟 Fredoka 84、四个密码点、九宫格方键（r6 白 22%）。
 * 猜对即 onUnlock；左下「问 TA 要密码」→ onAsk（父组件给 TA 发一张「想看看你的手机」卡片）。
 * 传了 bondId 时锁屏不关：订阅这个 bond 在按下之后 TA 发的消息，以气泡原地显示（答应带着密码、拒绝也看得见）；
 * TA 答应时 features/phone-peek 把 phoneUnlocked 置真，父组件的 visible 自然切到手机内容。不传 bondId 走旧行为。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { DiamondBackground } from '@/components/paper-bg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { getLang, t } from '@/lib/i18n';
import { PHONE_PASSCODE_LENGTH } from '@/lib/phone';
import { useAppStore } from '@/store/app-store';

const KEYS: { n: string; letters: string }[] = [
  { n: '1', letters: '' },
  { n: '2', letters: 'ABC' },
  { n: '3', letters: 'DEF' },
  { n: '4', letters: 'GHI' },
  { n: '5', letters: 'JKL' },
  { n: '6', letters: 'MNO' },
  { n: '7', letters: 'PQRS' },
  { n: '8', letters: 'TUV' },
  { n: '9', letters: 'WXYZ' },
];
/** 键 78 见方（锁屏专用，不是卡片） */
const KEY = 78;
/** 锁屏上最多同时显示 TA 的几条回复（亲密模式会拆两条气泡，密码可能在前一条） */
const REPLY_MAX = 3;

/** 日期行按界面语言：9月6日星期日 / Sunday, September 6 / 9月6日日曜日 */
function dateLine(d: Date): string {
  const lang = getLang();
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';
  try {
    return d.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' });
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

export function PhoneLock({
  visible,
  color,
  passcode,
  onUnlock,
  onAsk,
  onClose,
  bondId,
  characterId,
  name,
}: {
  visible: boolean;
  /** 角色主题色：通底 */
  color: string;
  passcode: string;
  onUnlock: () => void;
  onAsk: () => void;
  onClose: () => void;
  /** 所属羁绊（D-100）：「问 TA 要密码」后锁屏不关，订阅这个 bond 之后 TA 的消息原地显示 */
  bondId?: string;
  /** 回复气泡旁的头像（不传则从 bond 取） */
  characterId?: string;
  name?: string;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [askedAt, setAskedAt] = useState<number | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(new Date());
  const bond = useAppStore((s) => (bondId ? s.bonds.find((b) => b.id === bondId) : undefined));

  useEffect(() => {
    if (!visible) {
      setCode('');
      setWrong(false);
      setAskedAt(null);
      return;
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, [visible]);

  /** 按下「问 TA 要密码」之后 TA 说的话（会话里照常留着，这里只是原地再看一眼） */
  const replies = useMemo(() => {
    if (!bond || askedAt === null) return [];
    return bond.messages
      .filter((m) => m.from === 'him' && m.at > askedAt && !m.recalled && m.text.trim())
      .slice(-REPLY_MAX);
  }, [bond, askedAt]);
  const waiting = askedAt !== null && replies.length === 0;

  const press = (n: string) => {
    if (wrong) setWrong(false);
    const next = (code + n).slice(0, PHONE_PASSCODE_LENGTH);
    setCode(next);
    if (next.length < PHONE_PASSCODE_LENGTH) return;
    if (next === passcode) {
      setTimeout(onUnlock, 120);
      return;
    }
    setWrong(true);
    Animated.sequence([
      Animated.timing(shake, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => setCode(''));
  };

  const ask = () => {
    if (bondId) setAskedAt(Date.now());
    onAsk();
  };

  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const avatarName = name ?? bond?.name ?? '';
  const avatarCharacterId = characterId ?? bond?.characterId;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: color }]}>
        <DiamondBackground color="#FFFFFF" alpha={0.08} />
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <MingCute name="lock" size={18} color="#FFFFFF" />
          <Text style={styles.clock}>
            {hh}:{mm}
          </Text>
          <Text style={styles.date}>{dateLine(now)}</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.prompt}>{wrong ? t('密码不对') : t('输入密码')}</Text>
          <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: PHONE_PASSCODE_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < code.length && styles.dotOn]} />
            ))}
          </Animated.View>
          {/* TA 的回复原地显示（D-100 交互改动 5） */}
          {bondId && askedAt !== null ? (
            waiting ? (
              <Text style={styles.waiting}>{t('TA 在看…')}</Text>
            ) : (
              <View style={styles.replyRow}>
                <CharAvatar name={avatarName} color={color} size={28} characterId={avatarCharacterId} />
                <View style={styles.replyBubbles}>
                  {replies.map((m) => (
                    <View key={m.id} style={styles.bubble}>
                      <Text style={styles.bubbleText}>{m.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.pad}>
          {KEYS.map((k) => (
            <Pressable key={k.n} style={({ pressed }) => [styles.key, pressed && styles.keyPressed]} onPress={() => press(k.n)}>
              <Text style={styles.keyNum}>{k.n}</Text>
              <Text style={styles.keyLetters}>{k.letters || ' '}</Text>
            </Pressable>
          ))}
          <View style={styles.keyBlank} />
          <Pressable style={({ pressed }) => [styles.key, pressed && styles.keyPressed]} onPress={() => press('0')}>
            <Text style={styles.keyNum}>0</Text>
            <Text style={styles.keyLetters}> </Text>
          </Pressable>
          <Pressable style={styles.keyBlank} onPress={() => setCode((c) => c.slice(0, -1))} hitSlop={8}>
            {code.length ? <IconSymbol name="delete.left" size={26} color="#FFFFFF" /> : null}
          </Pressable>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable onPress={ask} disabled={waiting} hitSlop={10}>
            <Text style={[styles.bottomText, waiting && styles.bottomDim]}>{t('问 TA 要密码')}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.bottomText}>{t('取消')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, justifyContent: 'space-between' },
    top: { alignItems: 'center', gap: 6 },
    clock: {
      fontFamily: Fonts.labelBold,
      fontSize: 84,
      lineHeight: 92,
      letterSpacing: -2,
      color: '#FFFFFF',
    },
    date: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: -6 },
    middle: { alignItems: 'center', gap: 18, paddingHorizontal: 34 },
    prompt: { fontSize: 18, color: '#FFFFFF' },
    dots: { flexDirection: 'row', gap: 22 },
    dot: { width: 13, height: 13, borderRadius: 6.5, borderWidth: 1.2, borderColor: '#FFFFFF' },
    dotOn: { backgroundColor: '#FFFFFF' },
    waiting: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
    replyRow: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch', gap: 8 },
    replyBubbles: { flexShrink: 1, alignItems: 'flex-start', gap: 6 },
    bubble: {
      backgroundColor: Romance.card,
      borderTopLeftRadius: Shape.radius,
      borderTopRightRadius: Shape.radius,
      borderBottomRightRadius: Shape.radius,
      borderBottomLeftRadius: Shape.radiusTail,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    bubbleText: { fontSize: 14, lineHeight: 20, color: Romance.ink },
    pad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: 26,
      rowGap: 16,
      paddingHorizontal: 40,
    },
    key: {
      width: KEY,
      height: KEY,
      borderRadius: Shape.radius,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyPressed: { backgroundColor: 'rgba(255,255,255,0.5)' },
    keyBlank: { width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' },
    keyNum: { fontFamily: Fonts.label, fontSize: 34, lineHeight: 38, color: '#FFFFFF' },
    keyLetters: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginTop: -2 },
    bottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 34 },
    bottomText: { fontSize: 16, color: '#FFFFFF' },
    bottomDim: { opacity: 0.5 },
  })
);

/**
 * TA 的手机锁屏（D-082/D-084）：做成一部真的 iPhone 锁屏——壁纸、时间、日期、四个密码点、九宫格数字键盘。
 * 猜对即 onUnlock；左下「问 TA 要密码」→ onAsk（回到会话，给 TA 发一条「想看你的手机」，TA 按性格决定）。
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { PHONE_PASSCODE_LENGTH } from '@/lib/phone';

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
const WEEKDAY = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function PhoneLock({
  visible,
  color,
  passcode,
  onUnlock,
  onAsk,
  onClose,
}: {
  visible: boolean;
  /** 角色主题色：壁纸渐变的起点 */
  color: string;
  passcode: string;
  onUnlock: () => void;
  onAsk: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!visible) {
      setCode('');
      setWrong(false);
      return;
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, [visible]);

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

  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const dateLine = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient colors={[color, '#2A1B22']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.screen}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <IconSymbol name="lock.fill" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={styles.clock}>
            {hh}:{mm}
          </Text>
          <Text style={styles.date}>{dateLine}</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.prompt}>{wrong ? t('密码不对') : t('输入密码')}</Text>
          <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: PHONE_PASSCODE_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < code.length && styles.dotOn]} />
            ))}
          </Animated.View>
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
            {code.length ? <IconSymbol name="delete.left" size={26} color="rgba(255,255,255,0.9)" /> : null}
          </Pressable>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable onPress={onAsk} hitSlop={10}>
            <Text style={styles.bottomText}>{t('问 TA 要密码')}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.bottomText}>{t('取消')}</Text>
          </Pressable>
        </View>
      </LinearGradient>
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
    middle: { alignItems: 'center', gap: 18 },
    prompt: { fontSize: 18, color: '#FFFFFF' },
    dots: { flexDirection: 'row', gap: 22 },
    dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.2, borderColor: '#FFFFFF' },
    dotOn: { backgroundColor: '#FFFFFF' },
    pad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: 26,
      rowGap: 16,
      paddingHorizontal: 40,
    },
    key: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyPressed: { backgroundColor: 'rgba(255,255,255,0.5)' },
    keyBlank: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
    keyNum: { fontFamily: Fonts.label, fontSize: 34, color: '#FFFFFF', lineHeight: 38 },
    keyLetters: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginTop: -2 },
    bottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 34 },
    bottomText: { fontSize: 16, color: '#FFFFFF' },
  })
);

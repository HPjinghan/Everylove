/**
 * 幸运签（D-128 / D-138）：拿零钱的地方，两页——
 * - 日签：每天一次水晶球「看一眼」，按运势给零钱 50–500 Coin + 一句签文。
 * - 转盘：投一笔零钱（50 / 100 / 200 / 500），转到几倍拿几倍（×0.5 / ×1.2 / ×2 / ×5，十格等概率，lib/wallet.ts WHEEL_SLICES）。
 * 余额只在顶上看一眼；流水在钱包 App。
 * 纸面：白卡 + accentSoft 水晶球 / 转盘格（无渐变无阴影），中文走系统字体、数字 Fredoka。
 */

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useAnimatedValue, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip, Segmented } from '@/components/chip';
import { MingCute } from '@/components/mingcute';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { FORTUNE_TEXTS } from '@/content/fortunes';
import { money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { drawFortune, fortuneDayKey, FORTUNES, spinWheel, WHEEL_BETS, WHEEL_SLICES } from '@/lib/wallet';
import { useAppStore } from '@/store/app-store';

const BALL = 220;
/** 水晶球亮起来的时长（毫秒） */
const REVEAL_MS = 1400;
/** 转盘尺寸与转动时长 */
const WHEEL = 240;
const SPIN_MS = 3200;
const SPIN_TURNS = 4;

type Tab = 'sign' | 'wheel';

export default function FortuneScreen() {
  const router = useRouter();
  const wallet = useAppStore((s) => s.wallet);
  const [tab, setTab] = useState<Tab>('sign');

  return (
    <AppScreen title={t('幸运签')} pattern onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('零钱')}</Text>
          <Text style={styles.balance}>{money(wallet.balance)}</Text>
        </Card>
        <Segmented<Tab>
          options={[
            { key: 'sign', label: t('日签') },
            { key: 'wheel', label: t('转盘') },
          ]}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />
        {tab === 'sign' ? <SignTab /> : <WheelTab balance={wallet.balance} />}
      </ScrollView>
    </AppScreen>
  );
}

/* ═══ 日签 ═══ */

function SignTab() {
  const fortune = useAppStore((s) => s.fortune);
  const [revealing, setRevealing] = useState(false);
  const [today, setToday] = useState(() => fortuneDayKey(Date.now()));
  const scale = useAnimatedValue(1);
  const glow = useAnimatedValue(0);

  // 今天抽过没：进页面时算一次，抽完再算一次（渲染期不读 Date.now()）
  const drawn = fortune?.day === today;
  const luckMeta = fortune ? FORTUNES[fortune.luck] : null;

  const look = () => {
    if (revealing || drawn) return;
    setRevealing(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: REVEAL_MS / 2, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: REVEAL_MS / 2, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: REVEAL_MS - 900, useNativeDriver: true }),
      ]),
    ]).start(() => {
      const now = Date.now();
      const day = fortuneDayKey(now);
      const { luck, amount, textIndex } = drawFortune(Math.random(), Math.random(), Math.random(), FORTUNE_TEXTS.great.length);
      const store = useAppStore.getState();
      store.setFortune({ day, luck, amount, text: FORTUNE_TEXTS[luck][textIndex] });
      store.creditWallet({ amount, kind: 'fortune', note: t('日签 · {luck}', { luck: t(FORTUNES[luck].label) }) });
      setToday(day);
      setRevealing(false);
    });
  };

  return (
    <>
      <Pressable onPress={look} disabled={revealing || drawn}>
        <Animated.View style={[styles.ball, { transform: [{ scale }] }]}>
          <Animated.View style={[styles.glow, { opacity: glow }]} />
          {drawn && fortune && luckMeta ? (
            <View style={styles.result}>
              <Text style={styles.luck}>{t(luckMeta.label)}</Text>
              <Text style={styles.amount}>+{money(fortune.amount)}</Text>
              <Text style={styles.sign}>{t(fortune.text)}</Text>
            </View>
          ) : (
            <View style={styles.result}>
              <MingCute name="sparkles" size={44} color={Romance.accent} />
              <Text style={styles.hint}>{revealing ? t('…') : t('今天的运势')}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      <Button label={drawn ? t('明天再来') : revealing ? t('…') : t('看一眼')} disabled={revealing || drawn} onPress={look} style={styles.actionBtn} />
    </>
  );
}

/* ═══ 转盘 ═══ */

const SLICE_DEG = 360 / WHEEL_SLICES.length;
const R = WHEEL / 2;

/** 一格的扇形路径：从正上方顺时针量角，i 格占 [i·36°, (i+1)·36°) */
function slicePath(i: number): string {
  const a0 = ((i * SLICE_DEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SLICE_DEG - 90) * Math.PI) / 180;
  const x0 = R + R * Math.cos(a0);
  const y0 = R + R * Math.sin(a0);
  const x1 = R + R * Math.cos(a1);
  const y1 = R + R * Math.sin(a1);
  return `M${R} ${R} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
const SLICE_PATHS = WHEEL_SLICES.map((_, i) => slicePath(i));

function multLabel(m: number): string {
  return `×${m}`;
}

function WheelTab({ balance }: { balance: number }) {
  const [bet, setBet] = useState(WHEEL_BETS[0]);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<{ mult: number; net: number } | null>(null);
  const angle = useAnimatedValue(0);
  /** 当前停在几度（累加，不回零，转盘才不会倒转） */
  const angleRef = useRef(0);
  const lockRef = useRef(false);

  const canSpin = !spinning && balance >= bet;

  const spin = () => {
    if (lockRef.current || !canSpin) return;
    lockRef.current = true;
    setSpinning(true);
    setLast(null);
    const r = spinWheel(bet, Math.random());
    // 要让第 slice 格的中心转到正上方：顺时针转 θ 后格中心在 c + θ，取 θ ≡ −c (mod 360)；再加几整圈与格内一点随机
    const center = r.slice * SLICE_DEG + SLICE_DEG / 2;
    const current = ((angleRef.current % 360) + 360) % 360;
    const delta = (((360 - center - current) % 360) + 360) % 360;
    const jitter = (Math.random() - 0.5) * SLICE_DEG * 0.6;
    const target = angleRef.current + SPIN_TURNS * 360 + delta + jitter;
    Animated.timing(angle, { toValue: target, duration: SPIN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      angleRef.current = target;
      useAppStore.getState().creditWallet({ amount: r.net, kind: 'wheel', note: t('转盘 · {mult}', { mult: multLabel(r.mult) }) });
      setLast({ mult: r.mult, net: r.net });
      setSpinning(false);
      lockRef.current = false;
    });
  };

  const rotate = angle.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <View style={styles.wheelWrap}>
        <View style={styles.pointer} />
        <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
          <Svg width={WHEEL} height={WHEEL} viewBox={`0 0 ${WHEEL} ${WHEEL}`}>
            {WHEEL_SLICES.map((m, i) => (
              <Path
                key={i}
                d={SLICE_PATHS[i]}
                fill={m >= 5 ? Romance.accent : i % 2 === 0 ? Romance.accentSoft : Romance.card}
                stroke={Romance.stroke}
                strokeWidth={Shape.stroke}
              />
            ))}
          </Svg>
          {WHEEL_SLICES.map((m, i) => (
            <View key={i} pointerEvents="none" style={[styles.sliceLabelWrap, { transform: [{ rotate: `${i * SLICE_DEG + SLICE_DEG / 2}deg` }] }]}>
              <Text style={[styles.sliceLabel, m >= 5 && styles.sliceLabelHot]}>{multLabel(m)}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Text style={styles.outcome}>
        {last ? `${multLabel(last.mult)} · ${last.net > 0 ? '+' : '-'}${money(Math.abs(last.net))}` : spinning ? t('…') : ' '}
      </Text>

      <View style={styles.bets}>
        {WHEEL_BETS.map((b) => (
          <Chip key={b} label={`${b}`} selected={b === bet} onPress={() => !spinning && setBet(b)} style={b > balance ? styles.betOff : undefined} />
        ))}
      </View>

      <Button label={spinning ? t('…') : t('转一下')} disabled={!canSpin} onPress={spin} style={styles.actionBtn} />
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    body: { paddingHorizontal: Space.screen, paddingTop: Space.screen, paddingBottom: 40, gap: Space.screen, alignItems: 'stretch' },
    balanceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    balanceLabel: { fontSize: 13, color: Romance.sub },
    balance: { fontFamily: Fonts.labelBold, fontSize: 22, color: Romance.ink },
    tabs: { alignSelf: 'center' },
    ball: {
      width: BALL,
      height: BALL,
      borderRadius: BALL / 2,
      alignSelf: 'center',
      backgroundColor: Romance.accentSoft,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha('#FFFFFF', 0.7) },
    result: { alignItems: 'center', paddingHorizontal: 24, gap: 6 },
    hint: { fontSize: 14, color: Romance.sub, marginTop: 4 },
    luck: { fontSize: 30, fontWeight: '700', color: Romance.ink },
    amount: { fontFamily: Fonts.labelBold, fontSize: 20, color: Romance.accentStrong },
    sign: { fontSize: 13, color: Romance.sub, textAlign: 'center', lineHeight: 19 },
    actionBtn: { alignSelf: 'center', minWidth: 160 },
    wheelWrap: { alignSelf: 'center', alignItems: 'center', paddingTop: 6 },
    pointer: {
      width: 0,
      height: 0,
      borderLeftWidth: 9,
      borderRightWidth: 9,
      borderTopWidth: 16,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: Romance.ink,
      marginBottom: -6,
      zIndex: 1,
    },
    wheel: { width: WHEEL, height: WHEEL, borderRadius: WHEEL / 2, overflow: 'hidden' },
    sliceLabelWrap: { position: 'absolute', top: 0, left: 0, width: WHEEL, height: WHEEL, alignItems: 'center', paddingTop: 14 },
    sliceLabel: { fontFamily: Fonts.labelBold, fontSize: 13, color: Romance.ink },
    sliceLabelHot: { color: '#FFFFFF' },
    outcome: { fontFamily: Fonts.labelBold, fontSize: 18, color: Romance.accentStrong, textAlign: 'center', minHeight: 24 },
    bets: { flexDirection: 'row', justifyContent: 'center', gap: Space.inline },
    betOff: { opacity: 0.4 },
  })
);

/**
 * 交友（D-040/D-041，原「广场」交友 App 更名）：Tinder 式滑卡。
 * 左滑 = 略过（不是拉黑，冷却后回流牌堆）；右滑 = 心动——**TA 一定会同意**，
 * 右滑即配对成功（无条件接纳你的世界，你的心动不会落空）。
 * 牌堆顺序走推荐算法 lib/recommend.ts（口味/热度/新面孔/自创/每日轮换/略过冷却），
 * 之后其他用户上传的角色进同一个池子、同一套打分（UGC 供给接口，D-041）。
 * 配对后进入试聊（squareChats）：不入 Message、3 天不聊过期——免费层的天花板是商业决策。
 * 「广场」这个名字让给了外出模块的陌生人地点（content/places.ts 的 plaza）。
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { CHARACTERS } from '@/content/characters';
import { Romance, themed } from '@/constants/theme';
import { heatLabel } from '@/lib/format';
import { hasFreshSupply, rankDeck } from '@/lib/recommend';
import type { Character, LovePref } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;

/** 偏好选项（D-049）：与 onboarding 第一问同一套口味 */
const PREFS: { key: LovePref; label: string }[] = [
  { key: 'male', label: '男生' },
  { key: 'female', label: '女生' },
  { key: 'any', label: '都可以' },
  { key: 'nonhuman', label: '非人类' },
];

/** 卡面：立绘铺满（无立绘用角色色渐变 + 大首字），底部渐变叠名字/身份/钩子/热度；compact = 瀑布流小卡 */
function DeckCard({ c, compact }: { c: Character; compact?: boolean }) {
  const portrait = useAppStore((s) => s.portraits[c.id]);
  return (
    <View style={styles.cardImage}>
      {portrait ? (
        <Image source={{ uri: portrait }} style={styles.cardImageFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[c.colorSoft, c.color]} style={styles.cardImageFill}>
          <View style={styles.placeholderCenter}>
            <Text style={[styles.placeholderLetter, compact && { fontSize: 56 }]}>
              {c.name.slice(0, 1)}
            </Text>
          </View>
        </LinearGradient>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={[styles.cardOverlay, compact && styles.cardOverlayCompact]}>
        <Text style={[styles.cardName, compact && { fontSize: 17 }]}>{c.name}</Text>
        <Text style={styles.cardIdentity} numberOfLines={1}>
          {c.identity}
        </Text>
        {!compact ? (
          <Text style={styles.cardHook} numberOfLines={1}>
            {c.hook}
          </Text>
        ) : null}
        <View style={styles.heatRow}>
          <MingCute name="fire" size={13} color="#FF9A5C" />
          <Text style={styles.heatText}>{heatLabel(c.adoptedCount)}</Text>
          {c.custom ? <Text style={styles.mineTag}>你的创作</Text> : null}
        </View>
      </LinearGradient>
    </View>
  );
}

export default function DatingScreen() {
  const router = useRouter();
  const customs = useAppStore((s) => s.customCharacters);
  const bonds = useAppStore((s) => s.bonds);
  const squareChats = useAppStore((s) => s.squareChats);
  const lovePref = useAppStore((s) => s.lovePref);
  const datingPasses = useAppStore((s) => s.datingPasses);
  const view = useAppStore((s) => s.datingView);

  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [match, setMatch] = useState<Character | null>(null);
  const [prefOpen, setPrefOpen] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;

  const bondedIds = useMemo(() => new Set(bonds.map((b) => b.characterId)), [bonds]);

  // 牌堆：没加好友、没配对的（预告卡不进牌堆——右滑必成，配了要能聊）。
  // 顺序走推荐算法（D-041）：口味 / 热度 / 新面孔 / 自创 / 每日轮换 / 略过冷却。
  // 冷却只在供给充足时生效（D-042）：全池都被略过时忽略冷却直接回流，不用等 3 天。
  const { deck, poolCount } = useMemo(() => {
    // 偏好过滤（D-049）：口味不再只是排序加权，而是直接筛（「都可以」看全部）
    const pool = [...customs, ...CHARACTERS].filter(
      (c) =>
        !c.teaser &&
        !bondedIds.has(c.id) &&
        !squareChats[c.id] &&
        (!lovePref || lovePref === 'any' || c.loveTag === lovePref)
    );
    const available = pool.filter((c) => !swipedIds.includes(c.id));
    const ample = hasFreshSupply(pool, datingPasses);
    return {
      deck: rankDeck(available, {
        lovePref,
        passes: ample ? datingPasses : {},
        knownIds: new Set([...Object.keys(squareChats), ...bondedIds]),
      }),
      poolCount: pool.length,
    };
  }, [customs, bondedIds, squareChats, swipedIds, lovePref, datingPasses]);

  // 全划完自动回流（D-042）：本次全滑过但池子还有人 → 重开一轮，不出空牌堆
  useEffect(() => {
    if (deck.length === 0 && poolCount > 0) setSwipedIds([]);
  }, [deck.length, poolCount]);

  const top = deck[0];
  const next = deck[1];

  // 配对列表：配过对、还没加好友的（3 天不聊会过期）
  const matches = useMemo(
    () =>
      Object.values(squareChats)
        .filter((chat) => !bondedIds.has(chat.characterId))
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
        .map((chat) => [...customs, ...CHARACTERS].find((c) => c.id === chat.characterId))
        .filter((c): c is Character => Boolean(c)),
    [squareChats, bondedIds, customs]
  );

  const completeSwipe = (c: Character, liked: boolean) => {
    pan.setValue({ x: 0, y: 0 });
    setSwipedIds((prev) => [...prev, c.id]);
    if (liked) {
      // 右滑心动：TA 一定会同意——当场配对，等她去打招呼
      useAppStore.getState().ensureSquareChat(c.id);
      setMatch(c);
    } else {
      // 左滑略过：记进推荐算法的冷却项（不是拉黑，之后回流）
      useAppStore.getState().markDatingPass(c.id);
    }
  };

  const flyOut = (dir: 1 | -1) => {
    if (!top) return;
    Animated.timing(pan, {
      toValue: { x: dir * SCREEN_W * 1.3, y: 40 },
      duration: 240,
      useNativeDriver: false,
    }).start(() => completeSwipe(top, dir === 1));
  };

  const topId = top?.id;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 100) {
            flyOut(g.dx >= 0 ? 1 : -1);
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topId]
  );

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-14deg', '0deg', '14deg'],
  });
  const likeStamp = pan.x.interpolate({
    inputRange: [40, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const passStamp = pan.x.interpolate({
    inputRange: [-120, -40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const sayHi = (c: Character) => {
    setMatch(null);
    router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } });
  };

  // 瀑布流模式（D-049）：点卡 = 心动（TA 一定会同意），与右滑同效
  const tapMatch = (c: Character) => {
    setSwipedIds((prev) => [...prev, c.id]);
    useAppStore.getState().ensureSquareChat(c.id);
    setMatch(c);
  };

  const gridColA = deck.filter((_, i) => i % 2 === 0);
  const gridColB = deck.filter((_, i) => i % 2 === 1);

  return (
    <AppScreen
      title="交友"
      right={
        <Pressable onPress={() => setPrefOpen(true)} hitSlop={8}>
          <Text style={styles.prefAction}>偏好</Text>
        </Pressable>
      }>
      {/* 视图切换（D-049）：滑卡 / 瀑布流 */}
      <View style={styles.viewToggle}>
        {(
          [
            ['swipe', '滑卡'],
            ['grid', '列表'],
          ] as const
        ).map(([v, label]) => (
          <Pressable
            key={v}
            style={[styles.viewBtn, view === v && styles.viewBtnActive]}
            onPress={() => useAppStore.getState().setDatingView(v)}>
            <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {/* 配对列表：滑到即配对；3 天不聊过期 */}
      {matches.length > 0 && (
        <View style={styles.matchesWrap}>
          <Text style={styles.matchesTitle}>配对 · 3 天不聊会过期</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchesRow}>
            {matches.map((c) => (
              <Pressable
                key={c.id}
                style={styles.matchItem}
                onPress={() => router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } })}>
                <CharAvatar name={c.name} color={c.color} size={54} characterId={c.id} />
                <Text style={styles.matchName} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {view === 'grid' ? (
        /* 瀑布流（D-049）：双列人物卡，点卡即配对 */
        <ScrollView contentContainerStyle={styles.gridFeed} showsVerticalScrollIndicator={false}>
          <View style={styles.gridCols}>
            <View style={styles.gridCol}>
              {gridColA.map((c) => (
                <Pressable key={c.id} style={styles.gridCard} onPress={() => tapMatch(c)}>
                  <DeckCard c={c} compact />
                </Pressable>
              ))}
            </View>
            <View style={styles.gridCol}>
              {gridColB.map((c) => (
                <Pressable key={c.id} style={styles.gridCard} onPress={() => tapMatch(c)}>
                  <DeckCard c={c} compact />
                </Pressable>
              ))}
            </View>
          </View>
          {deck.length === 0 ? (
            <View style={styles.emptyDeck}>
              <Text style={styles.emptyEmoji}>🫧</Text>
              <Text style={styles.emptyText}>这里的人都被你聊完了。</Text>
            </View>
          ) : (
            <Text style={styles.gridHint}>点一下卡片 = 心动——TA 一定会同意</Text>
          )}
        </ScrollView>
      ) : (
      <View style={styles.deckArea}>
        {top ? (
          <>
            {next ? (
              <View style={[styles.card, styles.cardBehind]}>
                <DeckCard c={next} />
              </View>
            ) : null}
            <Animated.View
              style={[
                styles.card,
                { transform: [...pan.getTranslateTransform(), { rotate }] },
              ]}
              {...panResponder.panHandlers}>
              <DeckCard c={top} />
              {/* 印章跟手浮现：右 = 心动（必成），左 = 略过 */}
              <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeStamp }]}>
                <Text style={styles.stampText}>心动 💘</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passStamp }]}>
                <Text style={[styles.stampText, styles.stampPassText]}>略过</Text>
              </Animated.View>
            </Animated.View>
          </>
        ) : (
          <View style={styles.emptyDeck}>
            <Text style={styles.emptyEmoji}>🫧</Text>
            <Text style={styles.emptyText}>这里的人都被你聊完了。</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/apps/create')}>
              <Text style={styles.emptyBtnText}>去创造一个新的 TA</Text>
            </Pressable>
          </View>
        )}
      </View>
      )}

      {view === 'swipe' && top ? (
        <View style={styles.footArea}>
          <View style={styles.btnRow}>
            <Pressable style={styles.passBtn} onPress={() => flyOut(-1)}>
              <MingCute name="close" size={26} color={Romance.sub} />
            </Pressable>
            <Pressable style={styles.heartBtn} onPress={() => flyOut(1)}>
              <MingCute name="heart" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.footHint}>左滑略过 · 右滑心动——TA 一定会同意</Text>
        </View>
      ) : null}

      {/* 偏好（D-049）：随时改口味，牌池直接按它筛 */}
      <Modal
        visible={prefOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrefOpen(false)}>
        <Pressable style={styles.prefMask} onPress={() => setPrefOpen(false)}>
          <Pressable style={styles.prefSheet} onPress={() => {}}>
            <Text style={styles.prefTitle}>你想遇到谁？</Text>
            {PREFS.map((p) => {
              const active = (lovePref ?? 'any') === p.key;
              return (
                <Pressable
                  key={p.key}
                  style={[styles.prefRow, active && styles.prefRowActive]}
                  onPress={() => {
                    useAppStore.getState().setLovePref(p.key);
                    setPrefOpen(false);
                  }}>
                  <Text style={[styles.prefRowText, active && styles.prefRowTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.prefHint}>随时可以换着看 · 只影响这里出现的人</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 配对成功 */}
      {match ? (
        <View style={styles.matchOverlay}>
          <Text style={styles.matchBig}>配对成功</Text>
          <CharAvatar name={match.name} color={match.color} size={96} characterId={match.id} />
          <Text style={styles.matchCharName}>{match.name}</Text>
          <Text style={styles.matchSub}>TA 同意了 · 在这个世界，你的心动不会落空</Text>
          <Pressable style={styles.matchPrimary} onPress={() => sayHi(match)}>
            <Text style={styles.matchPrimaryText}>去打招呼</Text>
          </Pressable>
          <Pressable style={styles.matchSecondary} onPress={() => setMatch(null)}>
            <Text style={styles.matchSecondaryText}>继续滑</Text>
          </Pressable>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    prefAction: { fontSize: 14, fontWeight: '700', color: Romance.accent },
    viewToggle: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 3,
      marginTop: 10,
      gap: 2,
    },
    viewBtn: { borderRadius: 15, paddingHorizontal: 18, paddingVertical: 6 },
    viewBtnActive: { backgroundColor: Romance.accent },
    viewBtnText: { fontSize: 12, fontWeight: '600', color: Romance.sub },
    viewBtnTextActive: { color: '#FFFFFF' },
    gridFeed: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },
    gridCols: { flexDirection: 'row', gap: 10 },
    gridCol: { flex: 1, gap: 10 },
    gridCard: {
      aspectRatio: 3 / 4,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#FFFFFF',
      shadowColor: '#B96A82',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    gridHint: { textAlign: 'center', fontSize: 11, color: Romance.faint, marginTop: 14 },
    cardOverlayCompact: { paddingHorizontal: 12, paddingTop: 28, paddingBottom: 10 },
    prefMask: {
      flex: 1,
      backgroundColor: 'rgba(59,33,38,0.4)',
      justifyContent: 'flex-end',
    },
    prefSheet: {
      backgroundColor: Romance.bg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      padding: 20,
      paddingBottom: 34,
    },
    prefTitle: { fontSize: 18, fontWeight: '700', color: Romance.ink, marginBottom: 14 },
    prefRow: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    prefRowActive: { backgroundColor: Romance.accent },
    prefRowText: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    prefRowTextActive: { color: '#FFFFFF' },
    prefHint: { textAlign: 'center', fontSize: 11, color: Romance.faint, marginTop: 8 },
    matchesWrap: { paddingTop: 10 },
    matchesTitle: {
      fontSize: 11,
      color: Romance.faint,
      fontWeight: '600',
      paddingHorizontal: 16,
      marginBottom: 6,
    },
    matchesRow: { paddingHorizontal: 14, gap: 12 },
    matchItem: { alignItems: 'center', width: 58 },
    matchName: { fontSize: 10, color: Romance.sub, marginTop: 4, maxWidth: 58 },
    deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      position: 'absolute',
      width: CARD_W,
      aspectRatio: 3 / 4,
      borderRadius: 26,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      shadowColor: '#B96A82',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    cardBehind: { transform: [{ scale: 0.94 }, { translateY: 14 }] },
    cardImage: { flex: 1, backgroundColor: Romance.accentSoft },
    cardImageFill: { width: '100%', height: '100%' },
    placeholderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    placeholderLetter: { fontSize: 96, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
    cardOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 46,
      paddingBottom: 16,
    },
    cardName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
    cardIdentity: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
    cardHook: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
    heatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    heatText: { fontSize: 12, color: '#FF9A5C', fontWeight: '700' },
    mineTag: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 8 },
    stamp: {
      position: 'absolute',
      top: 26,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    stampLike: { left: 18, transform: [{ rotate: '-8deg' }] },
    stampPass: { right: 18, transform: [{ rotate: '8deg' }] },
    stampText: { fontSize: 20, fontWeight: '800', color: Romance.accent },
    stampPassText: { color: Romance.sub },
    footArea: { alignItems: 'center', paddingBottom: 18, gap: 8 },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 26 },
    passBtn: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#3B2126',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    heartBtn: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Romance.accent,
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    footHint: { fontSize: 11, color: Romance.faint },
    emptyDeck: { alignItems: 'center', gap: 10, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 44 },
    emptyText: { fontSize: 14, color: Romance.sub, textAlign: 'center' },
    emptyBtn: {
      marginTop: 6,
      backgroundColor: Romance.accent,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    emptyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    matchOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(59,33,38,0.86)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    matchBig: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
    matchCharName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
    matchSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
    matchPrimary: {
      marginTop: 18,
      backgroundColor: Romance.accent,
      borderRadius: 24,
      paddingHorizontal: 40,
      paddingVertical: 14,
    },
    matchPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    matchSecondary: { padding: 10 },
    matchSecondaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  })
);

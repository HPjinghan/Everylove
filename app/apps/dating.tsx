/**
 * 交友（D-040/D-041，原「广场」交友 App 更名；D-100 纸面）：Tinder 式滑卡。
 * 左滑 = 略过（不是拉黑，冷却后回流牌堆；略过后 3 秒内可撤销，卡回牌顶）；右滑 = 心动——**TA 一定会同意**，
 * 右滑即配对成功（无条件接纳你的世界，你的心动不会落空）。
 * 牌堆顺序走推荐算法 lib/recommend.ts（口味/热度/新面孔/自创/每日轮换/略过冷却），
 * 之后其他用户上传的角色进同一个池子、同一套打分（UGC 供给接口，D-041）。
 * 配对后进入试聊（squareChats）：不入 Message、3 天不聊过期——免费层的天花板是商业决策。
 * 「广场」这个名字让给了外出模块的陌生人地点（content/places.ts 的 plaza）。
 *
 * 纸面（D-100）：paper 底 + 菱格；顶栏右侧留空——滑卡 / 列表分段与口味 chip 并排居中（chip 直接显示当前口味，点开偏好卡）；
 * 牌堆卡 = 白卡描边 r6，上半 paper 圆托宋体大首字（有立绘则铺立绘），下半信息块以分区线隔开；无阴影、无渐变。
 * 左滑略过后，按钮下方的提示原位换成 ink 底行内 toast「已略过一位 · 撤销」，3s 后换回；飞出动画期间不响应再次滑动。
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValueXY,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Chip, Segmented } from '@/components/chip';
import { MingCute } from '@/components/mingcute';
import { DiamondBackground } from '@/components/paper-bg';
import { CHARACTERS, seedCharactersFor } from '@/content/characters';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { heatLabel } from '@/lib/format';
import { portraitSource } from '@/lib/imagegen';
import { t } from '@/lib/i18n';
import { refreshSharedPool } from '@/lib/pool';
import { hasFreshSupply, rankDeck } from '@/lib/recommend';
import type { Character, LovePref } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const { width: SCREEN_W } = Dimensions.get('window');
/** 牌堆卡宽：设计 342；窄屏按屏幕左右留白收 */
const CARD_W = Math.min(Space.matchCardWidth, SCREEN_W - Space.screen * 2);
/** 无立绘时托首字的 paper 圆：直径 236（设计稿半径 118）；瀑布流小卡缩到 112 */
const INITIAL_CIRCLE = 236;
const INITIAL_CIRCLE_COMPACT = 112;
/** 略过后行内 toast 的停留时长 */
const PASS_TOAST_MS = 3000;
/** 滑卡手势：横向位移超过这个值才接管手势 */
const SWIPE_START_PX = 8;
/** 松手时横向位移超过这个值 = 飞出，否则弹回 */
const SWIPE_COMMIT_PX = 100;

/**
 * 本轮是否已把整池划完（D-042）：是 → 视为重开一轮，已滑列表按空算。
 * 牌堆派生与写入都走这一个口径，全划完时不出空牌堆、也不需要 effect 去清状态。
 */
function roundDone(poolIds: string[], swiped: string[]): boolean {
  return poolIds.length > 0 && poolIds.every((id) => swiped.includes(id));
}

/** 偏好选项（D-049）：与 onboarding 第一问同一套口味 */
const PREFS: { key: LovePref; label: string }[] = [
  { key: 'male', label: '男生' },
  { key: 'female', label: '女生' },
  { key: 'any', label: '都可以' },
  { key: 'nonhuman', label: '非人类' },
];

/**
 * 卡面（D-100）：白卡描边；上半区有立绘铺立绘、没有则 paper 圆 + 宋体大首字（角色色）；
 * 分区线下是信息块：名 / 身份 / 钩子 / 热度。compact = 瀑布流小卡。position = 「1 / 3」牌堆位置（只在顶卡）。
 */
function DeckCard({ c, compact, position }: { c: Character; compact?: boolean; position?: string }) {
  const stored = useAppStore((s) => s.portraits[c.id]);
  // 她重画过的优先，种子角色回落内置立绘（D-092）
  const portrait = portraitSource(c.id, stored);
  return (
    <Card padded={false} style={styles.deckCard}>
      <View style={styles.deckTop}>
        {portrait ? (
          <Image source={portrait} style={styles.deckPortrait} contentFit="cover" />
        ) : (
          <View style={[styles.deckCircle, compact && styles.deckCircleCompact]}>
            <Text style={[styles.deckInitial, compact && styles.deckInitialCompact, { color: c.color }]}>
              {c.name.slice(0, 1)}
            </Text>
          </View>
        )}
        {position ? <Text style={styles.deckPosition}>{position}</Text> : null}
      </View>
      <Divider />
      <View style={[styles.deckInfo, compact && styles.deckInfoCompact]}>
        {compact ? (
          <>
            <Text style={styles.deckNameCompact} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.deckIdentityCompact} numberOfLines={1}>
              {c.identity}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.deckNameRow}>
              <Text style={styles.deckName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.deckIdentity} numberOfLines={1}>
                {c.identity}
              </Text>
            </View>
            <Text style={styles.deckHook} numberOfLines={2}>
              {c.hook}
            </Text>
          </>
        )}
        <View style={styles.heatRow}>
          <Text style={styles.heatNum}>◆ {heatLabel(c.adoptedCount)}</Text>
          <Text style={styles.heatText}>{t('人心动')}</Text>
          {c.custom && !c.shared ? <Text style={styles.tag}>{t('你的创作')}</Text> : null}
          {c.shared ? <Text style={styles.tag}>{t('来自其他玩家')}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

export default function DatingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customs = useAppStore((s) => s.customCharacters);
  const bonds = useAppStore((s) => s.bonds);
  const squareChats = useAppStore((s) => s.squareChats);
  const lovePref = useAppStore((s) => s.lovePref);
  const language = useAppStore((s) => s.language);
  const datingPasses = useAppStore((s) => s.datingPasses);
  const view = useAppStore((s) => s.datingView);
  const introDone = useAppStore((s) => s.introDone);
  const sharedPool = useAppStore((s) => s.sharedPool);

  // 共享角色池（D-060）：进交友时刷新一次（5 分钟节流，离线用缓存）
  useEffect(() => {
    void refreshSharedPool();
  }, []);

  // 新手流逃生门（D-058）：不想滑了也放行桌面
  const escapeIntro = () => {
    useAppStore.getState().setIntroDone();
    router.replace('/');
  };

  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [match, setMatch] = useState<Character | null>(null);
  const [prefOpen, setPrefOpen] = useState(false);
  // 刚略过的那位（D-100）：3 秒内可撤销
  const [passed, setPassed] = useState<Character | null>(null);
  const passTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 飞出动画锁：动画期间不响应再次滑动
  const animating = useRef(false);
  // 手势原点：触摸落下时记一次，接管手势时再归零（同 PanResponder：dx 从接管点起算）
  const gestureOrigin = useRef({ x: 0, y: 0 });
  const [deckH, setDeckH] = useState(0);
  const pan = useAnimatedValueXY({ x: 0, y: 0 });

  useEffect(
    () => () => {
      if (passTimer.current) clearTimeout(passTimer.current);
    },
    []
  );

  const bondedIds = useMemo(() => new Set(bonds.map((b) => b.characterId)), [bonds]);

  // 牌堆：没加好友、没配对的（预告卡不进牌堆——右滑必成，配了要能聊）。
  // 顺序走推荐算法（D-041）：口味 / 热度 / 新面孔 / 自创 / 每日轮换 / 略过冷却。
  // 冷却只在供给充足时生效（D-042）：全池都被略过时忽略冷却直接回流，不用等 3 天。
  // 全划完自动回流（D-042）：本次全滑过但池子还有人 → 渲染期直接视为重开一轮，不出空牌堆。
  const { deck, poolCount, poolIds } = useMemo(() => {
    // 偏好过滤（D-049）：口味不再只是排序加权，而是直接筛（「都可以」看全部）；
    // 共享池（D-060）：别人公开的角色合入同一池、同一套打分（本地已有同 id 的不重复）
    const remote = sharedPool.filter((c) => !customs.some((x) => x.id === c.id));
    // 种子角色只发本语言的一套（D-093）；自创与共享池已按语言过滤
    const pool = [...customs, ...seedCharactersFor(language), ...remote].filter(
      (c) =>
        !c.teaser &&
        !bondedIds.has(c.id) &&
        !squareChats[c.id] &&
        (!lovePref || lovePref === 'any' || c.loveTag === lovePref)
    );
    const ids = pool.map((c) => c.id);
    const swiped = roundDone(ids, swipedIds) ? [] : swipedIds;
    const available = pool.filter((c) => !swiped.includes(c.id));
    const ample = hasFreshSupply(pool, datingPasses);
    return {
      deck: rankDeck(available, {
        lovePref,
        passes: ample ? datingPasses : {},
        knownIds: new Set([...Object.keys(squareChats), ...bondedIds]),
      }),
      poolCount: pool.length,
      poolIds: ids,
    };
  }, [customs, sharedPool, bondedIds, squareChats, swipedIds, lovePref, datingPasses, language]);

  // 已滑列表的写入口径与牌堆派生一致：上一轮已把整池划完 → 先按重开一轮算，再记这一次
  const recordSwipe = (id: string) =>
    setSwipedIds((prev) => [...(roundDone(poolIds, prev) ? [] : prev), id]);

  const top = deck[0];
  const next = deck[1];
  const position = `${poolCount - deck.length + 1} / ${poolCount}`;
  // 卡宽：设计 342；牌堆区放不下（小屏）就按可用高度收
  const cardW =
    deckH > 0
      ? Math.min(CARD_W, Math.floor((deckH - Space.matchBehindOffset * 2) * Space.matchCardRatio))
      : CARD_W;

  // 配对列表：配过对、还没加好友的（3 天不聊会过期）。
  // 自己创造的「心动中」不在这里——TA 们住在通讯录（D-052）；共享池的配对正常显示（D-060）。
  const matches = useMemo(
    () =>
      Object.values(squareChats)
        .filter((chat) => !bondedIds.has(chat.characterId))
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
        .map((chat) =>
          [...customs, ...CHARACTERS, ...sharedPool].find((c) => c.id === chat.characterId)
        )
        .filter((c): c is Character => Boolean(c) && !(c!.custom && !c!.shared)),
    [squareChats, bondedIds, customs, sharedPool]
  );

  const clearPassToast = () => {
    if (passTimer.current) clearTimeout(passTimer.current);
    passTimer.current = null;
    setPassed(null);
  };

  const showPassToast = (c: Character) => {
    if (passTimer.current) clearTimeout(passTimer.current);
    setPassed(c);
    passTimer.current = setTimeout(() => {
      passTimer.current = null;
      setPassed(null);
    }, PASS_TOAST_MS);
  };

  // 撤销略过（D-100）：本轮已滑列表里去掉 + 冷却记录去掉——状态整体回到略过前，牌堆重排后 TA 自然回到牌顶
  const undoPass = () => {
    const c = passed;
    if (!c) return;
    clearPassToast();
    setSwipedIds((prev) => (roundDone(poolIds, prev) ? [] : prev).filter((id) => id !== c.id));
    useAppStore.getState().unmarkDatingPass(c.id);
  };

  const completeSwipe = (c: Character, liked: boolean) => {
    pan.setValue({ x: 0, y: 0 });
    recordSwipe(c.id);
    if (liked) {
      // 右滑心动：TA 一定会同意——当场配对，等她去打招呼
      clearPassToast();
      useAppStore.getState().ensureSquareChat(c.id);
      setMatch(c);
    } else {
      // 左滑略过：记进推荐算法的冷却项（不是拉黑，之后回流）；3 秒内可撤销
      useAppStore.getState().markDatingPass(c.id);
      showPassToast(c);
    }
    animating.current = false;
  };

  const flyOut = (dir: 1 | -1) => {
    if (!top || animating.current) return;
    animating.current = true;
    Animated.timing(pan, {
      toValue: { x: dir * SCREEN_W * 1.3, y: 40 },
      duration: 240,
      useNativeDriver: false,
    }).start(() => completeSwipe(top, dir === 1));
  };

  // 滑卡手势：直接挂 responder 回调（等价于 PanResponder：落下记原点、横向超阈值接管、接管点归零起算 dx）。
  // 回调只在手势事件里读 ref，渲染期不碰 .current。
  const gestureDelta = (e: GestureResponderEvent) => ({
    dx: e.nativeEvent.pageX - gestureOrigin.current.x,
    dy: e.nativeEvent.pageY - gestureOrigin.current.y,
  });
  const markOrigin = (e: GestureResponderEvent) => {
    gestureOrigin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const springBack = () => {
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };
  const onStartShouldSetResponderCapture = (e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length === 1) markOrigin(e);
    return false;
  };
  const onMoveShouldSetResponder = (e: GestureResponderEvent) => {
    const { dx, dy } = gestureDelta(e);
    return !animating.current && Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > Math.abs(dy);
  };
  const onResponderGrant = (e: GestureResponderEvent) => {
    markOrigin(e);
    return true;
  };
  const onResponderMove = (e: GestureResponderEvent) => {
    const { dx, dy } = gestureDelta(e);
    pan.setValue({ x: dx, y: dy });
  };
  const onResponderRelease = (e: GestureResponderEvent) => {
    const { dx } = gestureDelta(e);
    if (Math.abs(dx) > SWIPE_COMMIT_PX) flyOut(dx >= 0 ? 1 : -1);
    else springBack();
  };

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
    recordSwipe(c.id);
    useAppStore.getState().ensureSquareChat(c.id);
    setMatch(c);
  };

  const gridColA = deck.filter((_, i) => i % 2 === 0);
  const gridColB = deck.filter((_, i) => i % 2 === 1);

  const viewOptions: { key: 'swipe' | 'grid'; label: string }[] = [
    { key: 'swipe', label: t('滑卡') },
    { key: 'grid', label: t('列表') },
  ];
  const prefLabel = t(PREFS.find((p) => p.key === (lovePref ?? 'any'))?.label ?? '都可以');

  return (
    <AppScreen title="交友" onBack={!introDone ? escapeIntro : undefined} pattern>
      {/* 新手流（D-058）：滑到心动就是入口；不想滑有逃生门 */}
      {!introDone ? (
        <Pressable onPress={escapeIntro} hitSlop={6}>
          <Text style={styles.skipIntro}>{t('先不滑了，随便逛逛 →')}</Text>
        </Pressable>
      ) : null}
      {/* 视图切换（D-049）+ 口味 chip（D-100）：并排居中；chip 直接显示当前口味，点开偏好卡 */}
      <View style={styles.controls}>
        <Segmented
          options={viewOptions}
          value={view}
          onChange={(v) => useAppStore.getState().setDatingView(v)}
        />
        <Pressable style={styles.prefChip} onPress={() => setPrefOpen(true)} hitSlop={6}>
          <Text style={styles.prefChipText}>{prefLabel} ▾</Text>
        </Pressable>
      </View>
      {/* 配对列表：滑到即配对；3 天不聊过期 */}
      {matches.length > 0 && (
        <View style={styles.matchesWrap}>
          <Text style={styles.matchesTitle}>{t('配对 · 3 天不聊会过期')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchesRow}>
            {matches.map((c) => (
              <Pressable
                key={c.id}
                style={styles.matchItem}
                onPress={() => router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } })}>
                <CharAvatar name={c.name} color={c.color} size={Space.avatar.card} characterId={c.id} />
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
              <Text style={styles.emptyText}>{t('这里的人都被你聊完了。')}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.deckArea} onLayout={(e) => setDeckH(e.nativeEvent.layout.height)}>
          {top ? (
            <>
              {next ? (
                <View style={[styles.card, styles.cardBehind, { width: cardW }]}>
                  <DeckCard c={next} />
                </View>
              ) : null}
              <Animated.View
                style={[
                  styles.card,
                  { width: cardW, transform: [...pan.getTranslateTransform(), { rotate }] },
                ]}
                onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
                onMoveShouldSetResponder={onMoveShouldSetResponder}
                onResponderGrant={onResponderGrant}
                onResponderMove={onResponderMove}
                onResponderRelease={onResponderRelease}
                onResponderTerminate={springBack}>
                <DeckCard c={top} position={position} />
                {/* 印章跟手浮现：右 = 心动（必成），左 = 略过 */}
                <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeStamp }]}>
                  <Text style={styles.stampText}>{t('心动')}</Text>
                </Animated.View>
                <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passStamp }]}>
                  <Text style={[styles.stampText, styles.stampPassText]}>{t('略过')}</Text>
                </Animated.View>
              </Animated.View>
            </>
          ) : (
            <View style={styles.emptyDeck}>
              <Text style={styles.emptyEmoji}>🫧</Text>
              <Text style={styles.emptyText}>{t('这里的人都被你聊完了。')}</Text>
              <Button
                label={t('去创造一个新的 TA')}
                size="sm"
                onPress={() => router.push('/apps/create')}
                style={styles.emptyBtn}
              />
            </View>
          )}
        </View>
      )}

      {view === 'swipe' && top ? (
        <View style={styles.footArea}>
          <View style={styles.btnRow}>
            <Pressable style={styles.passBtn} onPress={() => flyOut(-1)}>
              <MingCute name="close" size={22} color={Romance.sub} />
            </Pressable>
            <Pressable style={styles.heartBtn} onPress={() => flyOut(1)}>
              <MingCute name="heart" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
          {/* 按钮下方一行：平时是提示；刚略过时原位换成行内 toast（不遮卡、不遮按钮） */}
          <View style={styles.footSlot}>
            {passed ? (
              <View style={styles.passToast}>
                <Text style={styles.passToastText}>{t('已略过一位')}</Text>
                <Pressable onPress={undoPass} hitSlop={8}>
                  <Text style={styles.passToastUndo}>{t('撤销')}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.footHint}>{t('慢慢看，不急')}</Text>
            )}
          </View>
        </View>
      ) : null}

      {/* 偏好（D-049）：随时改口味，牌池直接按它筛 */}
      <Modal
        visible={prefOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrefOpen(false)}>
        <Pressable style={styles.prefMask} onPress={() => setPrefOpen(false)}>
          <Pressable
            style={[styles.prefSheetWrap, { paddingBottom: insets.bottom + Space.screen }]}
            onPress={() => {}}>
            <Card style={styles.prefSheet}>
              <Text style={styles.prefTitle}>{t('你想遇到谁？')}</Text>
              <View style={styles.chips}>
                {PREFS.map((p) => (
                  <Chip
                    key={p.key}
                    label={t(p.label)}
                    selected={(lovePref ?? 'any') === p.key}
                    onPress={() => {
                      useAppStore.getState().setLovePref(p.key);
                      setPrefOpen(false);
                    }}
                  />
                ))}
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 配对成功：纸面整页（paper + 菱格），不再压深色遮罩 */}
      {match ? (
        <View style={styles.matchOverlay}>
          <DiamondBackground />
          <Text style={styles.matchBig}>{t('配对成功')}</Text>
          <CharAvatar name={match.name} color={match.color} size={96} characterId={match.id} />
          <Text style={styles.matchCharName}>{match.name}</Text>
          <Text style={styles.matchSub}>{t('TA 也心动了')}</Text>
          <Button label={t('去打招呼')} onPress={() => sayHi(match)} style={styles.matchPrimary} />
          <Pressable style={styles.matchSecondary} onPress={() => setMatch(null)}>
            <Text style={styles.matchSecondaryText}>{t('继续滑')}</Text>
          </Pressable>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    skipIntro: { textAlign: 'center', fontSize: 12, color: Romance.sub, marginTop: 8 },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
    },
    // 口味 chip：白底 r6 8×12，accent 13/600「男生 ▾」
    prefChip: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    prefChipText: { fontSize: 13, fontWeight: '600', color: Romance.accentStrong },
    matchesWrap: { paddingTop: 12 },
    matchesTitle: {
      fontSize: Type.scale.eyebrow.size,
      fontWeight: '500',
      letterSpacing: Type.scale.eyebrow.letterSpacing,
      color: Romance.sub,
      paddingHorizontal: 16,
      marginBottom: 6,
    },
    matchesRow: { paddingHorizontal: 16, gap: 12 },
    matchItem: { alignItems: 'center', width: 58 },
    matchName: { fontSize: 12, color: Romance.ink, marginTop: 4, maxWidth: 58 },
    deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { position: 'absolute', aspectRatio: Space.matchCardRatio },
    cardBehind: {
      transform: [{ scale: Space.matchBehindScale }, { translateY: Space.matchBehindOffset }],
    },
    // 卡面：白卡描边 r6（Card），内部裁切
    deckCard: { flex: 1, overflow: 'hidden' },
    deckTop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    deckPortrait: { ...StyleSheet.absoluteFill },
    deckCircle: {
      width: INITIAL_CIRCLE,
      height: INITIAL_CIRCLE,
      borderRadius: INITIAL_CIRCLE / 2,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deckCircleCompact: {
      width: INITIAL_CIRCLE_COMPACT,
      height: INITIAL_CIRCLE_COMPACT,
      borderRadius: INITIAL_CIRCLE_COMPACT / 2,
    },
    // 宋体大首字 120（角色色，内联）
    deckInitial: { fontFamily: Fonts.initial, fontSize: 120, lineHeight: 132, fontWeight: '600' },
    deckInitialCompact: { fontSize: 56, lineHeight: 64 },
    deckPosition: {
      position: 'absolute',
      top: 14,
      left: 14,
      fontFamily: Fonts.labelBold,
      fontSize: 12,
      color: Romance.sub,
    },
    deckInfo: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 },
    deckInfoCompact: { paddingTop: Space.cardY, paddingHorizontal: Space.cardX, paddingBottom: Space.cardY },
    deckNameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    deckName: { fontSize: 28, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    deckNameCompact: { fontSize: 17, fontWeight: '600', color: Romance.ink },
    deckIdentity: { fontSize: 13, fontWeight: '500', color: Romance.sub, flex: 1, textAlign: 'right' },
    deckIdentityCompact: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    deckHook: { fontSize: 13, lineHeight: Math.round(13 * 1.45), color: Romance.ink, marginTop: 8 },
    heatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    heatNum: { fontFamily: Fonts.labelBold, fontSize: 12, color: Romance.accentStrong },
    heatText: { fontSize: 12, fontWeight: '600', color: Romance.accentStrong },
    tag: { fontSize: 11, color: Romance.sub, marginLeft: 8 },
    stamp: {
      position: 'absolute',
      top: 26,
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    stampLike: { left: 18, transform: [{ rotate: '-8deg' }] },
    stampPass: { right: 18, transform: [{ rotate: '8deg' }] },
    stampText: { fontSize: 20, fontWeight: '600', color: Romance.accentStrong },
    stampPassText: { color: Romance.sub },
    footArea: { alignItems: 'center', paddingBottom: 22, gap: 10 },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: Space.tileGapLoose },
    // 略过：54 白图块（无描边）；心动：66 primary + 描边
    passBtn: {
      width: 54,
      height: 54,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heartBtn: {
      width: 66,
      height: 66,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footSlot: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
    footHint: { fontSize: 12, color: Romance.sub },
    passToast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: Romance.ink,
      borderRadius: Shape.radius,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    passToastText: { fontSize: 12, fontWeight: '500', color: '#FFFFFF' },
    passToastUndo: { fontSize: 12, fontWeight: '600', color: Romance.bg },
    gridFeed: { paddingHorizontal: Space.screen, paddingTop: 12, paddingBottom: 24 },
    gridCols: { flexDirection: 'row', gap: 10 },
    gridCol: { flex: 1, gap: 10 },
    gridCard: { aspectRatio: Space.matchCardRatio },
    emptyDeck: { alignItems: 'center', gap: 10, paddingHorizontal: 40, paddingVertical: 24 },
    emptyEmoji: { fontSize: 44 },
    emptyText: { fontSize: 14, color: Romance.sub, textAlign: 'center' },
    emptyBtn: { marginTop: 6 },
    prefMask: { flex: 1, backgroundColor: withAlpha(Romance.ink, 0.45), justifyContent: 'flex-end' },
    prefSheetWrap: { paddingHorizontal: Space.screen },
    prefSheet: { paddingVertical: 16, paddingHorizontal: 16 },
    prefTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginBottom: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    matchOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 40,
    },
    matchBig: { fontSize: Type.scale.display.size, fontWeight: '600', color: Romance.ink, marginBottom: 10 },
    matchCharName: { fontSize: 20, fontWeight: '600', color: Romance.ink, marginTop: 4 },
    matchSub: { fontSize: 13, color: Romance.sub },
    matchPrimary: { marginTop: 18, paddingHorizontal: 40 },
    matchSecondary: { padding: 10 },
    matchSecondaryText: { fontSize: 13, color: Romance.sub },
  })
);

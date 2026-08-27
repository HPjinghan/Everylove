/**
 * 手机壳桌面（D-020/D-021/D-034/D-044）：主页 = 一部手机的桌面。
 * - 图标网格：长按进入编辑模式（抖动），**自由摆放**——整屏任意格位都能放、允许留空格，
 *   拖到已占格位则与对方交换；格位持久化（store.desktopSlots，旧 desktopOrder 作迁移源）
 * - 底部 Dock（D-044）：iPhone 式固定栏，最多 4 个 App、无标签、不随（未来的）翻页滑动；
 *   编辑模式下可在网格与 Dock 之间拖入拖出（占位则交换）；store.desktopDock 持久化
 * - 退出编辑时抖动角度归零（wiggle 回 0.5 = 0deg，transform 常挂避免 native 残留）
 * - 大时钟 + 大天气显示真实时间与世界天气；状态栏（时间/电量行）已按 D-023 去掉
 * - Message 快捷路径：有未读时桌面顶部出现横幅，点击直达会话（桌面制导航深度 +1 的补偿）
 * - 壁纸：设置 → 主题 里换
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MingCute } from '@/components/mingcute';
import { appById, DEFAULT_DESKTOP_ORDER, wallpaperById, type DesktopApp } from '@/constants/apps';
import { Fonts, Romance, themed } from '@/constants/theme';
import { tempNow, todayWeather } from '@/lib/weather';
import { useAppStore, useHydrated } from '@/store/app-store';

const COLS = 4;
const CELL_H = 104;
const PAD = 20;
/** Dock 栏高度（D-044）：图标无标签，竖直居中 */
const DOCK_H = 86;

function useClock(): string {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function DesktopIcon({
  app,
  unread,
  wiggle,
  showLabel = true,
}: {
  app: DesktopApp;
  unread: number;
  wiggle: Animated.Value;
  /** Dock 内不显示标签（iPhone 规矩，D-044） */
  showLabel?: boolean;
}) {
  // 0.5 = 0deg（静止）；transform 常挂——条件挂载在 native driver 下会把最后的角度留在原生节点上
  const rotate = wiggle.interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] });
  return (
    <Animated.View style={[styles.icon, { transform: [{ rotate }] }]}>
      <View style={[styles.iconTile, { backgroundColor: app.bg }]}>
        <MingCute name={app.icon} size={32} color={app.fg} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
      {showLabel ? (
        <Text style={styles.iconLabel} numberOfLines={1}>
          {app.label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

function WeatherCard() {
  const w = todayWeather();
  return (
    <View style={styles.weather}>
      <Text style={styles.weatherEmoji}>{w.emoji}</Text>
      <Text style={styles.weatherTemp}>{tempNow(w)}°</Text>
      <View style={styles.weatherInfo}>
        <Text style={styles.weatherLabel}>{w.label}</Text>
        <Text style={styles.weatherRange}>
          {w.hi}° / {w.lo}°
        </Text>
        <Text style={styles.weatherLine} numberOfLines={1}>
          {w.line}
        </Text>
      </View>
    </View>
  );
}

export default function Desktop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const storedOrder = useAppStore((s) => s.desktopOrder);
  const storedSlots = useAppStore((s) => s.desktopSlots);
  const storedDock = useAppStore((s) => s.desktopDock);
  const wallpaper = wallpaperById(useAppStore((s) => s.wallpaper));
  const bonds = useAppStore((s) => s.bonds);

  const clock = useClock();

  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [gridH, setGridH] = useState(0);
  const dragXY = useRef(new Animated.ValueXY()).current;
  const wiggle = useRef(new Animated.Value(0.5)).current;

  // Dock（D-044）：最多 4 个；不在注册表里的 id 直接丢弃
  const dock = useMemo(() => storedDock.filter((id) => appById(id)).slice(0, 4), [storedDock]);

  // 上架的 App（网格部分）：持久化顺序在前，注册表新增的自动补到末尾（升级兼容）；Dock 里的不进网格
  const ids = useMemo(() => {
    const known = storedOrder.filter((id) => appById(id));
    const missing = DEFAULT_DESKTOP_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing].filter((id) => !dock.includes(id));
  }, [storedOrder, dock]);

  const gridW = Dimensions.get('window').width - PAD * 2;
  const cellW = gridW / COLS;
  // Dock 占据容器底部（含底部安全区），网格只用它上方的区域
  const dockTop = Math.max(CELL_H, gridH - DOCK_H - insets.bottom - 8);
  const dockLeft = PAD + (gridW - dock.length * cellW) / 2;
  // 格位总数：铺满 Dock 之上的网格区域（整屏都能放），至少容纳全部图标
  const minRows = Math.ceil(ids.length / COLS);
  const rows = Math.max(minRows, gridH > 0 ? Math.floor((dockTop - 4) / CELL_H) : minRows);
  const slotCount = rows * COLS;

  // 归一化格位表（D-034）：持久化的合法格位优先；越界/重复/缺失的按顺序填进空格
  const slots = useMemo(() => {
    const out: Record<string, number> = {};
    const used = new Set<number>();
    for (const id of ids) {
      const s = storedSlots[id];
      if (typeof s === 'number' && s >= 0 && s < slotCount && !used.has(s)) {
        out[id] = s;
        used.add(s);
      }
    }
    let free = 0;
    for (const id of ids) {
      if (out[id] !== undefined) continue;
      while (used.has(free)) free += 1;
      out[id] = free;
      used.add(free);
    }
    return out;
  }, [ids, storedSlots, slotCount]);

  useEffect(() => {
    if (!editMode) return;
    wiggle.setValue(0.5);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 140, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      // 归位：0.5 = 0deg，否则会停在最后一帧的倾角
      wiggle.stopAnimation(() => wiggle.setValue(0.5));
    };
  }, [editMode, wiggle]);

  const unreadOf = (app: DesktopApp) =>
    app.badge === 'unread' ? bonds.reduce((n, b) => n + b.unread, 0) : 0;

  const topUnread = bonds.find((b) => b.unread > 0);

  const startDrag = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditMode(true);
    setDragId(id);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editMode && dragId !== null,
        onMoveShouldSetPanResponder: () => editMode && dragId !== null,
        onPanResponderMove: Animated.event([null, { dx: dragXY.x, dy: dragXY.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          if (dragId) {
            // 自由摆放（D-034）+ Dock 拖入拖出（D-044）：
            // 落点在网格 = 空格直接放、已占则交换；落点在 Dock 带 = 空位追加、占位交换、Dock 内重排
            const fromDockIdx = dock.indexOf(dragId);
            const fromGrid = fromDockIdx < 0;
            const fromSlot = fromGrid ? slots[dragId] : -1;
            const dockX0 = dockLeft - PAD; // 网格局部坐标系（x 从 PAD 起算）
            const originX = fromGrid
              ? (fromSlot % COLS) * cellW + cellW / 2
              : dockX0 + fromDockIdx * cellW + cellW / 2;
            const originY = fromGrid
              ? Math.floor(fromSlot / COLS) * CELL_H + CELL_H / 2
              : dockTop + DOCK_H / 2;
            const cx = originX + g.dx;
            const cy = originY + g.dy;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            if (cy > dockTop - 8) {
              // 落在 Dock 带
              const maxIdx = fromGrid ? Math.min(dock.length, 3) : dock.length - 1;
              const j = Math.min(maxIdx, Math.max(0, Math.floor((cx - dockX0) / cellW)));
              if (fromGrid) {
                const nextDock = [...dock];
                const nextSlots = { ...slots };
                delete nextSlots[dragId];
                if (j < nextDock.length) {
                  const occupant = nextDock[j];
                  nextDock[j] = dragId;
                  nextSlots[occupant] = fromSlot; // 被换下的回到拖来的格位
                } else {
                  nextDock.push(dragId);
                }
                useAppStore.getState().setDesktopSlots(nextSlots);
                useAppStore.getState().setDesktopDock(nextDock);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else if (j !== fromDockIdx) {
                const nextDock = dock.filter((d) => d !== dragId);
                nextDock.splice(Math.min(j, nextDock.length), 0, dragId);
                useAppStore.getState().setDesktopDock(nextDock);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } else {
              const col = Math.min(COLS - 1, Math.max(0, Math.floor(cx / cellW)));
              const row = Math.min(rows - 1, Math.max(0, Math.floor(cy / CELL_H)));
              const to = row * COLS + col;
              if (fromGrid) {
                if (to !== fromSlot) {
                  const occupant = ids.find((i) => slots[i] === to);
                  const next = { ...slots, [dragId]: to };
                  if (occupant) next[occupant] = fromSlot;
                  useAppStore.getState().setDesktopSlots(next);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              } else {
                // Dock → 网格：占位则对方顶进 Dock 原位置（对称交换）
                const occupant = ids.find((i) => slots[i] === to);
                const nextSlots = { ...slots, [dragId]: to };
                const nextDock = dock.filter((d) => d !== dragId);
                if (occupant) {
                  delete nextSlots[occupant];
                  nextDock.splice(Math.min(fromDockIdx, nextDock.length), 0, occupant);
                }
                useAppStore.getState().setDesktopSlots(nextSlots);
                useAppStore.getState().setDesktopDock(nextDock);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          }
          dragXY.setValue({ x: 0, y: 0 });
          setDragId(null);
        },
        onPanResponderTerminate: () => {
          dragXY.setValue({ x: 0, y: 0 });
          setDragId(null);
        },
      }),
    [editMode, dragId, ids, slots, rows, cellW, dragXY, dock, dockTop, dockLeft]
  );

  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <LinearGradient colors={wallpaper.colors} style={styles.screen}>
      <View style={{ paddingTop: insets.top + 6 }}>
        {/* Message 快捷路径：未读横幅直达会话 */}
        {topUnread && !editMode ? (
          <Pressable
            style={styles.notif}
            onPress={() =>
              router.push({ pathname: '/bond/[bondId]', params: { bondId: topUnread.id } })
            }>
            <View style={styles.notifIconWrap}>
              <MingCute name="chat" size={20} color="#4BBF87" />
            </View>
            <View style={styles.notifBody}>
              <Text style={styles.notifTitle}>{topUnread.name}</Text>
              <Text style={styles.notifText} numberOfLines={1}>
                {topUnread.unread} 条新消息 · 点开看看
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.clockBlock}>
          <Text style={styles.bigClock}>{clock}</Text>
          <Text style={styles.clockSub}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </View>

        {/* 世界天气（D-036）：按日期种子的确定性天气，大大地放在首页 */}
        <WeatherCard />
      </View>

      {/* 图标网格（D-034 自由摆放）：铺满余下整屏，图标按格位绝对定位，可留空格 */}
      <View
        style={styles.grid}
        onLayout={(e) => setGridH(e.nativeEvent.layout.height)}
        {...panResponder.panHandlers}>
        {ids.map((id) => {
          const app = appById(id)!;
          const dragging = dragId === id;
          const slot = slots[id];
          return (
            <Animated.View
              key={id}
              style={[
                {
                  position: 'absolute',
                  left: PAD + (slot % COLS) * cellW,
                  top: Math.floor(slot / COLS) * CELL_H,
                  width: cellW,
                  height: CELL_H,
                },
                dragging && {
                  transform: dragXY.getTranslateTransform(),
                  zIndex: 10,
                },
              ]}>
              <Pressable
                style={styles.cell}
                onPress={editMode ? undefined : () => router.push(app.route as never)}
                onLongPress={editMode ? undefined : () => startDrag(id)}
                delayLongPress={350}
                onPressIn={editMode ? () => setDragId(id) : undefined}>
                <DesktopIcon app={app} unread={unreadOf(app)} wiggle={wiggle} />
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Dock（D-044）：iPhone 式固定底栏——无标签、不随（未来的）翻页滑动 */}
        <View
          pointerEvents="none"
          style={[styles.dockBar, { top: dockTop - 8, height: DOCK_H + 16 }]}
        />
        {dock.map((id, i) => {
          const app = appById(id)!;
          const dragging = dragId === id;
          return (
            <Animated.View
              key={id}
              style={[
                {
                  position: 'absolute',
                  left: dockLeft + i * cellW,
                  top: dockTop,
                  width: cellW,
                  height: DOCK_H,
                },
                dragging && {
                  transform: dragXY.getTranslateTransform(),
                  zIndex: 10,
                },
              ]}>
              <Pressable
                style={styles.cell}
                onPress={editMode ? undefined : () => router.push(app.route as never)}
                onLongPress={editMode ? undefined : () => startDrag(id)}
                delayLongPress={350}
                onPressIn={editMode ? () => setDragId(id) : undefined}>
                <DesktopIcon app={app} unread={unreadOf(app)} wiggle={wiggle} showLabel={false} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {editMode ? (
        <Pressable
          style={[styles.doneBtn, { bottom: insets.bottom + DOCK_H + 32 }]}
          onPress={() => setEditMode(false)}>
          <Text style={styles.doneText}>完成</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1 },
    notif: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginTop: 10,
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: 26,
      padding: 12,
      gap: 10,
      shadowColor: '#3B2126',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    notifIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: '#D9F5E1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBody: { flex: 1 },
    notifTitle: { fontSize: 13, fontWeight: '700', color: Romance.ink },
    notifText: { fontSize: 12, color: Romance.sub, marginTop: 1 },
    clockBlock: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
    weather: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 12,
      backgroundColor: 'rgba(255,255,255,0.55)',
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingVertical: 14,
      marginBottom: 6,
    },
    weatherEmoji: { fontSize: 44 },
    weatherTemp: {
      fontSize: 46,
      fontWeight: '300',
      color: Romance.ink,
      fontFamily: Fonts?.rounded,
    },
    weatherInfo: { marginLeft: 2 },
    weatherLabel: { fontSize: 15, fontWeight: '700', color: Romance.ink },
    weatherRange: { fontSize: 12, color: Romance.sub, marginTop: 1 },
    weatherLine: { fontSize: 11, color: Romance.faint, marginTop: 2, maxWidth: 150 },
    bigClock: {
      fontSize: 56,
      fontWeight: '300',
      color: Romance.ink,
      letterSpacing: 2,
      fontFamily: Fonts?.rounded,
    },
    clockSub: { fontSize: 13, color: Romance.sub, marginTop: 2 },
    grid: { flex: 1, marginTop: 8 },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    dockBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    icon: { alignItems: 'center', width: 76 },
    iconTile: {
      width: 62,
      height: 62,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: 'rgba(255,255,255,0.8)',
      shadowColor: '#E8899F',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    iconLabel: {
      fontSize: 12,
      color: Romance.ink,
      marginTop: 6,
      fontWeight: '600',
      fontFamily: Fonts?.rounded,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    doneBtn: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: Romance.ink,
      borderRadius: 26,
      paddingHorizontal: 28,
      paddingVertical: 12,
    },
    doneText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  })
);

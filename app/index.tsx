/**
 * 手机壳桌面（D-020/D-021）：主页 = 一部手机的桌面。
 * - 图标网格：长按进入编辑模式（抖动），拖动换位，顺序持久化（store.desktopOrder）
 * - 大时钟显示真实时间；状态栏（时间/电量行）已按 D-023 去掉
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

import { appById, DEFAULT_DESKTOP_ORDER, wallpaperById, type DesktopApp } from '@/constants/apps';
import { Fonts, Romance } from '@/constants/theme';
import { useAppStore, useHydrated } from '@/store/app-store';

const COLS = 4;
const CELL_H = 104;
const PAD = 20;

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
  editMode,
  wiggle,
}: {
  app: DesktopApp;
  unread: number;
  editMode: boolean;
  wiggle: Animated.Value;
}) {
  const rotate = wiggle.interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] });
  return (
    <Animated.View style={[styles.icon, editMode && { transform: [{ rotate }] }]}>
      <View style={[styles.iconTile, { backgroundColor: app.tint }]}>
        <Text style={styles.iconGlyph}>{app.glyph}</Text>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.iconLabel} numberOfLines={1}>
        {app.label}
      </Text>
    </Animated.View>
  );
}

export default function Desktop() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const storedOrder = useAppStore((s) => s.desktopOrder);
  const wallpaper = wallpaperById(useAppStore((s) => s.wallpaper));
  const bonds = useAppStore((s) => s.bonds);

  const clock = useClock();

  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragXY = useRef(new Animated.ValueXY()).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  // 顺序：持久化的在前，注册表新增的 App 自动补到末尾（升级兼容）
  const order = useMemo(() => {
    const known = storedOrder.filter((id) => appById(id));
    const missing = DEFAULT_DESKTOP_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing];
  }, [storedOrder]);

  useEffect(() => {
    if (!editMode) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 140, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [editMode, wiggle]);

  const gridW = Dimensions.get('window').width - PAD * 2;
  const cellW = gridW / COLS;

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
            const from = order.indexOf(dragId);
            const cx = (from % COLS) * cellW + cellW / 2 + g.dx;
            const cy = Math.floor(from / COLS) * CELL_H + CELL_H / 2 + g.dy;
            const col = Math.min(COLS - 1, Math.max(0, Math.floor(cx / cellW)));
            const row = Math.max(0, Math.floor(cy / CELL_H));
            const to = Math.min(order.length - 1, row * COLS + col);
            if (to !== from) {
              const next = [...order];
              next.splice(to, 0, ...next.splice(from, 1));
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              useAppStore.getState().setDesktopOrder(next);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    [editMode, dragId, order, cellW, dragXY]
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
            <Text style={styles.notifIcon}>💬</Text>
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
      </View>

      {/* 图标网格 */}
      <View style={[styles.grid, { paddingHorizontal: PAD }]} {...panResponder.panHandlers}>
        {order.map((id) => {
          const app = appById(id)!;
          const dragging = dragId === id;
          return (
            <Animated.View
              key={id}
              style={[
                { width: cellW, height: CELL_H },
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
                <DesktopIcon app={app} unread={unreadOf(app)} editMode={editMode} wiggle={wiggle} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {editMode ? (
        <Pressable style={[styles.doneBtn, { bottom: insets.bottom + 24 }]} onPress={() => setEditMode(false)}>
          <Text style={styles.doneText}>完成</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
  notifIcon: { fontSize: 22 },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: Romance.ink },
  notifText: { fontSize: 12, color: Romance.sub, marginTop: 1 },
  clockBlock: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
  bigClock: {
    fontSize: 56,
    fontWeight: '300',
    color: Romance.ink,
    letterSpacing: 2,
    fontFamily: Fonts?.rounded,
  },
  clockSub: { fontSize: 13, color: Romance.sub, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  iconGlyph: { fontSize: 32 },
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
});

/**
 * 手机壳桌面（D-020/D-021/D-034/D-044；D-100 纸面 + 翻页）：主页 = 一部手机的桌面。
 * - 底：纸面壁纸 = Romance.bg + 菱格暗纹（DiamondBackground）；其余壁纸上下两段纯色平铺，不再画渐变
 * - 图标网格：4 列、行高 Space.desktopRow，图块 60 白底无描边、MingCute 30 ink；长按进入编辑模式（抖动），
 *   **自由摆放**（D-034）——任意格位、允许留空格，拖到已占格位则交换；格位持久化（store.desktopSlots）
 * - **翻页**（D-100）：网格区水平分页，每页 rows × 4 格，slot 索引跨页连续（page = floor(slot / slotsPerPage)）；
 *   页码点在 Dock 上方，≥2 页才显示；编辑模式下多给一页空页，拖到屏幕左右边缘停留 600ms 自动翻页。
 *   时钟 / 天气 / 横幅 / Dock 不随页滑动。
 * - 底部 Dock（D-044）：白卡描边、图块 paper 底、无标签；编辑模式下可在网格与 Dock 之间拖入拖出（占位则交换）
 * - 拖拽中的图标画在网格容器的浮层里（不在分页 ScrollView 内），翻页时它不会跟着页滑走
 * - 退出编辑时抖动角度归零（wiggle 回 0.5 = 0deg，transform 常挂避免 native 残留）
 * - 大时钟 + 大天气显示真实时间与世界天气；状态栏已按 D-023 去掉
 * - Message 快捷路径：有未读时桌面顶部出现横幅——一人未读直达会话，多人未读合并后进 Message 列表
 * - 壁纸：设置 → 主题 里换
 */

import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useAnimatedValue,
  useAnimatedValueXY,
  useWindowDimensions,
  View,
  type GestureResponderHandlers,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderCallbacks,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { MingCute } from '@/components/mingcute';
import { DiamondBackground } from '@/components/paper-bg';
import { appById, DEFAULT_DESKTOP_ORDER, wallpaperById, type DesktopApp } from '@/constants/apps';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tempNow, todayWeather, weatherCity } from '@/lib/weather';
import { useAppStore, useHydrated } from '@/store/app-store';

const COLS = Space.desktopCols;
const CELL_H = Space.desktopRow;
const TILE = Space.appTile;
/** 网格左右留白（设计稿 20） */
const PAD = 20;
/** Dock 卡片左右留白（设计稿 12） */
const DOCK_INSET = 12;
const DOCK_H = Space.dockHeight;
/** Dock 内图块步距：图块 60 + 间距 26 */
const DOCK_STEP = TILE + Space.tileGapLoose;
/** 页数上限：只是防越界的护栏（陈旧格位不至于撑出几十页） */
const MAX_PAGES = 6;
/** 编辑模式拖到屏幕边缘多宽算「边缘」、停留多久翻页 */
const EDGE_W = 28;
const EDGE_FLIP_MS = 600;

/** 时钟副行是拉丁标签，不随界面语言变 */
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    date: `${WEEKDAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 网格容器的手势：配置在渲染期只是一份数据，PanResponder 实例到第一次触摸才建（配置换了就换新）。
 * 回调全在事件里跑，React Compiler 才能证明渲染期没读 ref；PanResponder.create 没有副作用，
 * 内部手势状态每次新触摸都在 onStartShouldSetResponderCapture 里重置，所以晚建与渲染期建等价。
 */
function useLazyPanHandlers(config: PanResponderCallbacks): GestureResponderHandlers {
  const cache = useRef<{
    config: PanResponderCallbacks;
    handlers: Required<GestureResponderHandlers>;
  } | null>(null);
  const resolve = () => {
    const hit = cache.current;
    if (hit && hit.config === config) return hit.handlers;
    const handlers = PanResponder.create(config).panHandlers as Required<GestureResponderHandlers>;
    cache.current = { config, handlers };
    return handlers;
  };
  return {
    onStartShouldSetResponder: (e) => resolve().onStartShouldSetResponder(e),
    onMoveShouldSetResponder: (e) => resolve().onMoveShouldSetResponder(e),
    onStartShouldSetResponderCapture: (e) => resolve().onStartShouldSetResponderCapture(e),
    onMoveShouldSetResponderCapture: (e) => resolve().onMoveShouldSetResponderCapture(e),
    onResponderGrant: (e) => resolve().onResponderGrant(e),
    onResponderReject: (e) => resolve().onResponderReject(e),
    onResponderRelease: (e) => resolve().onResponderRelease(e),
    onResponderStart: (e) => resolve().onResponderStart(e),
    onResponderMove: (e) => resolve().onResponderMove(e),
    onResponderEnd: (e) => resolve().onResponderEnd(e),
    onResponderTerminate: (e) => resolve().onResponderTerminate(e),
    onResponderTerminationRequest: (e) => resolve().onResponderTerminationRequest(e),
  };
}

function DesktopIcon({
  app,
  unread,
  wiggle,
  dock = false,
}: {
  app: DesktopApp;
  unread: number;
  wiggle: Animated.Value;
  /** Dock 内：图块 paper 底、不显示标签（iPhone 规矩，D-044） */
  dock?: boolean;
}) {
  // 0.5 = 0deg（静止）；transform 常挂——条件挂载在 native driver 下会把最后的角度留在原生节点上
  const rotate = wiggle.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2.2deg', '2.2deg'],
  });
  return (
    <Animated.View style={[dock ? styles.iconDock : styles.icon, { transform: [{ rotate }] }]}>
      <View style={[styles.iconTile, dock && styles.dockTile]}>
        <MingCute name={app.icon} size={Space.iconTile} color={Romance.ink} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
      {dock ? null : (
        <Text style={styles.iconLabel} numberOfLines={1}>
          {t(app.label)}
        </Text>
      )}
    </Animated.View>
  );
}

function WeatherCard() {
  const router = useRouter();
  const w = todayWeather();
  const city = weatherCity();
  return (
    <Pressable style={styles.weatherWrap} onPress={() => router.push('/weather')}>
      <Card padded={false} style={styles.weather}>
        <Text style={styles.weatherEmoji}>{w.emoji}</Text>
        <Text style={styles.weatherTemp}>{tempNow(w)}°</Text>
        <View style={styles.weatherInfo}>
          <Text style={styles.weatherLabel}>{t(w.label)}</Text>
          <Text style={styles.weatherRange}>
            {w.hi}° / {w.lo}°
          </Text>
          <Text style={styles.weatherLine} numberOfLines={1}>
            {city ? city : t(w.line)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

/** 拖拽中的图标：起点矩形（网格容器坐标系）+ 中心点，落点 = 中心点 + 手势位移 */
interface DragState {
  id: string;
  kind: 'grid' | 'dock';
  /** 网格：出发格位（跨页连续）；Dock：出发下标 */
  from: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export default function Desktop() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const introDone = useAppStore((s) => s.introDone);
  const introRevealSeen = useAppStore((s) => s.introRevealSeen);
  const storedOrder = useAppStore((s) => s.desktopOrder);
  const storedSlots = useAppStore((s) => s.desktopSlots);
  const storedDock = useAppStore((s) => s.desktopDock);
  const wallpaper = wallpaperById(useAppStore((s) => s.wallpaper));
  const bonds = useAppStore((s) => s.bonds);

  const clock = useClock();

  const [editMode, setEditMode] = useState(false);
  /** 拖拽中的图标：state 给渲染用（浮层 / 隐藏原位 / 锁翻页）；dragRef 是同一份，给 PanResponder 回调读 */
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragId = dragging ? dragging.id : null;
  const [page, setPage] = useState(0);
  const [gridH, setGridH] = useState(0);
  const dragXY = useAnimatedValueXY({ x: 0, y: 0 });
  const wiggle = useAnimatedValue(0.5);
  const scrollRef = useRef<ScrollView>(null);
  const dragRef = useRef<DragState | null>(null);
  /** 网格容器已接管这次触摸（区分「按下就松开」与真正的拖动） */
  const grantedRef = useRef(false);
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeDir = useRef(0);

  // Dock（D-044）：最多 4 个；不在注册表里的 id 直接丢弃
  const dock = useMemo(() => storedDock.filter((id) => appById(id)).slice(0, 4), [storedDock]);

  // 上架的 App（网格部分）：持久化顺序在前，注册表新增的自动补到末尾（升级兼容）；Dock 里的不进网格
  const ids = useMemo(() => {
    const known = storedOrder.filter((id) => appById(id));
    const missing = DEFAULT_DESKTOP_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing].filter((id) => !dock.includes(id));
  }, [storedOrder, dock]);

  const cellW = (screenW - PAD * 2) / COLS;
  // Dock 卡片贴在容器底部：设计稿距底 26 是从手机边缘量的，有 home indicator 的机型取安全区 + 8，避免整体抬得太高；页码点在它上方；网格只用页码点之上的区域
  const dockBottom = Math.max(Space.dockBottom, insets.bottom + 8);
  const dockTop = gridH - dockBottom - DOCK_H;
  const dotsBand = Space.pageDotGap * 2 + Space.pageDot;
  const rows = gridH > 0 ? Math.max(1, Math.floor((dockTop - dotsBand) / CELL_H)) : 3;
  const slotsPerPage = rows * COLS;
  const dockWidth = dock.length > 0 ? dock.length * TILE + (dock.length - 1) * Space.tileGapLoose : 0;
  const dockLeft = (screenW - dockWidth) / 2;

  // 归一化格位表（D-034）：持久化的合法格位优先（跨页连续，只挡越过页数上限的）；越界 / 重复 / 缺失的按顺序填进空格
  const slots = useMemo(() => {
    const out: Record<string, number> = {};
    const used = new Set<number>();
    const cap = slotsPerPage * MAX_PAGES;
    for (const id of ids) {
      const s = storedSlots[id];
      if (typeof s === 'number' && Number.isInteger(s) && s >= 0 && s < cap && !used.has(s)) {
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
  }, [ids, storedSlots, slotsPerPage]);

  // 页数：装下最远的格位；编辑模式多给一页空页，好把图标拖到下一页
  const maxSlot = ids.reduce((m, id) => Math.max(m, slots[id]), -1);
  const realPages = Math.max(1, Math.ceil((maxSlot + 1) / slotsPerPage));
  const pageCount = Math.min(MAX_PAGES, editMode ? realPages + 1 : realPages);

  // 渲染期之外（PanResponder、翻页计时器）要读的最新布局与数据：每次提交后同步，回调都在提交之后才跑
  const live = useRef({
    ids,
    slots,
    dock,
    rows,
    cellW,
    screenW,
    page,
    pageCount,
    slotsPerPage,
    dockTop,
    dockLeft,
    editMode,
  });
  useLayoutEffect(() => {
    live.current = {
      ids,
      slots,
      dock,
      rows,
      cellW,
      screenW,
      page,
      pageCount,
      slotsPerPage,
      dockTop,
      dockLeft,
      editMode,
    };
  });

  const goToPage = useCallback((p: number, animated = true) => {
    const next = clamp(p, 0, live.current.pageCount - 1);
    scrollRef.current?.scrollTo({
      x: next * live.current.screenW,
      y: 0,
      animated,
    });
    setPage(next);
  }, []);

  // 页数缩水（退出编辑、把最后一页搬空）时退回最后一页
  useEffect(() => {
    if (page > pageCount - 1) goToPage(pageCount - 1);
  }, [page, pageCount, goToPage]);

  useEffect(() => {
    if (!editMode) return;
    wiggle.setValue(0.5);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      // 归位：0.5 = 0deg，否则会停在最后一帧的倾角
      wiggle.stopAnimation(() => wiggle.setValue(0.5));
    };
  }, [editMode, wiggle]);

  useEffect(
    () => () => {
      if (edgeTimer.current) clearTimeout(edgeTimer.current);
    },
    []
  );

  const unreadOf = (app: DesktopApp) =>
    app.badge === 'unread' ? bonds.reduce((n, b) => n + b.unread, 0) : 0;

  // 未读横幅：一人未读直达会话；多人合并「A、B · N 条新消息」进 Message 列表
  const unreadBonds = bonds.filter((b) => b.unread > 0);
  const unreadTotal = unreadBonds.reduce((n, b) => n + b.unread, 0);

  const clearEdgeTimer = () => {
    if (edgeTimer.current) clearTimeout(edgeTimer.current);
    edgeTimer.current = null;
    edgeDir.current = 0;
  };

  const endDrag = useCallback(() => {
    clearEdgeTimer();
    grantedRef.current = false;
    dragRef.current = null;
    dragXY.setValue({ x: 0, y: 0 });
    setDragging(null);
  }, [dragXY]);

  /** 记下出发矩形（网格容器坐标系），拖拽中的图标画在浮层里 */
  const beginDrag = (id: string, haptic: boolean) => {
    const L = live.current;
    const i = L.dock.indexOf(id);
    let next: DragState;
    if (i >= 0) {
      const x = L.dockLeft + i * DOCK_STEP;
      const y = L.dockTop + (DOCK_H - TILE) / 2;
      next = {
        id,
        kind: 'dock',
        from: i,
        x,
        y,
        w: TILE,
        h: TILE,
        cx: x + TILE / 2,
        cy: y + TILE / 2,
      };
    } else {
      const slot = L.slots[id];
      const iconPage = Math.floor(slot / L.slotsPerPage);
      const local = slot % L.slotsPerPage;
      const x = PAD + (local % COLS) * L.cellW + (iconPage - L.page) * L.screenW;
      const y = Math.floor(local / COLS) * CELL_H;
      next = {
        id,
        kind: 'grid',
        from: slot,
        x,
        y,
        w: L.cellW,
        h: CELL_H,
        cx: x + L.cellW / 2,
        cy: y + CELL_H / 2,
      };
    }
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dragRef.current = next;
    grantedRef.current = false;
    setEditMode(true);
    setDragging(next);
  };

  /** 按下就松开（没拖动）：网格容器没接管，清掉待拖状态，别锁住翻页 */
  const settlePress = (id: string) => {
    setTimeout(() => {
      if (dragRef.current?.id === id && !grantedRef.current) endDrag();
    }, 0);
  };

  const panConfig = useMemo<PanResponderCallbacks>(() => {
    const follow = Animated.event([null, { dx: dragXY.x, dy: dragXY.y }], {
      useNativeDriver: false,
    });
    return {
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => live.current.editMode && dragRef.current !== null,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        grantedRef.current = true;
      },
      onPanResponderMove: (e, g) => {
        follow(e, g);
        const d = dragRef.current;
        if (!d) return;
        // 编辑模式：拖到屏幕左右边缘停留 600ms 自动翻页；离开边缘就作废
        const L = live.current;
        const x = d.cx + g.dx;
        let dir = 0;
        if (x < EDGE_W && L.page > 0) dir = -1;
        else if (x > L.screenW - EDGE_W && L.page < L.pageCount - 1) dir = 1;
        if (dir !== edgeDir.current) {
          if (edgeTimer.current) clearTimeout(edgeTimer.current);
          edgeTimer.current = null;
          edgeDir.current = dir;
          if (dir !== 0) {
            edgeTimer.current = setTimeout(() => {
              edgeTimer.current = null;
              edgeDir.current = 0;
              Haptics.selectionAsync();
              goToPage(live.current.page + dir);
            }, EDGE_FLIP_MS);
          }
        }
      },
      onPanResponderRelease: (_e, g) => {
        const d = dragRef.current;
        if (d) {
          // 自由摆放（D-034）+ Dock 拖入拖出（D-044）+ 翻页（D-100）：
          // 落点在网格 = 当前页的格位，空格直接放、已占则交换；落点在 Dock 带 = 空位追加、占位交换、Dock 内重排
          const L = live.current;
          const store = useAppStore.getState();
          const cx = d.cx + g.dx;
          const cy = d.cy + g.dy;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (cy > L.dockTop - 8) {
            const maxIdx = d.kind === 'grid' ? Math.min(L.dock.length, 3) : L.dock.length - 1;
            const j = clamp(Math.floor((cx - L.dockLeft) / DOCK_STEP), 0, maxIdx);
            if (d.kind === 'grid') {
              const nextDock = [...L.dock];
              const nextSlots = { ...L.slots };
              delete nextSlots[d.id];
              if (j < nextDock.length) {
                const occupant = nextDock[j];
                nextDock[j] = d.id;
                nextSlots[occupant] = d.from; // 被换下的回到拖来的格位
              } else {
                nextDock.push(d.id);
              }
              store.setDesktopSlots(nextSlots);
              store.setDesktopDock(nextDock);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else if (j !== d.from) {
              const nextDock = L.dock.filter((x) => x !== d.id);
              nextDock.splice(Math.min(j, nextDock.length), 0, d.id);
              store.setDesktopDock(nextDock);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          } else {
            const col = clamp(Math.floor((cx - PAD) / L.cellW), 0, COLS - 1);
            const row = clamp(Math.floor(cy / CELL_H), 0, L.rows - 1);
            const to = L.page * L.slotsPerPage + row * COLS + col;
            const occupant = L.ids.find((i) => L.slots[i] === to);
            if (d.kind === 'grid') {
              if (to !== d.from) {
                const next = { ...L.slots, [d.id]: to };
                if (occupant) next[occupant] = d.from;
                store.setDesktopSlots(next);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } else {
              // Dock → 网格：占位则对方顶进 Dock 原位置（对称交换）
              const nextSlots = { ...L.slots, [d.id]: to };
              const nextDock = L.dock.filter((x) => x !== d.id);
              if (occupant) {
                delete nextSlots[occupant];
                nextDock.splice(Math.min(d.from, nextDock.length), 0, occupant);
              }
              store.setDesktopSlots(nextSlots);
              store.setDesktopDock(nextDock);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        }
        endDrag();
      },
      onPanResponderTerminate: () => endDrag(),
    };
  }, [dragXY, endDrag, goToPage]);
  const panHandlers = useLazyPanHandlers(panConfig);

  const onPageSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = clamp(Math.round(e.nativeEvent.contentOffset.x / screenW), 0, pageCount - 1);
    if (p !== page) setPage(p);
  };

  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  // 新手流（D-058）：桌面是奖励——先去交友滑卡，首次加好友（或点「先逛逛」）后放行
  if (!introDone) return <Redirect href="/apps/dating" />;

  const dragApp = dragging ? appById(dragging.id) : undefined;
  const pagesH = rows * CELL_H;

  const iconPress = (id: string, route: string) => ({
    onPress: editMode ? undefined : () => router.push(route as never),
    onLongPress: editMode ? undefined : () => beginDrag(id, true),
    delayLongPress: 350,
    onPressIn: editMode ? () => beginDrag(id, false) : undefined,
    onPressOut: () => settlePress(id),
  });

  return (
    <View style={styles.screen}>
      {wallpaper.pattern ? (
        <DiamondBackground />
      ) : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.wallHalf, { backgroundColor: wallpaper.colors[0] }]} />
          <View style={[styles.wallHalf, { backgroundColor: wallpaper.colors[1] }]} />
        </View>
      )}

      <View style={{ paddingTop: insets.top }}>
        {/* Message 快捷路径：未读横幅——一人直达会话，多人合并进 Message */}
        {unreadBonds.length > 0 && !editMode ? (
          <Pressable
            onPress={() =>
              unreadBonds.length === 1
                ? router.push({
                    pathname: '/bond/[bondId]',
                    params: { bondId: unreadBonds[0].id },
                  })
                : router.push('/apps/messages')
            }>
            <Card style={styles.notif}>
              <View style={styles.notifIconWrap}>
                <MingCute name="chat" size={20} color={Romance.ink} />
              </View>
              <View style={styles.notifBody}>
                <Text style={styles.notifTitle} numberOfLines={1}>
                  {unreadBonds.map((b) => b.name).join(t('、'))}
                </Text>
                <Text style={styles.notifText} numberOfLines={1}>
                  {t('{n} 条新消息 · 点开看看', { n: unreadTotal })}
                </Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        <View style={styles.clockBlock}>
          <Text style={styles.bigClock}>{clock.time}</Text>
          <Text style={styles.clockSub}>{clock.date}</Text>
        </View>

        {/* 世界天气（D-036）：大大地放在首页 */}
        <WeatherCard />
      </View>

      {/* 图标网格（D-034 自由摆放 + D-100 翻页）：按格位绝对定位，可留空格；Dock / 页码点 / 拖拽浮层不随页滑 */}
      <View
        style={styles.grid}
        onLayout={(e) => setGridH(e.nativeEvent.layout.height)}
        {...panHandlers}>
        {gridH > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={dragId === null}
            onMomentumScrollEnd={onPageSettle}
            style={[styles.pager, { height: pagesH }]}>
            {Array.from({ length: pageCount }, (_, p) => (
              <View key={p} style={{ width: screenW, height: pagesH }}>
                {ids
                  .filter((id) => Math.floor(slots[id] / slotsPerPage) === p)
                  .map((id) => {
                    const app = appById(id)!;
                    const local = slots[id] % slotsPerPage;
                    return (
                      <View
                        key={id}
                        style={{
                          position: 'absolute',
                          left: PAD + (local % COLS) * cellW,
                          top: Math.floor(local / COLS) * CELL_H,
                          width: cellW,
                          height: CELL_H,
                          opacity: dragId === id ? 0 : 1,
                        }}>
                        <Pressable style={styles.cell} {...iconPress(id, app.route)}>
                          <DesktopIcon app={app} unread={unreadOf(app)} wiggle={wiggle} />
                        </Pressable>
                      </View>
                    );
                  })}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* 页码点：Dock 上方，≥2 页才显示 */}
        {pageCount > 1 ? (
          <View
            pointerEvents="none"
            style={[styles.dots, { bottom: dockBottom + DOCK_H + Space.pageDotGap }]}>
            {Array.from({ length: pageCount }, (_, p) => (
              <View key={p} style={[styles.dot, p !== page && styles.dotOff]} />
            ))}
          </View>
        ) : null}

        {/* Dock（D-044）：白卡描边、图块 paper 底、无标签、不随页滑动 */}
        <Card padded={false} style={[styles.dock, { bottom: dockBottom }]}>
          {dock.map((id) => {
            const app = appById(id)!;
            return (
              <Pressable key={id} style={{ opacity: dragId === id ? 0 : 1 }} {...iconPress(id, app.route)}>
                <DesktopIcon app={app} unread={unreadOf(app)} wiggle={wiggle} dock />
              </Pressable>
            );
          })}
        </Card>

        {/* 拖拽浮层：跟手的那一个画在分页之外，翻页时留在原地 */}
        {dragging && dragApp ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                left: dragging.x,
                top: dragging.y,
                width: dragging.w,
                height: dragging.h,
                transform: dragXY.getTranslateTransform(),
              },
            ]}>
            <DesktopIcon
              app={dragApp}
              unread={unreadOf(dragApp)}
              wiggle={wiggle}
              dock={dragging.kind === 'dock'}
            />
          </Animated.View>
        ) : null}
      </View>

      {editMode ? (
        <Button
          variant="secondary"
          size="sm"
          label={t('完成')}
          onPress={() => setEditMode(false)}
          style={[styles.doneBtn, { top: insets.top + 8 }]}
        />
      ) : null}

      {/* 桌面揭幕 + 气泡标注（D-058 方案 B）：首次加好友后播一次 */}
      {introDone && !introRevealSeen && bonds.length > 0 ? <IntroReveal /> : null}
    </View>
  );
}

/** 揭幕序列：一屏仪式文案 → 三张模块卡（Message / 创造 / 外出）→ 收尾放行 */
const INTRO_CARDS: { icon: DesktopApp['icon']; title: string; line: string }[] = [
  { icon: 'chat', title: 'TA 住进了 Message', line: 'TA 的第一句话在等你。' },
  { icon: 'magicHat', title: '创造', line: '捏一个只属于你的 TA。' },
  { icon: 'location', title: '外出', line: '把相处从手机屏幕里拿出来。' },
];

function IntroReveal() {
  const [step, setStep] = useState<'reveal' | number>('reveal');
  const finish = () => useAppStore.getState().setIntroRevealSeen();
  const card = typeof step === 'number' ? INTRO_CARDS[step] : null;
  return (
    <View style={styles.introMask}>
      <View pointerEvents="none" style={styles.introScrim} />
      {step === 'reveal' ? (
        <View style={styles.introCenter}>
          <Text style={styles.introBig}>
            {t('这部手机，')}
            {'\n'}
            {t('现在是你们的了')}
          </Text>
          <Button label={t('看看里面有什么')} onPress={() => setStep(0)} style={styles.introBtn} />
        </View>
      ) : card ? (
        <View style={styles.introCenter}>
          <View style={styles.introTile}>
            <MingCute name={card.icon} size={38} color={Romance.ink} />
          </View>
          <Text style={styles.introTitle}>{t(card.title)}</Text>
          <Text style={styles.introLine}>{t(card.line)}</Text>
          <Button
            label={step + 1 < INTRO_CARDS.length ? t('下一个') : t('开始吧')}
            onPress={() => (step + 1 < INTRO_CARDS.length ? setStep(step + 1) : finish())}
            style={styles.introBtn}
          />
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={styles.introSkip}>{t('跳过')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    wallHalf: { flex: 1 },
    // 未读横幅：白卡描边，38 paper 图块 + chat 图标
    notif: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Space.screen,
      marginTop: Space.screen,
      gap: Space.inlineLoose,
    },
    notifIconWrap: {
      width: 38,
      height: 38,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBody: { flex: 1 },
    notifTitle: {
      fontSize: Type.scale.cardTitle.size,
      fontWeight: '600',
      color: Romance.ink,
    },
    notifText: {
      fontSize: Type.scale.caption.size,
      color: Romance.sub,
      marginTop: 1,
    },
    // 大时钟：Fredoka 600 84 / 0.9、字距 -2；副行拉丁标签 Fredoka 500 13、字距 1
    clockBlock: { alignItems: 'center', marginTop: 18, marginBottom: 10 },
    bigClock: {
      fontFamily: Fonts.labelBold,
      fontSize: Type.scale.clock.size,
      lineHeight: Math.round(Type.scale.clock.size * Type.scale.clock.lineHeight),
      letterSpacing: Type.scale.clock.letterSpacing,
      color: Romance.ink,
    },
    clockSub: {
      fontFamily: Fonts.label,
      fontSize: Type.scale.label.size,
      color: Romance.sub,
      letterSpacing: 1,
      marginTop: 8,
    },
    // 天气卡：白卡描边居中
    weatherWrap: { alignSelf: 'center' },
    weather: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.screen,
      paddingVertical: 8,
      paddingHorizontal: 18,
    },
    weatherEmoji: { fontSize: 38 },
    weatherTemp: {
      fontFamily: Fonts.labelBold,
      fontSize: 44,
      color: Romance.ink,
    },
    weatherInfo: {},
    weatherLabel: {
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      fontWeight: '600',
      color: Romance.ink,
    },
    weatherRange: {
      fontFamily: Fonts.label,
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      color: Romance.sub,
    },
    weatherLine: {
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      color: Romance.sub,
      maxWidth: 150,
    },
    grid: { flex: 1, marginTop: 10 },
    pager: { position: 'absolute', left: 0, right: 0, top: 0 },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    ghost: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    // 页码点：当前页 ink、其余 ink 30%
    dots: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Space.pageDot,
    },
    dot: {
      width: Space.pageDot,
      height: Space.pageDot,
      borderRadius: Space.pageDot / 2,
      backgroundColor: Romance.ink,
    },
    dotOff: { opacity: 0.3 },
    // Dock：白卡描边、高 102；内图块 paper 底、间距 26
    dock: {
      position: 'absolute',
      left: DOCK_INSET,
      right: DOCK_INSET,
      height: DOCK_H,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Space.tileGapLoose,
    },
    icon: { alignItems: 'center', width: 76 },
    iconDock: { alignItems: 'center', width: TILE },
    // 图块：60 白底 r6、无描边无阴影
    iconTile: {
      width: TILE,
      height: TILE,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dockTile: { backgroundColor: Romance.bg },
    iconLabel: {
      fontSize: Type.scale.caption.size,
      fontWeight: '500',
      color: Romance.ink,
      marginTop: 6,
    },
    // 未读角标：primary r6、Fredoka 600 12 白字，图块右上
    badge: {
      position: 'absolute',
      top: -8,
      right: -8,
      minWidth: 22,
      height: 22,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    badgeText: {
      fontFamily: Fonts.labelBold,
      fontSize: Type.scale.caption.size,
      color: '#FFFFFF',
    },
    doneBtn: { position: 'absolute', right: Space.screen, zIndex: 15 },
    // 揭幕遮罩：ink 82%
    introMask: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },
    introScrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: Romance.ink,
      opacity: 0.82,
    },
    introCenter: { alignItems: 'center', paddingHorizontal: 40, gap: 4 },
    introBig: {
      fontSize: Type.scale.display.size,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 42,
    },
    introTile: {
      width: 76,
      height: 76,
      borderRadius: Shape.radius,
      backgroundColor: Romance.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Space.screen,
    },
    introTitle: { fontSize: 22, fontWeight: '600', color: '#FFFFFF' },
    introLine: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 8,
    },
    introBtn: { marginTop: 26, minWidth: 180 },
    introSkip: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: Type.scale.caption.size,
      marginTop: Space.screen,
      padding: 6,
    },
  })
);

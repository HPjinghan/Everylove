/**
 * 「TA 正在看你的手机」（D-118）：她让 TA 看手机的那几秒，屏幕上把她的 App 一个个打开给她看——
 * 记事本（列表往下滑、停在一条上）→ 日历（月网格、停在一条日程上）→ Message（和别人的聊天往上翻）。
 * 这是回放，不是真的「他在操作」：TA 拿到的是同一份数据（lib/chat peekPayload），停在哪一条按数据挑；
 * 外面套一个「TA 的名字 正在看 · ●●●」的框让她知道这是他视角。放完（且 TA 已回话）显示「TA 放下了手机」自动关。
 * 全部 Animated，不打模型；纸面样式，米色记事本 NOTE_PAPER 只用于她的本子回放。
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, useAnimatedValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { NOTE_PAPER, Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { parseDateKey } from '@/content/calendar';
import { messageContextText } from '@/content/prompts';
import { t } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';

export interface PeekPayload {
  notes: { at: number; text: string }[];
  events: { id: string; date: string; title: string }[];
  chats: { name: string; characterId: string; messages: ChatMessage[] }[];
}

type Screen = 'notes' | 'calendar' | 'messages';
const ORDER: Screen[] = ['notes', 'calendar', 'messages'];
/** 每个 App 停留多久；停在某一条上的额外时间 */
const SCREEN_MS = 3200;
const LINGER_MS = 1400;
const ROW_H = 58;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function PeekReplay({
  visible,
  name,
  characterId,
  color,
  payload,
  done,
  onClose,
}: {
  visible: boolean;
  name: string;
  characterId: string;
  color: string;
  payload: PeekPayload;
  /** TA 已经看完并回了话（放完再关） */
  done: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('notes');
  const [finished, setFinished] = useState(false);
  const scrollY = useAnimatedValue(0);
  const fade = useAnimatedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 回放脚本：每个 App 淡入 → 往下滑到挑中的那一条 → 停 → 下一个
  useEffect(() => {
    if (!visible) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // 规则不许 effect 体内同步 setState：重置放到下一拍
    timers.current.push(setTimeout(() => setFinished(false), 0));
    let at = 0;
    ORDER.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => {
          setScreen(s);
          scrollY.setValue(0);
          fade.setValue(0);
          Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
          const target = pickOffset(s, payload);
          Animated.sequence([
            Animated.delay(500),
            Animated.timing(scrollY, { toValue: -target, duration: 1400, useNativeDriver: true }),
          ]).start();
        }, at)
      );
      at += SCREEN_MS + (i === ORDER.length - 1 ? LINGER_MS : 0);
    });
    timers.current.push(setTimeout(() => setFinished(true), at));
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 放完且 TA 已回话 → 「放下了手机」→ 关
  useEffect(() => {
    if (!visible || !finished || !done) return;
    const id = setTimeout(onClose, 1200);
    return () => clearTimeout(id);
  }, [visible, finished, done, onClose]);

  const closing = finished && done;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.frame}>
          <CharAvatar name={name} color={color} size={28} characterId={characterId} />
          <Text style={styles.frameText} numberOfLines={1}>
            {closing ? t('{name} 放下了手机', { name }) : t('{name} 正在看你的手机', { name })}
          </Text>
          {!closing ? <Dots /> : null}
        </View>
        <Animated.View style={[styles.phone, { opacity: fade }]}>
          <View style={styles.appBar}>
            <Text style={[styles.appTitle, screen === 'messages' && styles.appTitleLatin]}>
              {screen === 'notes' ? t('记事本') : screen === 'calendar' ? t('日历') : 'Message'}
            </Text>
          </View>
          <View style={styles.viewport}>
            <Animated.View style={{ transform: [{ translateY: scrollY }] }}>
              {screen === 'notes' ? <NotesReplay payload={payload} /> : null}
              {screen === 'calendar' ? <CalendarReplay payload={payload} /> : null}
              {screen === 'messages' ? <MessagesReplay payload={payload} /> : null}
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** 停在哪：记事本 = 最长的一条；日历 = 最近的一条日程所在行；Message = 聊天翻到中段 */
function pickOffset(s: Screen, p: PeekPayload): number {
  if (s === 'notes') {
    if (p.notes.length < 3) return 0;
    let idx = 0;
    p.notes.forEach((n, i) => {
      if (n.text.length > p.notes[idx].text.length) idx = i;
    });
    return Math.max(0, idx - 1) * ROW_H;
  }
  if (s === 'calendar') return p.events.length ? 40 : 0;
  const msgs = p.chats[0]?.messages ?? [];
  return msgs.length > 5 ? Math.floor(msgs.length / 2) * 44 : 0;
}

function Dots() {
  const v = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.Text style={[styles.dots, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}>●●●</Animated.Text>;
}

function NotesReplay({ payload }: { payload: PeekPayload }) {
  let longest = 0;
  payload.notes.forEach((n, i) => {
    if (n.text.length > payload.notes[longest].text.length) longest = i;
  });
  return (
    <View style={styles.list}>
      {payload.notes.length ? (
        payload.notes.map((n, i) => (
          <View key={i} style={[styles.noteRow, i === longest && styles.noteRowOn]}>
            <Text style={styles.noteText} numberOfLines={2}>
              {n.text}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>{t('这天还是空白的。')}</Text>
      )}
    </View>
  );
}

function CalendarReplay({ payload }: { payload: PeekPayload }) {
  const first = payload.events[0] ? parseDateKey(payload.events[0].date) : new Date();
  const y = first.getFullYear();
  const m = first.getMonth();
  const startPad = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const marked = new Set(payload.events.filter((e) => e.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).map((e) => Number(e.date.slice(8))));
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <View style={styles.list}>
      <Text style={styles.month}>
        {y} / {m + 1}
      </Text>
      <View style={styles.weekRow}>
        {WEEK.map((w) => (
          <Text key={w} style={styles.weekCell}>
            {t(w)}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => (
          <View key={i} style={styles.dayCell}>
            {d ? (
              <View style={[styles.dayNum, marked.has(d) && styles.dayOn]}>
                <Text style={[styles.dayText, marked.has(d) && styles.dayTextOn]}>{d}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {payload.events.map((e) => (
        <View key={e.id} style={styles.eventRow}>
          <Text style={styles.eventDate}>{e.date.slice(5)}</Text>
          <Text style={styles.eventText} numberOfLines={1}>
            {e.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MessagesReplay({ payload }: { payload: PeekPayload }) {
  const chat = payload.chats[0];
  if (!chat) return <Text style={styles.empty}>{t('…')}</Text>;
  return (
    <View style={styles.list}>
      <Text style={styles.threadName}>{chat.name}</Text>
      {chat.messages.map((m) => {
        const text = messageContextText(m);
        if (!text) return null;
        const mine = m.from === 'me';
        return (
          <View key={m.id} style={[styles.bubbleRow, mine ? styles.bubbleRowMe : styles.bubbleRowHim]}>
            <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleHim]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMe]} numberOfLines={3}>
                {text}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.ink },
    // 框：TA 视角
    frame: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, paddingHorizontal: Space.screen, paddingVertical: 12 },
    frameText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    dots: { fontFamily: Fonts.label, fontSize: 10, color: '#FFFFFF', letterSpacing: 2 },
    // 她的手机（缩一圈，四周留 ink）
    phone: {
      flex: 1,
      marginHorizontal: Space.screen,
      marginBottom: 24,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      overflow: 'hidden',
      borderWidth: Shape.stroke,
      borderColor: withAlpha('#FFFFFF', 0.35),
    },
    appBar: { paddingVertical: 12, alignItems: 'center', borderBottomWidth: Shape.stroke, borderBottomColor: Romance.stroke },
    appTitle: { fontSize: 17, fontWeight: '600', color: Romance.ink },
    appTitleLatin: { fontFamily: Fonts.labelBold, fontWeight: '400' },
    viewport: { flex: 1, overflow: 'hidden' },
    list: { padding: Space.screen, gap: Space.inline },
    // 记事本：米色纸
    noteRow: {
      height: ROW_H - Space.inline,
      justifyContent: 'center',
      paddingHorizontal: Space.cardX,
      borderRadius: Shape.radius,
      backgroundColor: NOTE_PAPER.bg,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
    },
    noteRowOn: { borderColor: Romance.accent, borderWidth: 2 },
    noteText: { fontSize: 13, lineHeight: 18, color: NOTE_PAPER.ink },
    empty: { fontSize: 13, color: Romance.sub, padding: Space.screen },
    // 日历
    month: { fontFamily: Fonts.labelBold, fontSize: 17, color: Romance.ink, textAlign: 'center' },
    weekRow: { flexDirection: 'row' },
    weekCell: { width: '14.28%', textAlign: 'center', fontSize: 11, color: Romance.sub },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
    dayNum: { width: 30, height: 30, borderRadius: Shape.radius, alignItems: 'center', justifyContent: 'center' },
    dayOn: { backgroundColor: Romance.accent },
    dayText: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    dayTextOn: { color: '#FFFFFF', fontFamily: Fonts.labelBold },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, backgroundColor: Romance.card, borderRadius: Shape.radius, borderWidth: Shape.stroke, borderColor: Romance.accent, padding: 10 },
    eventDate: { fontFamily: Fonts.label, fontSize: 12, color: Romance.accent },
    eventText: { flex: 1, fontSize: 14, color: Romance.ink },
    // Message
    threadName: { fontSize: 14, fontWeight: '600', color: Romance.ink, textAlign: 'center', marginBottom: 4 },
    bubbleRow: { maxWidth: '78%' },
    bubbleRowMe: { alignSelf: 'flex-end' },
    bubbleRowHim: { alignSelf: 'flex-start' },
    bubble: { paddingVertical: Space.bubbleY, paddingHorizontal: Space.bubbleX, borderRadius: Shape.radius },
    bubbleMe: { backgroundColor: Romance.bubbleMe, borderBottomRightRadius: Shape.radiusTail },
    bubbleHim: { backgroundColor: Romance.bubbleHim, borderBottomLeftRadius: Shape.radiusTail },
    bubbleText: { fontSize: 13, lineHeight: 18, color: Romance.ink },
    bubbleTextMe: { color: '#FFFFFF' },
  })
);

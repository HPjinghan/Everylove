/**
 * 日历（D-020；D-100 纸面）：内嵌真实日历，三层——
 * 世界层：真实日期 + 节假日（中文盘中国节日，content/calendar.ts）；
 * 关系层：自动记录（领养纪念日、你的生日、一百天、带时间的约定），不用用户动手；
 * 用户层：手动添加日程（考试/面试/出差），每条触发心跳三段式（lib/heartbeat.ts）。
 * 三层圆点：节日 ink / 纪念 primary / 日程 accent；选中日 primary 底白字（今日不另标，选中即今日）。
 * 详情里来自 outingPlans 的条目右侧是「赴约 ›」，点了直接去现场（D-100 交互改动 7）。
 * v1 边界：不读系统日历（手动添加、数据最小化）。日历只记安排与纪念日（D-090）：TA 经历的事在发生之后进记事本或 X，不作未来日程。
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { dateKey, holidayFor, parseDateKey } from '@/content/calendar';
import { placeById } from '@/content/places';
import { clockTime, uid } from '@/lib/format';
import { getLang, t } from '@/lib/i18n';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import { findCharacter, useAppStore } from '@/store/app-store';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

interface DayMark {
  label: string;
  layer: 'world' | 'relation' | 'user';
  /** 带时间的条目（约定）：时间单独用 Fredoka 排 */
  time?: string;
  /** 来自 outingPlans 的条目：右侧「赴约 ›」直达现场 */
  planPlaceId?: string;
}

export default function CalendarScreen() {
  const router = useRouter();
  const userEvents = useAppStore((s) => s.userEvents);
  const bonds = useAppStore((s) => s.bonds);
  const plans = useAppStore((s) => s.outingPlans);
  const bond = bonds[0];
  const character = bond ? findCharacter(bond.characterId) : undefined;

  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(dateKey(today));
  const [draft, setDraft] = useState('');

  /** 关系层：自动记录，不用用户动手 */
  const relationMarks = useMemo(() => {
    const marks = new Map<string, DayMark[]>();
    const push = (key: string, label: string, layer: DayMark['layer']) => {
      if (!marks.has(key)) marks.set(key, []);
      marks.get(key)!.push({ label, layer });
    };
    if (bond) {
      const created = new Date(bond.createdAt);
      push(dateKey(created), t('和{name}交换联系方式', { name: bond.name }), 'relation');
      const hundred = new Date(bond.createdAt);
      hundred.setDate(hundred.getDate() + 99);
      push(dateKey(hundred), t('一百天'), 'relation');
      // 她的生日以身份为准（D-088），旧存档回落缔结时抄下的那份
      const myBirthday = useAppStore.getState().me?.birthday ?? bond.birthday;
      if (myBirthday) {
        const [mm, dd] = myBirthday.split('-').map(Number);
        push(dateKey(new Date(ym.y, mm - 1, dd)), t('你的生日'), 'relation');
      }
      if (character?.birthday) {
        const [mm, dd] = character.birthday.split('-').map(Number);
        if (mm && dd) push(dateKey(new Date(ym.y, mm - 1, dd)), t('{name}的生日', { name: bond.name }), 'relation');
      }
    }
    return marks;
  }, [bond, character, ym.y]);

  const marksFor = (key: string): DayMark[] => {
    const out: DayMark[] = [];
    const holiday = holidayFor(key);
    if (holiday) out.push({ label: holiday, layer: 'world' });
    out.push(...(relationMarks.get(key) ?? []));
    // 约定（D-079）：对话里聊定的 / 外出页约的，带时间的落在日历上
    for (const p of plans) {
      if (!p.at || dateKey(new Date(p.at)) !== key) continue;
      const place = placeById(p.placeId);
      const name = bonds.find((b) => b.characterId === p.characterId)?.name;
      if (!place || !name) continue;
      out.push({
        label: t('和{name}约在{place}', { name, place: t(place.name) }),
        layer: 'relation',
        time: clockTime(p.at),
        planPlaceId: place.id,
      });
    }
    for (const e of userEvents.filter((e) => e.date === key)) {
      out.push({ label: e.title, layer: 'user' });
    }
    return out;
  };

  // 月网格
  const days = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const startPad = first.getDay();
    const count = new Date(ym.y, ym.m + 1, 0).getDate();
    const cells: (string | null)[] = Array(startPad).fill(null);
    for (let d = 1; d <= count; d++) cells.push(dateKey(new Date(ym.y, ym.m, d)));
    return cells;
  }, [ym]);

  const addEvent = () => {
    const title = draft.trim();
    if (!title) return;
    if (parseDateKey(selected).getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
      Alert.alert(t('这天已经过去了'), t('选今天或以后的日子吧。'));
      return;
    }
    useAppStore.getState().addUserEvent({ id: uid('ev'), date: selected, title });
    setDraft('');
    // 有可能立即落入投递窗口（比如今天的日程），马上跑一次心跳
    deliverDueHeartbeats();
  };

  const removeEvent = (id: string, title: string) => {
    Alert.alert(t('删除日程'), t('「{title}」会从日历里消失。', { title }), [
      { text: t('取消'), style: 'cancel' },
      { text: t('删除'), style: 'destructive', onPress: () => useAppStore.getState().removeUserEvent(id) },
    ]);
  };

  const selectedMarks = marksFor(selected);
  const selectedUserEvents = userEvents.filter((e) => e.date === selected);

  // 月份标题：文案走词典，数字部分单独用 Fredoka 排（不带参数调 t() 拿到的是保留 {y}/{m} 的模板）
  const monthParts = t('{y} 年 {m} 月').split(/(\{y\}|\{m\})/);

  const dotStyle = { world: styles.dotWorld, relation: styles.dotRelation, user: styles.dotUser } as const;

  return (
    <AppScreen title={t('日历')}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 月切换 */}
          <View style={styles.monthRow}>
            <Pressable hitSlop={12} onPress={() => setYm((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}>
              <Text style={styles.monthArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {monthParts.map((part, i) =>
                part === '{y}' || part === '{m}' ? (
                  <Text key={i} style={styles.monthNum}>
                    {part === '{y}' ? ym.y : ym.m + 1}
                  </Text>
                ) : (
                  part
                )
              )}
            </Text>
            <Pressable hitSlop={12} onPress={() => setYm((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}>
              <Text style={styles.monthArrow}>›</Text>
            </Pressable>
          </View>

          {/* 星期头 */}
          <View style={styles.weekRow}>
            {WEEK.map((w) => (
              <Text key={w} style={styles.weekCell}>
                {t(w)}
              </Text>
            ))}
          </View>

          {/* 日网格 + 三层标记点 */}
          <View style={styles.grid}>
            {days.map((key, i) =>
              key === null ? (
                <View key={`pad-${i}`} style={styles.dayCell} />
              ) : (
                <Pressable key={key} style={styles.dayCell} onPress={() => setSelected(key)}>
                  <View style={[styles.dayNum, key === selected && styles.daySelected]}>
                    <Text style={[styles.dayText, key === selected && styles.dayTextSelected]}>
                      {parseDateKey(key).getDate()}
                    </Text>
                  </View>
                  <View style={styles.dotRow}>
                    {marksFor(key)
                      .slice(0, 3)
                      .map((m, j) => (
                        <View key={j} style={[styles.dot, dotStyle[m.layer]]} />
                      ))}
                  </View>
                </Pressable>
              )
            )}
          </View>

          {/* 选中日详情 */}
          <Card padded={false} style={styles.detail}>
            <Text style={styles.detailTitle}>
              {parseDateKey(selected).toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : getLang() === 'ja' ? 'ja-JP' : 'en-US', {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </Text>
            {selectedMarks.length === 0 ? (
              <Text style={styles.detailEmpty}>{t('这天还是空白的。')}</Text>
            ) : (
              selectedMarks.map((m, i) => {
                const userEvent = selectedUserEvents.find((e) => e.title === m.label);
                return (
                  <Pressable
                    key={i}
                    style={styles.markRow}
                    onLongPress={
                      m.layer === 'user' && userEvent ? () => removeEvent(userEvent.id, userEvent.title) : undefined
                    }>
                    <View style={[styles.dot, dotStyle[m.layer]]} />
                    <Text style={styles.markText}>
                      {m.time ? <Text style={styles.markTime}>{m.time} </Text> : null}
                      {m.label}
                    </Text>
                    {m.planPlaceId ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          router.push({ pathname: '/outing/[placeId]', params: { placeId: m.planPlaceId! } })
                        }>
                        <Text style={styles.markGo}>{t('赴约 ›')}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.markLayer}>{t(LAYER_LABEL[m.layer])}</Text>
                    )}
                  </Pressable>
                );
              })
            )}

            {/* 用户层：手动添加（v1 不读系统日历） */}
            <View style={styles.addRow}>
              <Input
                style={styles.addInput}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('添加日程：考试 / 面试 / 出差…')}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={addEvent}
              />
              <Button label={t('添加')} size="sm" onPress={addEvent} disabled={!draft.trim()} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const LAYER_LABEL: Record<DayMark['layer'], string> = {
  world: '节日',
  relation: '纪念',
  user: '日程',
};

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: Space.screen, paddingBottom: 40 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.tileGapLoose, marginBottom: 8 },
    monthArrow: { fontFamily: Fonts.label, fontSize: 26, color: Romance.accent, paddingHorizontal: 8 },
    monthTitle: { fontSize: 17, fontWeight: '600', color: Romance.ink },
    monthNum: { fontFamily: Fonts.labelBold, fontSize: 17, color: Romance.ink },
    weekRow: { flexDirection: 'row' },
    weekCell: { width: '14.28%', textAlign: 'center', fontSize: 12, color: Romance.sub, paddingVertical: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    // 7 × (100/7)% 浮点合计会略超 100%，第 7 格被挤到下一行 → 周日列全空；用略小的固定值
    dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 5 },
    dayNum: { width: 34, height: 34, borderRadius: Shape.radius, alignItems: 'center', justifyContent: 'center' },
    daySelected: { backgroundColor: Romance.accent },
    dayText: { fontFamily: Fonts.label, fontSize: 14, color: Romance.ink },
    dayTextSelected: { fontFamily: Fonts.labelBold, color: '#FFFFFF' },
    dotRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
    // 三层圆点（D-100）：节日 ink / 纪念 primary / 日程 accent
    dot: { width: 5, height: 5, borderRadius: 3 },
    dotWorld: { backgroundColor: Romance.ink },
    dotRelation: { backgroundColor: Romance.accent },
    dotUser: { backgroundColor: Romance.accentStrong },
    detail: { padding: 14, marginTop: 12 },
    detailTitle: { fontSize: 14, fontWeight: '600', color: Romance.ink, marginBottom: 8 },
    detailEmpty: { fontSize: 13, color: Romance.sub, marginBottom: 4 },
    markRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, paddingVertical: 7 },
    markText: { flex: 1, fontSize: 14, color: Romance.ink },
    markTime: { fontFamily: Fonts.label, fontSize: 14, color: Romance.ink },
    markLayer: { fontSize: 11, color: Romance.sub },
    markGo: { fontSize: 12, fontWeight: '600', color: Romance.accent },
    addRow: { flexDirection: 'row', gap: Space.inline, marginTop: 10 },
    addInput: { flex: 1, backgroundColor: Romance.bg, fontSize: 14, paddingVertical: 9, paddingHorizontal: 12 },
  })
);

/**
 * 日历（D-020）：内嵌真实日历，三层——
 * 世界层：真实日期 + 节假日（中文盘中国节日，content/calendar.ts）；
 * 关系层：自动记录（领养纪念日、你的生日、一百天），不用用户动手；
 * 用户层：手动添加日程（考试/面试/出差），每条触发心跳三段式（lib/heartbeat.ts）。
 * v1 边界：不读系统日历（手动添加、数据最小化）；TA 自己也稀疏长几条日程。
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { dateKey, holidayFor, parseDateKey } from '@/content/calendar';
import { scriptFor } from '@/content/characters';
import { Romance, themed } from '@/constants/theme';
import { uid } from '@/lib/format';
import { getLang, t } from '@/lib/i18n';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import { findCharacter, useAppStore } from '@/store/app-store';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

interface DayMark {
  label: string;
  layer: 'world' | 'relation' | 'user' | 'him';
}

export default function CalendarScreen() {
  const userEvents = useAppStore((s) => s.userEvents);
  const bond = useAppStore((s) => s.bonds[0]);
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
      if (bond.birthday) {
        const [mm, dd] = bond.birthday.split('-').map(Number);
        push(dateKey(new Date(ym.y, mm - 1, dd)), t('你的生日'), 'relation');
      }
      if (character?.birthday) {
        const [mm, dd] = character.birthday.split('-').map(Number);
        if (mm && dd) push(dateKey(new Date(ym.y, mm - 1, dd)), t('{name}的生日', { name: bond.name }), 'relation');
      }
      // TA 自己也稀疏长几条日程（按角色台词风格取样，只做展示）
      if (character) {
        const script = scriptFor(character);
        const seed = bond.createdAt;
        for (let i = 0; i < 2; i++) {
          const d = new Date(seed);
          d.setDate(d.getDate() + 5 + i * 11);
          const line = script.bonded[i % script.bonded.length];
          push(dateKey(d), `${bond.name}：${line.slice(0, 12)}…`, 'him');
        }
      }
    }
    return marks;
  }, [bond, character, ym.y]);

  const marksFor = (key: string): DayMark[] => {
    const out: DayMark[] = [];
    const holiday = holidayFor(key);
    if (holiday) out.push({ label: holiday, layer: 'world' });
    out.push(...(relationMarks.get(key) ?? []));
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
  const todayKey = dateKey(today);

  return (
    <AppScreen title={t("日历")}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 月切换 */}
          <View style={styles.monthRow}>
            <Pressable hitSlop={12} onPress={() => setYm((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}>
              <Text style={styles.monthArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>
              {t('{y} 年 {m} 月', { y: ym.y, m: ym.m + 1 })}
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
                  <View
                    style={[
                      styles.dayNum,
                      key === todayKey && styles.dayToday,
                      key === selected && styles.daySelected,
                    ]}>
                    <Text
                      style={[
                        styles.dayText,
                        key === todayKey && { color: Romance.accent, fontWeight: '700' },
                        key === selected && { color: '#fff' },
                      ]}>
                      {parseDateKey(key).getDate()}
                    </Text>
                  </View>
                  <View style={styles.dotRow}>
                    {marksFor(key)
                      .slice(0, 3)
                      .map((m, j) => (
                        <View key={j} style={[styles.dot, { backgroundColor: DOT[m.layer] }]} />
                      ))}
                  </View>
                </Pressable>
              )
            )}
          </View>

          {/* 选中日详情 */}
          <View style={styles.detail}>
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
                      m.layer === 'user' && userEvent
                        ? () => removeEvent(userEvent.id, userEvent.title)
                        : undefined
                    }>
                    <View style={[styles.dot, { backgroundColor: DOT[m.layer] }]} />
                    <Text style={styles.markText}>{m.label}</Text>
                    <Text style={styles.markLayer}>{t(LAYER_LABEL[m.layer])}</Text>
                  </Pressable>
                );
              })
            )}

            {/* 用户层：手动添加（v1 不读系统日历） */}
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('添加日程：考试 / 面试 / 出差…')}
                placeholderTextColor={Romance.faint}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={addEvent}
              />
              <Pressable style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]} onPress={addEvent} disabled={!draft.trim()}>
                <Text style={styles.addBtnText}>{t('添加')}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>{t('长按日程可删除。')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const DOT: Record<DayMark['layer'], string> = {
  world: '#F5A623',
  relation: '#FF6B81',
  user: '#5B8DEF',
  him: '#2EC4B6',
};

const LAYER_LABEL: Record<DayMark['layer'], string> = {
  world: '节日',
  relation: '纪念',
  user: '日程',
  him: 'TA 的',
};

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 14, paddingBottom: 40 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, marginBottom: 8 },
    monthArrow: { fontSize: 26, color: Romance.accent, paddingHorizontal: 8 },
    monthTitle: { fontSize: 17, fontWeight: '700', color: Romance.ink },
    weekRow: { flexDirection: 'row' },
    weekCell: { width: '14.28%', textAlign: 'center', fontSize: 12, color: Romance.sub, paddingVertical: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    // 7 × (100/7)% 浮点合计会略超 100%，第 7 格被挤到下一行 → 周日列全空；用略小的固定值
    dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 5 },
    dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    dayToday: { backgroundColor: Romance.accentSoft },
    daySelected: { backgroundColor: Romance.accent },
    dayText: { fontSize: 14, color: Romance.ink },
    dotRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
    dot: { width: 5, height: 5, borderRadius: 3 },
    detail: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, marginTop: 12 },
    detailTitle: { fontSize: 14, fontWeight: '700', color: Romance.ink, marginBottom: 8 },
    detailEmpty: { fontSize: 13, color: Romance.faint, marginBottom: 4 },
    markRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    markText: { flex: 1, fontSize: 14, color: Romance.ink },
    markLayer: { fontSize: 11, color: Romance.faint },
    addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    addInput: {
      flex: 1,
      backgroundColor: Romance.bg,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: Romance.ink,
    },
    addBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 16,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    hint: { fontSize: 11, color: Romance.faint, marginTop: 10, lineHeight: 17 },
  })
);

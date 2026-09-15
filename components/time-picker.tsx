/**
 * 约时间（D-084 → D-131，Harper：「约出门的时间要能自己任意选，不要预设值」）：日期 chip（今天 / 明天 / 后天 / 之后两周）
 * + 小时 / 分钟两个滚轮（任意时刻，不再是六个时段）→ 时间戳。外出邀请（会话「+」）与外出页「约 TA」共用。
 * 滚轮是纯 JS 的（ScrollView 吸附），不引原生日期选择器——Expo Go 与 TestFlight 都不用重新 build。
 * 已经过去的时刻不能约：按钮停用、只说「这个时间已经过了」。
 */

import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { planTimeLabel } from '@/lib/appointments';
import { t } from '@/lib/i18n';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
/** 能约到多少天以后 */
const DAYS_AHEAD = 14;
/** 滚轮：一行高、可见几行（奇数，选中的在正中） */
const ROW_H = 36;
const ROWS = 5;
/** 至少约在几分钟之后 */
const MIN_AHEAD_MS = 5 * 60_000;

function dayLabel(offset: number, d: Date): string {
  if (offset === 0) return t('今天');
  if (offset === 1) return t('明天');
  if (offset === 2) return t('后天');
  return `${t('周{d}', { d: t(WEEKDAY[d.getDay()]) })} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** 纯 JS 滚轮：一格一格吸附，正中那格就是选中的 */
function Wheel({ values, index, onChange }: { values: string[]; index: number; onChange: (i: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const pad = ROW_H * Math.floor(ROWS / 2);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ROW_H)));
    if (i !== index) onChange(i);
  };
  return (
    <View style={styles.wheel}>
      <View pointerEvents="none" style={styles.wheelBand} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ROW_H }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: pad }}>
        {values.map((v, i) => (
          <View key={v} style={styles.wheelRow}>
            <Text style={[styles.wheelText, i === index && styles.wheelTextOn]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function TimePicker({ onPick }: { onPick: (at: number) => void }) {
  const now = useMemo(() => new Date(), []);
  // 默认：下一个整点
  const defaultHour = (now.getHours() + 1) % 24;
  const [dayOffset, setDayOffset] = useState(now.getHours() === 23 ? 1 : 0);
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState(0);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_AHEAD }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        return { offset: i, date: d, label: dayLabel(i, d) };
      }),
    [now]
  );
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);

  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0).getTime();
  const ok = at > now.getTime() + MIN_AHEAD_MS;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {days.map((d) => (
          <Chip key={d.offset} label={d.label} selected={d.offset === dayOffset} onPress={() => setDayOffset(d.offset)} />
        ))}
      </ScrollView>
      <View style={styles.wheels}>
        <Wheel values={hours} index={hour} onChange={setHour} />
        <Text style={styles.colon}>:</Text>
        <Wheel values={minutes} index={minute} onChange={setMinute} />
      </View>
      <Button label={ok ? planTimeLabel(at) : t('这个时间已经过了')} disabled={!ok} style={styles.submit} onPress={() => ok && onPick(at)} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: 12 },
    chips: { flexDirection: 'row', gap: Space.inline },
    wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.inline },
    wheel: { height: ROW_H * ROWS, width: 76, overflow: 'hidden' },
    wheelBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: ROW_H * Math.floor(ROWS / 2),
      height: ROW_H,
      borderTopWidth: Shape.stroke,
      borderBottomWidth: Shape.stroke,
      borderColor: Romance.stroke,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radius,
    },
    wheelRow: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
    wheelText: { fontFamily: Fonts.label, fontSize: 20, color: Romance.sub },
    wheelTextOn: { fontFamily: Fonts.labelBold, color: Romance.ink },
    colon: { fontFamily: Fonts.labelBold, fontSize: 22, color: Romance.ink },
    submit: { marginTop: 4 },
  })
);

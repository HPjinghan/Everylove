/**
 * 约时间（D-084；D-100 纸面 token 迁移）：日期 chip（今天 / 明天 / 后天 / 之后四天）× 时段 chip（上午 10:00 … 夜里 21:00）→ 时间戳。
 * chips 用 Chip、确认用 Button。今天已经过去的时段不出现。外出邀请（会话「+」）与外出页「约 TA」共用。
 */

import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { themed } from '@/constants/theme';
import { planTimeLabel } from '@/lib/appointments';
import { t } from '@/lib/i18n';

const SLOTS: { label: string; h: number; m: number }[] = [
  { label: '上午 10:00', h: 10, m: 0 },
  { label: '中午 12:00', h: 12, m: 0 },
  { label: '下午 15:00', h: 15, m: 0 },
  { label: '傍晚 17:30', h: 17, m: 30 },
  { label: '晚上 19:00', h: 19, m: 0 },
  { label: '夜里 21:00', h: 21, m: 0 },
];
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

function dayLabel(offset: number, d: Date): string {
  if (offset === 0) return t('今天');
  if (offset === 1) return t('明天');
  if (offset === 2) return t('后天');
  return `${t('周{d}', { d: t(WEEKDAY[d.getDay()]) })} ${d.getMonth() + 1}/${d.getDate()}`;
}

export function TimePicker({ onPick }: { onPick: (at: number) => void }) {
  const now = useMemo(() => new Date(), []);
  const [dayOffset, setDayOffset] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        return { offset: i, date: d, label: dayLabel(i, d) };
      }),
    [now]
  );
  const atFor = (offset: number, s: (typeof SLOTS)[number]) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, s.h, s.m, 0, 0).getTime();
  // 今天：半小时内 / 已过去的时段不给选
  const slots = SLOTS.map((s, i) => ({ ...s, i, at: atFor(dayOffset, s) })).filter(
    (s) => s.at > now.getTime() + 30 * 60_000
  );
  const chosen = slot != null ? slots.find((s) => s.i === slot) : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {days.map((d) => (
          <Chip
            key={d.offset}
            label={d.label}
            selected={d.offset === dayOffset}
            onPress={() => {
              setDayOffset(d.offset);
              setSlot(null);
            }}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {slots.map((s) => (
          <Chip key={s.i} label={t(s.label)} selected={s.i === slot} onPress={() => setSlot(s.i)} />
        ))}
      </View>
      <Button
        label={chosen ? planTimeLabel(chosen.at) : t('选个时间')}
        disabled={!chosen}
        style={styles.submit}
        onPress={() => chosen && onPick(chosen.at)}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    submit: { marginTop: 4 },
  })
);

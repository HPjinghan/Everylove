/**
 * 生日（D-182 → D-222）：值是 'MM-DD'，只在「我的身份」里填。
 * 一行显示当前生日 + 一个「修改」按钮，点了展开月 / 日两个滚轮（再点收起）；没有「去掉」这一项。
 * 不再用自由文本——日历按 'MM-DD' 拆，乱填会画不出「你的生日」。
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Wheel } from '@/components/time-picker';
import { Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  const month = m ? Math.min(12, Math.max(1, Number(m[1]))) : 1;
  const day = m ? Math.min(DAYS_IN_MONTH[month - 1], Math.max(1, Number(m[2]))) : 1;
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const days = useMemo(() => Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => String(i + 1).padStart(2, '0')), [month]);
  const set = (mm: number, dd: number) => onChange(`${String(mm).padStart(2, '0')}-${String(Math.min(dd, DAYS_IN_MONTH[mm - 1])).padStart(2, '0')}`);
  const toggle = () => {
    // 第一次打开：滚轮停在哪就是哪天
    if (!open && !m) set(month, day);
    setOpen(!open);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {m ? <Text style={styles.value}>{value}</Text> : <Text style={styles.empty}>{t('还没填')}</Text>}
        <Button label={open ? t('完成') : t('修改')} variant="secondary" size="sm" onPress={toggle} />
      </View>
      {open ? (
        <View style={styles.wheels}>
          <Wheel values={months} index={month - 1} onChange={(i) => set(i + 1, day)} />
          <Wheel values={days} index={day - 1} onChange={(i) => set(month, i + 1)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: Space.inline },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.inline },
    value: { fontFamily: Fonts.label, fontSize: Type.scale.body.size, color: Romance.ink },
    empty: { fontSize: Type.scale.body.size, color: Romance.sub },
    wheels: { flexDirection: 'row', justifyContent: 'center', gap: Space.inline },
  })
);

/**
 * 生日（D-182）：月 / 日两个滚轮，值是 'MM-DD'；可不填（onboarding 与「我的身份」共用）。
 * 不再用自由文本——日历按 'MM-DD' 拆，乱填会画不出「你的生日」。
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Wheel } from '@/components/time-picker';
import { Space } from '@/constants/design';
import { themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = /^(\d{2})-(\d{2})$/.exec(value);
  const month = m ? Math.min(12, Math.max(1, Number(m[1]))) : 1;
  const day = m ? Math.min(DAYS_IN_MONTH[month - 1], Math.max(1, Number(m[2]))) : 1;
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  const days = useMemo(() => Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => String(i + 1).padStart(2, '0')), [month]);
  const set = (mm: number, dd: number) => onChange(`${String(mm).padStart(2, '0')}-${String(Math.min(dd, DAYS_IN_MONTH[mm - 1])).padStart(2, '0')}`);
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        <Chip label={t('不填')} selected={!m} onPress={() => onChange('')} />
        <Chip label={m ? value : t('填一下')} selected={!!m} onPress={() => !m && set(month, day)} />
      </View>
      {m ? (
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
    chips: { flexDirection: 'row', gap: Space.inline },
    wheels: { flexDirection: 'row', justifyContent: 'center', gap: Space.inline },
  })
);

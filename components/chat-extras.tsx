/**
 * 会话「+」面板的玩法（D-081/D-084）：外出邀请（地点 → 时间）/ 红包。
 * 位置在 components/location-picker.tsx（真实地图）；查手机的锁屏在 components/phone-lock.tsx（iPhone 式）、
 * 解锁后的内容在 components/his-phone.tsx（记事本 / 日历 / Message / 相册，D-085）。
 */

import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TimePicker } from '@/components/time-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PLACES, type Place } from '@/content/places';
import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';

export type ExtraSheet = 'invite' | 'phone' | 'redpacket' | 'location' | null;

const SPOTS = PLACES.filter((p) => !p.stranger);

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <IconSymbol name="xmark" size={18} color={Romance.sub} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── 外出邀请：选地点 → 选时间（D-084） ── */

export function InviteSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (place: Place, at: number) => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const close = () => {
    setPlace(null);
    onClose();
  };
  return (
    <Sheet visible={visible} title={place ? t('约在什么时候？') : t('约 TA 去哪儿？')} onClose={close}>
      {place ? (
        <>
          <Pressable style={styles.row} onPress={() => setPlace(null)}>
            <Text style={styles.rowEmoji}>{place.emoji}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t(place.name)}</Text>
              <Text style={styles.rowSub}>{t(place.hook)}</Text>
            </View>
          </Pressable>
          <TimePicker
            onPick={(at) => {
              const p = place;
              setPlace(null);
              onPick(p, at);
            }}
          />
        </>
      ) : (
        SPOTS.map((p) => (
          <Pressable key={p.id} style={styles.row} onPress={() => setPlace(p)}>
            <Text style={styles.rowEmoji}>{p.emoji}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{t(p.name)}</Text>
              <Text style={styles.rowSub}>{t(p.hook)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

/* ── 红包：金额 + 留言（试装是游戏币，不扣费） ── */

const RED_PACKET_PRESETS = [5.2, 13.14, 52, 99, 520];

export function RedPacketSheet({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (amount: number, note: string) => void;
}) {
  const [amount, setAmount] = useState<number | null>(52);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const value = custom.trim() ? Number(custom) : amount;
  const ok = value != null && Number.isFinite(value) && value > 0 && value <= 9999;

  return (
    <Sheet visible={visible} title={t('红包')} onClose={onClose}>
      <View style={styles.redCard}>
        <Text style={styles.redAmount}>¥ {ok ? value!.toFixed(2) : '0.00'}</Text>
      </View>
      <View style={styles.chips}>
        {RED_PACKET_PRESETS.map((n) => {
          const active = !custom.trim() && amount === n;
          return (
            <Pressable
              key={n}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setAmount(n);
                setCustom('');
              }}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.toFixed(2)}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        value={custom}
        onChangeText={(v) => setCustom(v.replace(/[^\d.]/g, ''))}
        placeholder={t('或者自己填个数')}
        placeholderTextColor={Romance.faint}
        keyboardType="decimal-pad"
        maxLength={7}
      />
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder={t('留一句话')}
        placeholderTextColor={Romance.faint}
        maxLength={30}
      />
      <Pressable
        style={[styles.primaryBtn, styles.primaryBtnRed, !ok && styles.btnDisabled]}
        disabled={!ok}
        onPress={() => {
          onSend(value!, note.trim() || t('给你的'));
          setNote('');
          setCustom('');
        }}>
        <Text style={styles.primaryBtnText}>{t('塞进红包')}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: Romance.bg },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 18,
      paddingBottom: 10,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: Romance.ink },
    sheetClose: { position: 'absolute', right: 16, top: 14, padding: 6 },
    sheetBody: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    rowEmoji: { fontSize: 24 },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    redCard: {
      backgroundColor: '#E5533D',
      borderRadius: 20,
      paddingVertical: 28,
      alignItems: 'center',
    },
    redAmount: { color: '#FFE9B8', fontSize: 30, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    chipActive: { backgroundColor: '#E5533D' },
    chipText: { fontSize: 13, color: Romance.sub },
    chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
    input: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
      color: Romance.ink,
    },
    primaryBtn: {
      marginTop: 6,
      backgroundColor: Romance.accent,
      borderRadius: 24,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryBtnRed: { backgroundColor: '#E5533D' },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    btnDisabled: { opacity: 0.4 },
  })
);

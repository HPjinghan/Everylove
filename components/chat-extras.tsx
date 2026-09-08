/**
 * 会话「+」面板的玩法（D-081/D-084；D-100 纸面 token 迁移）：外出邀请（地点 → 时间）/ 红包。
 * 地点行用 Card、金额 chips 用 Chip、输入用 Input、提交用 Button；红包不再用红，金额是白卡里的 accent Fredoka。
 * 位置在 components/location-picker.tsx（真实地图）；查手机的锁屏在 components/phone-lock.tsx（iPhone 式）、
 * 解锁后的内容在 components/his-phone.tsx（记事本 / 日历 / Message / 相册，D-085）。
 */

import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Input } from '@/components/input';
import { TimePicker } from '@/components/time-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { PLACES, type Place } from '@/content/places';
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

function PlaceRow({ place, onPress }: { place: Place; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <Text style={styles.rowEmoji}>{place.emoji}</Text>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{t(place.name)}</Text>
          <Text style={styles.rowSub}>{t(place.hook)}</Text>
        </View>
      </Card>
    </Pressable>
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
          <PlaceRow place={place} onPress={() => setPlace(null)} />
          <TimePicker
            onPick={(at) => {
              const p = place;
              setPlace(null);
              onPick(p, at);
            }}
          />
        </>
      ) : (
        SPOTS.map((p) => <PlaceRow key={p.id} place={p} onPress={() => setPlace(p)} />)
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
      <Card style={styles.amountCard}>
        <Text style={styles.amount}>¥ {ok ? value!.toFixed(2) : '0.00'}</Text>
      </Card>
      <View style={styles.chips}>
        {RED_PACKET_PRESETS.map((n) => (
          <Chip
            key={n}
            label={n.toFixed(2)}
            selected={!custom.trim() && amount === n}
            onPress={() => {
              setAmount(n);
              setCustom('');
            }}
          />
        ))}
      </View>
      <Input
        value={custom}
        onChangeText={(v) => setCustom(v.replace(/[^\d.]/g, ''))}
        placeholder={t('或者自己填个数')}
        keyboardType="decimal-pad"
        maxLength={7}
      />
      <Input value={note} onChangeText={setNote} placeholder={t('留一句话')} maxLength={30} />
      <Button
        label={t('塞进红包')}
        disabled={!ok}
        style={styles.submit}
        onPress={() => {
          onSend(value!, note.trim() || t('给你的'));
          setNote('');
          setCustom('');
        }}
      />
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: Romance.bg },
    sheetHeader: { alignItems: 'center', justifyContent: 'center', paddingTop: 18, paddingBottom: 10 },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    sheetClose: { position: 'absolute', right: 16, top: 14, padding: 6 },
    sheetBody: { paddingHorizontal: Space.screen, paddingBottom: 40, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowEmoji: { fontSize: 24 },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    // 金额：白卡 + accent Fredoka（不再用红）
    amountCard: { paddingVertical: 28, alignItems: 'center' },
    amount: { fontFamily: Fonts.labelBold, fontSize: 30, color: Romance.accentStrong },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    submit: { marginTop: 6 },
  })
);

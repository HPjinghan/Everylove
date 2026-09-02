/**
 * 会话「+」面板的四个玩法（D-081）：外出邀请 / 查 TA 的手机 / 红包 / 位置。
 * 每个都是一张 pageSheet；选定后由调用方（羁绊会话）落成卡片消息（kind 'card'）并让 TA 回应。
 * 「查 TA 的手机」：第一次要先拿到密码（D-082）——聊天里问 TA（TA 答应就解锁），或在锁屏上自己猜（猜对就开）；
 * 进去后是备忘录（TA 记着关于她的事）/ 相册 / 加密日记（隐藏设定：看得见已解锁的，锁着的只见轮廓）——
 * 正式形态与「被发现」的修罗场见 OPEN_QUESTIONS #19。
 */

import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PLACES, type Place } from '@/content/places';
import { characterSecrets, unlockedSecretCount } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { levelInfo } from '@/lib/bond';
import { t } from '@/lib/i18n';
import { PHONE_PASSCODE_LENGTH } from '@/lib/phone';
import type { Bond, Character } from '@/lib/types';
import { weatherCity } from '@/lib/weather';
import { useAppStore } from '@/store/app-store';

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

/* ── 外出邀请：选一个地点 ── */

export function InviteSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (place: Place) => void;
}) {
  return (
    <Sheet visible={visible} title={t('约 TA 去哪儿？')} onClose={onClose}>
      {SPOTS.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={() => onPick(p)}>
          <Text style={styles.rowEmoji}>{p.emoji}</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{t(p.name)}</Text>
            <Text style={styles.rowSub}>{t(p.hook)}</Text>
          </View>
        </Pressable>
      ))}
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

/* ── 位置：当前城市（天气页设置过的）或这个世界里的某个地点 ── */

export function LocationSheet({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (label: string, sub?: string) => void;
}) {
  const city = weatherCity();
  return (
    <Sheet visible={visible} title={t('位置')} onClose={onClose}>
      {city ? (
        <Pressable style={styles.row} onPress={() => onSend(t('我在{place}', { place: city }), t('当前位置'))}>
          <Text style={styles.rowEmoji}>📍</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{city}</Text>
            <Text style={styles.rowSub}>{t('当前位置')}</Text>
          </View>
        </Pressable>
      ) : null}
      {SPOTS.map((p) => (
        <Pressable
          key={p.id}
          style={styles.row}
          onPress={() => onSend(t('我在{place}', { place: t(p.name) }), t(p.hook))}>
          <Text style={styles.rowEmoji}>{p.emoji}</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{t(p.name)}</Text>
            <Text style={styles.rowSub}>{t(p.hook)}</Text>
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ── 查 TA 的手机 ── */

const NOTE_PREFIX: Record<string, string> = { 约定: '约定 · ', 答应: '答应过 · ', 节点: '' };

export function PhoneSheet({
  visible,
  onClose,
  bond,
  character,
  onViewed,
}: {
  visible: boolean;
  onClose: () => void;
  bond: Bond;
  character: Character;
  /** 内容真的展开给她看时（打开即已解锁，或刚猜对） */
  onViewed?: () => void;
}) {
  const album = useAppStore((s) => s.album);
  const portrait = useAppStore((s) => s.portraits[character.id]);
  const unlocked = !!bond.phoneUnlocked;
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const viewed = useRef(false);
  useEffect(() => {
    if (!visible) {
      viewed.current = false;
      setCode('');
      setWrong(false);
      return;
    }
    // 第一次点开锁屏就把密码定下来（随机，记在羁绊上）——她猜的和 TA 会说的是同一把
    if (!unlocked) useAppStore.getState().ensurePhoneCode(bond.id);
    if (unlocked && !viewed.current) {
      viewed.current = true;
      onViewed?.();
    }
  }, [visible, unlocked, onViewed, bond.id]);

  const tryCode = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, PHONE_PASSCODE_LENGTH);
    setCode(digits);
    setWrong(false);
    if (digits.length < PHONE_PASSCODE_LENGTH) return;
    if (digits === useAppStore.getState().ensurePhoneCode(bond.id)) {
      useAppStore.getState().setPhoneUnlocked(bond.id);
    } else {
      setWrong(true);
      setTimeout(() => setCode(''), 350);
    }
  };

  if (!unlocked) {
    return (
      <Sheet visible={visible} title={t('{name} 的手机', { name: bond.name })} onClose={onClose}>
        <View style={[styles.lock, styles.lockScreen, { backgroundColor: character.colorSoft ?? Romance.accentSoft }]}>
          <CharAvatar name={bond.name} color={character.color} size={64} characterId={character.id} />
          <Text style={styles.lockName}>{bond.name}</Text>
          <TextInput
            style={[styles.codeInput, wrong && styles.codeInputWrong]}
            value={code}
            onChangeText={tryCode}
            keyboardType="number-pad"
            maxLength={PHONE_PASSCODE_LENGTH}
            secureTextEntry
            autoFocus
            placeholder={t('密码')}
            placeholderTextColor={Romance.faint}
          />
          <Text style={styles.lockHint}>{wrong ? t('密码不对') : ' '}</Text>
        </View>
      </Sheet>
    );
  }

  const notes = (bond.memory?.facts ?? []).map((raw) => {
    const m = raw.match(/^\[(她|约定|答应|节点)\]\s*(.+)$/);
    return m ? `${NOTE_PREFIX[m[1]] ?? ''}${m[2]}` : raw;
  });
  const photos = [
    ...(portrait ? [{ id: 'portrait', uri: portrait }] : []),
    ...album.filter((p) => p.characterId === character.id).map((p) => ({ id: p.id, uri: p.uri })),
  ];
  const secrets = characterSecrets(character);
  const unlockedSecrets = unlockedSecretCount(levelInfo(bond.affinity).level, secrets.length);

  return (
    <Sheet visible={visible} title={t('{name} 的手机', { name: bond.name })} onClose={onClose}>
      <View style={[styles.lock, { backgroundColor: character.colorSoft ?? Romance.accentSoft }]}>
        <CharAvatar name={bond.name} color={character.color} size={56} characterId={character.id} />
        <Text style={styles.lockName}>{bond.name}</Text>
      </View>

      <Text style={styles.section}>{t('备忘录')}</Text>
      <View style={styles.note}>
        {notes.length ? (
          notes.slice(0, 14).map((n, i) => (
            <Text key={i} style={styles.noteLine}>
              · {n}
            </Text>
          ))
        ) : (
          <Text style={styles.noteEmpty}>{t('（还是空的）')}</Text>
        )}
      </View>

      <Text style={styles.section}>{t('相册')}</Text>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.note}>
          <Text style={styles.noteEmpty}>{t('（还是空的）')}</Text>
        </View>
      )}

      {secrets.length ? (
        <>
          <Text style={styles.section}>{t('加密日记')}</Text>
          <View style={styles.note}>
            {secrets.map((s, i) =>
              i < unlockedSecrets ? (
                <Text key={i} style={styles.noteLine}>
                  · {s}
                </Text>
              ) : (
                <Text key={i} style={styles.noteLocked}>
                  🔒 ••••••••••••
                </Text>
              )
            )}
          </View>
        </>
      ) : null}
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
    lock: { borderRadius: 24, paddingVertical: 26, alignItems: 'center', gap: 8 },
    lockScreen: { paddingVertical: 48, marginTop: 10 },
    lockName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    codeInput: {
      marginTop: 18,
      width: 168,
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 16,
      paddingVertical: 12,
      fontSize: 26,
      letterSpacing: 14,
      textAlign: 'center',
      color: Romance.ink,
    },
    codeInputWrong: { backgroundColor: '#FDEBEA' },
    lockHint: { fontSize: 12, color: '#C43A34', marginTop: 8, height: 16 },
    section: { fontSize: 12, fontWeight: '700', color: Romance.sub, marginTop: 8, marginLeft: 4 },
    note: { backgroundColor: '#FFFBEA', borderRadius: 16, padding: 14, gap: 6 },
    noteLine: { fontSize: 13, color: '#5B4A2E', lineHeight: 19 },
    noteEmpty: { fontSize: 13, color: Romance.faint },
    noteLocked: { fontSize: 13, color: Romance.faint, letterSpacing: 1 },
    photoRow: { gap: 8 },
    photo: { width: 84, height: 84, borderRadius: 12, backgroundColor: Romance.line },
  })
);

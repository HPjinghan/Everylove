/**
 * TA 的手机（解锁后的内容，D-082/D-085）：记事本（TA 按 MBTI 频率写的心事 + 锁着的页 = 隐藏设定）/ 日历 / Message / 相册。
 * 锁屏在 components/phone-lock.tsx；打开即触发一次记事本补写（lib/his-notes.ts），第一次进来不会是空本子。
 */

import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { placeById } from '@/content/places';
import { characterSecrets, messageContextText, unlockedSecretCount } from '@/content/prompts';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { planTimeLabel } from '@/lib/appointments';
import { levelInfo } from '@/lib/bond';
import { clockTime, timeAgo } from '@/lib/format';
import { portraitFor } from '@/lib/imagegen';
import { deliverDueHisNotes } from '@/lib/his-notes';
import { t } from '@/lib/i18n';
import type { Bond, Character } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

function dayLabel(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${t('周{d}', { d: t(WEEKDAY[d.getDay()]) })}`;
}

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
  /** 内容真的展开给她看时 */
  onViewed?: () => void;
}) {
  const album = useAppStore((s) => s.album);
  const storedPortrait = useAppStore((s) => s.portraits[character.id]);
  // 立绘：她重画的优先，种子角色回落内置（D-092）；相册要 URI 字符串
  const portrait = storedPortrait ?? portraitFor(character.id);
  const plans = useAppStore((s) => s.outingPlans);
  const viewed = useRef(false);
  useEffect(() => {
    if (!visible) {
      viewed.current = false;
      return;
    }
    if (!viewed.current) {
      viewed.current = true;
      onViewed?.();
      // 记事本补写：到点的 / 还一条没有的，这会儿写上
      void deliverDueHisNotes();
    }
  }, [visible, onViewed]);

  const notes = [...(bond.notes ?? [])].sort((a, b) => b.at - a.at);
  const secrets = characterSecrets(character);
  const unlockedSecrets = unlockedSecretCount(levelInfo(bond.affinity).level, secrets.length);

  // 日历：和她的约定 + TA 的生日（只记安排与纪念日，D-090；TA 经历的事在记事本里）
  const calendar = useMemo(() => {
    const out: { at: number; text: string }[] = [];
    for (const p of plans) {
      if (p.characterId !== character.id || !p.at) continue;
      const place = placeById(p.placeId);
      if (place) out.push({ at: p.at, text: t('和{name}去{place}', { name: bond.nickname, place: t(place.name) }) });
    }
    if (character.birthday && /^\d{1,2}-\d{1,2}$/.test(character.birthday)) {
      const [mm, dd] = character.birthday.split('-').map(Number);
      const y = new Date().getFullYear();
      let bd = new Date(y, mm - 1, dd).getTime();
      if (bd < Date.now() - 86400_000) bd = new Date(y + 1, mm - 1, dd).getTime();
      out.push({ at: bd, text: t('我的生日') });
    }
    return out.sort((a, b) => a.at - b.at).filter((e) => e.at > Date.now() - 86400_000).slice(0, 5);
  }, [plans, character, bond.nickname]);

  const messages = bond.messages.filter((m) => m.from !== 'system' && !m.recalled && messageContextText(m)).slice(-6);
  const photos = [
    ...(portrait ? [{ id: 'portrait', uri: portrait }] : []),
    ...album.filter((p) => p.characterId === character.id).map((p) => ({ id: p.id, uri: p.uri })),
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{t('{name} 的手机', { name: bond.name })}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <IconSymbol name="xmark" size={18} color={Romance.sub} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.lock, { backgroundColor: character.colorSoft ?? Romance.accentSoft }]}>
            <CharAvatar name={bond.name} color={character.color} size={56} characterId={character.id} />
            <Text style={styles.lockName}>{bond.name}</Text>
          </View>

          <Text style={styles.section}>{t('记事本')}</Text>
          <View style={styles.note}>
            {notes.length ? (
              notes.slice(0, 10).map((n) => (
                <View key={n.id} style={styles.noteItem}>
                  <Text style={styles.noteTime}>{timeAgo(n.at)}</Text>
                  <Text style={styles.noteLine}>{n.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noteEmpty}>{t('…')}</Text>
            )}
            {secrets.map((s, i) =>
              i < unlockedSecrets ? (
                <View key={`s${i}`} style={styles.noteItem}>
                  <Text style={styles.noteTime}>🔓</Text>
                  <Text style={styles.noteLine}>{s}</Text>
                </View>
              ) : (
                <View key={`s${i}`} style={styles.noteItem}>
                  <Text style={styles.noteTime}>🔒</Text>
                  <Text style={styles.noteLocked}>••••••••••••</Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.section}>{t('日历')}</Text>
          <View style={styles.card}>
            {calendar.length ? (
              calendar.map((e, i) => (
                <View key={i} style={styles.calRow}>
                  <Text style={styles.calDay}>{dayLabel(e.at)}</Text>
                  <Text style={styles.calText} numberOfLines={1}>
                    {e.text}
                  </Text>
                  <Text style={styles.calTime}>{planTimeLabel(e.at).replace(/^\S+\s/, '')}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noteEmpty}>{t('…')}</Text>
            )}
          </View>

          <Text style={styles.section}>Message</Text>
          <View style={styles.card}>
            <View style={styles.threadHead}>
              <Text style={styles.threadName}>{bond.nickname}</Text>
              {messages.length ? <Text style={styles.calTime}>{clockTime(messages[messages.length - 1].at)}</Text> : null}
            </View>
            {messages.length ? (
              messages.map((m) => (
                <Text key={m.id} style={[styles.msgLine, m.from === 'him' && styles.msgLineMine]} numberOfLines={2}>
                  {m.from === 'me' ? bond.nickname : t('我')}：{messageContextText(m)}
                </Text>
              ))
            ) : (
              <Text style={styles.noteEmpty}>{t('…')}</Text>
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
            <View style={styles.card}>
              <Text style={styles.noteEmpty}>{t('…')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
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
    sheetTitle: { fontFamily: Fonts.labelBold, fontSize: 16, color: Romance.ink },
    sheetClose: { position: 'absolute', right: 16, top: 14, padding: 6 },
    body: { paddingHorizontal: Space.screen, paddingBottom: 40, gap: Space.inlineLoose },
    lock: { borderRadius: Shape.radius, paddingVertical: 26, alignItems: 'center', gap: 8 },
    lockName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    section: { fontFamily: Fonts.label, fontSize: 12, color: Romance.sub, marginTop: 8, marginLeft: 4, letterSpacing: 0.5 },
    note: {
      backgroundColor: '#FFFBEA',
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      padding: Space.cardX,
      gap: 10,
    },
    noteItem: { gap: 2 },
    noteTime: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    noteLine: { fontSize: 14, color: '#5B4A2E', lineHeight: 21 },
    noteEmpty: { fontSize: 13, color: Romance.faint },
    noteLocked: { fontSize: 13, color: Romance.faint, letterSpacing: 1 },
    card: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      paddingVertical: Space.cardY,
      paddingHorizontal: Space.cardX,
      gap: 8,
    },
    calRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    calDay: { fontFamily: Fonts.label, fontSize: 12, color: Romance.accent, width: 64 },
    calText: { flex: 1, fontSize: 13, color: Romance.ink },
    calTime: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    threadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    threadName: { fontFamily: Fonts.labelBold, fontSize: 14, color: Romance.ink },
    msgLine: { fontSize: 13, color: Romance.sub, lineHeight: 19 },
    msgLineMine: { color: Romance.ink },
    photoRow: { gap: 8 },
    photo: { width: 84, height: 84, borderRadius: Shape.radiusInner, backgroundColor: Romance.line },
  })
);

/**
 * TA 的手机（解锁后的内容，D-082/D-085；D-100 纸面）：锁屏预览块（accentSoft）→ 记事本（米色纸 NOTE_PAPER：TA 按 MBTI 频率写的
 * 自己的日子 + 锁着的页 = 隐藏设定）/ 日历 / Message（白卡描边）/ 相册（拍立得）。小节 eyebrow：拉丁标签 Fredoka、中文系统字体。
 * 锁屏在 components/phone-lock.tsx；打开即触发一次记事本补写（lib/his-notes.ts），第一次进来不会是空本子。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Polaroid } from '@/components/polaroid';
import { placeById } from '@/content/places';
import { characterSecrets, messageContextText, unlockedSecretCount } from '@/content/prompts';
import { NOTE_PAPER, Shape, Space } from '@/constants/design';
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
const LATIN = /^[\x20-\x7E]+$/;
/** 相册里的拍立得宽度（横向一排） */
const SHOT_WIDTH = 110;

function dayParts(at: number): { md: string; wd: string } {
  const d = new Date(at);
  return { md: `${d.getMonth() + 1}/${d.getDate()}`, wd: t('周{d}', { d: t(WEEKDAY[d.getDay()]) }) };
}

/** 小节 eyebrow：NOTES / CALENDAR / MESSAGE 这类拉丁标签走 Fredoka 大写，中文走系统字体 */
function Eyebrow({ label }: { label: string }) {
  const latin = LATIN.test(label);
  return (
    <Text style={[styles.eyebrow, latin ? styles.eyebrowLatin : styles.eyebrowCjk]}>
      {latin ? label.toUpperCase() : label}
    </Text>
  );
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

  // 日历「今天」按打开这张表时的时间算（渲染里不直接叫 Date.now）
  const [now] = useState(() => Date.now());
  const notes = [...(bond.notes ?? [])].sort((a, b) => b.at - a.at);
  const secrets = characterSecrets(character);
  const unlockedSecrets = unlockedSecretCount(levelInfo(bond.affinity).level, secrets.length);

  // 日历：和她的约定 + TA 的生日（只记安排与纪念日，D-090；TA 经历的事在记事本里）
  const calendar = useMemo(() => {
    const out: { at: number; text: string; timed: boolean }[] = [];
    for (const p of plans) {
      if (p.characterId !== character.id || !p.at) continue;
      const place = placeById(p.placeId);
      if (place) out.push({ at: p.at, text: t('和{name}去{place}', { name: bond.nickname, place: t(place.name) }), timed: true });
    }
    if (character.birthday && /^\d{1,2}-\d{1,2}$/.test(character.birthday)) {
      const [mm, dd] = character.birthday.split('-').map(Number);
      const y = new Date(now).getFullYear();
      let bd = new Date(y, mm - 1, dd).getTime();
      if (bd < now - 86400_000) bd = new Date(y + 1, mm - 1, dd).getTime();
      out.push({ at: bd, text: t('我的生日'), timed: false });
    }
    return out.sort((a, b) => a.at - b.at).filter((e) => e.at > now - 86400_000).slice(0, 5);
  }, [plans, character, bond.nickname, now]);

  const messages = bond.messages.filter((m) => m.from !== 'system' && !m.recalled && messageContextText(m)).slice(-6);
  const photos = [
    ...(portrait ? [{ id: 'portrait', uri: portrait, caption: undefined as string | undefined }] : []),
    ...album.filter((p) => p.characterId === character.id).map((p) => ({ id: p.id, uri: p.uri, caption: p.caption })),
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{t('{name} 的手机', { name: bond.name })}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <MingCute name="close" size={18} color={Romance.sub} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.lock}>
            <CharAvatar name={bond.name} color={character.color} size={56} characterId={character.id} />
            <Text style={styles.lockName}>{bond.name}</Text>
          </View>

          <Eyebrow label={t('记事本')} />
          <View style={styles.note}>
            {notes.length ? (
              notes.slice(0, 10).map((n) => (
                <View key={n.id} style={styles.noteItem}>
                  <Text style={styles.noteTime}>{timeAgo(n.at)}</Text>
                  <Text style={styles.noteLine}>{n.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>{t('…')}</Text>
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

          <Eyebrow label={t('日历')} />
          <Card style={styles.calCard}>
            {calendar.length ? (
              calendar.map((e, i) => {
                const day = dayParts(e.at);
                return (
                  <View key={i} style={styles.calRow}>
                    <Text style={styles.calDay} numberOfLines={1}>
                      {day.md} <Text style={styles.calWeekday}>{day.wd}</Text>
                    </Text>
                    <Text style={styles.calText} numberOfLines={1}>
                      {e.text}
                    </Text>
                    {e.timed ? <Text style={styles.time}>{planTimeLabel(e.at).replace(/^\S+\s/, '')}</Text> : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.empty}>{t('…')}</Text>
            )}
          </Card>

          <Eyebrow label="Message" />
          <Card style={styles.msgCard}>
            <View style={styles.threadHead}>
              <Text style={styles.threadName}>{bond.nickname}</Text>
              {messages.length ? <Text style={styles.time}>{clockTime(messages[messages.length - 1].at)}</Text> : null}
            </View>
            {messages.length ? (
              messages.map((m) => (
                <Text key={m.id} style={[styles.msgLine, m.from === 'him' && styles.msgLineMine]} numberOfLines={2}>
                  {m.from === 'me' ? bond.nickname : t('我')}：{messageContextText(m)}
                </Text>
              ))
            ) : (
              <Text style={styles.empty}>{t('…')}</Text>
            )}
          </Card>

          <Eyebrow label={t('相册')} />
          {photos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((p) => (
                <Polaroid key={p.id} uri={p.uri} caption={p.caption} width={SHOT_WIDTH} tiltKey={p.id} />
              ))}
            </ScrollView>
          ) : (
            <Card>
              <Text style={styles.empty}>{t('…')}</Text>
            </Card>
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
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 14,
      paddingBottom: 10,
      paddingHorizontal: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    sheetClose: { position: 'absolute', right: 16, top: 14 },
    body: { paddingHorizontal: Space.screen, paddingBottom: 40, gap: Space.inlineLoose },
    lock: { backgroundColor: Romance.accentSoft, borderRadius: Shape.radius, padding: 22, alignItems: 'center', gap: 8 },
    lockName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    eyebrow: { fontSize: 12, color: Romance.sub, letterSpacing: 0.5, marginTop: 8, marginLeft: 4 },
    eyebrowLatin: { fontFamily: Fonts.label },
    eyebrowCjk: { fontWeight: '500' },
    // TA 的记事本：唯一的米色纸面（NOTE_PAPER），描边同卡片
    note: {
      backgroundColor: NOTE_PAPER.bg,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      padding: Space.cardX,
      gap: 10,
    },
    noteItem: { gap: 2 },
    noteTime: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    noteLine: { fontSize: 14, lineHeight: 21, color: NOTE_PAPER.ink },
    noteLocked: { fontSize: 13, color: Romance.faint, letterSpacing: 1 },
    empty: { fontSize: 13, color: Romance.faint },
    calCard: { gap: 8 },
    calRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    calDay: { fontFamily: Fonts.label, fontSize: 12, color: Romance.accent, width: 64 },
    calWeekday: { fontFamily: Fonts.sans },
    calText: { flex: 1, fontSize: 13, color: Romance.ink },
    time: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    msgCard: { gap: 6 },
    threadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    threadName: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    msgLine: { fontSize: 13, lineHeight: 19, color: Romance.sub },
    msgLineMine: { color: Romance.ink },
    photoRow: { gap: Space.inlineLoose, paddingVertical: 6, paddingHorizontal: 2 },
  })
);

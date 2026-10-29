/**
 * Message（D-027；D-100 纸面）：白色通栏列表——结构元素不做卡片。
 * 行 10×14、头像 54、名 16/600、预览 13 muted、时间 Fredoka 11 muted、未读角标 primary r6 高 19 Fredoka 白字；行间 1px line。
 * 加了好友的 + 自己创造、还在认识中的 TA（D-261，名字旁标「认识中」、点进试聊）；交友配对的试聊不入这里。
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { CharAvatar } from '@/components/char-avatar';
import { BlankPolaroid } from '@/components/polaroid';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { clockTime, timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** Fredoka 只给数字与拉丁（D-100）：「昨天」这类中文时间词回落系统字体 */
const LATIN = /^[\x20-\x7E]*$/;

/** 一行会话：羁绊，或自己创造、还在认识中的 TA（D-261） */
type Row = {
  key: string;
  characterId: string;
  name: string;
  messages: ChatMessage[];
  since: number;
  unread: number;
  crush: boolean;
  onPress: () => void;
};

function preview(r: Row): string {
  const last = r.messages[r.messages.length - 1];
  if (!last) return '……';
  // 和会话里的撤回占位同一句（D-223）
  if (last.recalled) return last.from === 'me' ? t('你撤回了一条消息') : t('{name} 撤回了一条消息', { name: r.name });
  if (last.kind === 'voice') return t('▶ 语音消息');
  if (last.kind === 'image') return t('[照片]');
  if (last.kind === 'card') return (last.from === 'me' ? t('你：') : '') + (last.card?.title ?? '');
  if (last.kind === 'system') return last.text;
  return (last.from === 'me' ? t('你：') : '') + last.text;
}

function lastAt(r: Row): number {
  return r.messages[r.messages.length - 1]?.at ?? r.since;
}

function timeLabel(r: Row): string {
  const last = r.messages[r.messages.length - 1];
  if (!last) return '';
  const isToday = new Date(last.at).toDateString() === new Date().toDateString();
  return isToday ? clockTime(last.at) : timeAgo(last.at);
}

export default function MessagesScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const squareChats = useAppStore((s) => s.squareChats);
  // 最近有消息的在最上面（D-223）；没消息的按缔结 / 创造时间
  const sorted = useMemo(() => {
    const bondedIds = new Set(bonds.map((b) => b.characterId));
    const rows: Row[] = [
      ...bonds.map((b) => ({
        key: b.id,
        characterId: b.characterId,
        name: b.name,
        messages: b.messages,
        since: b.createdAt,
        unread: b.unread,
        crush: false,
        onPress: () => router.push({ pathname: '/bond/[bondId]', params: { bondId: b.id } }),
      })),
      // 共享池领来的快照不算她的创作（D-060）
      ...customs
        .filter((c) => !c.shared && !bondedIds.has(c.id))
        .map((c) => {
          const chat = squareChats[c.id];
          return {
            key: c.id,
            characterId: c.id,
            name: c.name,
            messages: chat?.messages ?? [],
            since: chat?.startedAt ?? 0,
            unread: 0,
            crush: true,
            onPress: () => router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } }),
          };
        }),
    ];
    return rows.sort((a, b) => lastAt(b) - lastAt(a));
  }, [bonds, customs, squareChats, router]);

  return (
    <AppScreen title="Messages">
      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <BlankPolaroid icon="chat" tiltKey="messages" />
          <Text style={styles.emptyText}>{t('还没有人住进来。')}</Text>
          <Button label={t('去交友看看')} size="md" style={styles.emptyBtn} onPress={() => router.push('/apps/dating')} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(r) => r.key}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            const time = timeLabel(item);
            return (
              <Pressable style={styles.row} onPress={item.onPress}>
                <CharAvatar
                  name={item.name}
                  color={c?.color ?? Romance.accent}
                  size={Space.avatar.card}
                  characterId={item.characterId}
                />
                <View style={styles.rowBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.crush ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{t('认识中')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {preview(item)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={LATIN.test(time) ? styles.rowTimeLatin : styles.rowTime}>{time}</Text>
                  {item.unread > 0 ? (
                    <View style={styles.unread}>
                      <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  ) : (
                    <View style={styles.unreadGhost} />
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    emptyText: { marginTop: 16, fontSize: Type.scale.sub.size, color: Romance.sub, textAlign: 'center', lineHeight: 22 },
    emptyBtn: { marginTop: 20 },
    // 通栏列表：白底、1px line 分隔，不做卡片
    list: { backgroundColor: Romance.card },
    sep: { height: 1, backgroundColor: Romance.line },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Space.screen,
      paddingVertical: Space.cardY,
    },
    rowBody: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowName: { flexShrink: 1, fontSize: Type.scale.md.size, fontWeight: '600', color: Romance.ink },
    // 「认识中」小标签：同通讯录
    tag: { backgroundColor: Romance.accentSoft, borderRadius: Shape.radiusInner, paddingHorizontal: 7, paddingVertical: 2 },
    tagText: { fontSize: Type.scale.xs.size, fontWeight: '600', color: Romance.accentStrong },
    rowPreview: { fontSize: Type.scale.label.size, color: Romance.sub, marginTop: 3 },
    rowRight: { alignItems: 'flex-end', gap: 5 },
    rowTime: { fontSize: Type.scale.timestamp.size, fontWeight: '500', color: Romance.sub },
    rowTimeLatin: { fontFamily: Fonts.label, fontSize: Type.scale.timestamp.size, color: Romance.sub },
    // 未读角标：primary r6、高 19、Fredoka 白字；没有未读留同高占位，时间才能对齐
    unread: {
      minWidth: 19,
      height: 19,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    unreadText: { fontFamily: Fonts.labelBold, fontSize: Type.scale.timestamp.size, color: '#FFFFFF' },
    unreadGhost: { height: 19 },
  })
);

/**
 * Message（D-027；D-100 纸面）：白色通栏列表——结构元素不做卡片。
 * 行 10×14、头像 54、名 16/600、预览 13 muted、时间 Fredoka 11 muted、未读角标 primary r6 高 19 Fredoka 白字；行间 1px line。
 * 全部是加了好友的（交友配对的试聊不入这里）。
 */

import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { CharAvatar } from '@/components/char-avatar';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { clockTime, timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Bond } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** Fredoka 只给数字与拉丁（D-100）：「昨天」这类中文时间词回落系统字体 */
const LATIN = /^[\x20-\x7E]*$/;

function preview(b: Bond): string {
  const last = b.messages[b.messages.length - 1];
  if (!last) return '……';
  if (last.recalled) return last.from === 'me' ? t('你撤回了一条消息') : t('对方撤回了一条消息');
  if (last.kind === 'voice') return t('▶ 语音消息');
  if (last.kind === 'image') return t('[照片]');
  if (last.kind === 'card') return (last.from === 'me' ? t('你：') : '') + (last.card?.title ?? '');
  if (last.kind === 'system') return last.text;
  return (last.from === 'me' ? t('你：') : '') + last.text;
}

function timeLabel(b: Bond): string {
  const last = b.messages[b.messages.length - 1];
  if (!last) return '';
  const isToday = new Date(last.at).toDateString() === new Date().toDateString();
  return isToday ? clockTime(last.at) : timeAgo(last.at);
}

export default function MessagesScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);

  return (
    <AppScreen title="Message">
      {bonds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHeart}>♡</Text>
          <Text style={styles.emptyText}>{t('还没有人住进来。')}</Text>
          <Button label={t('去交友看看')} size="md" style={styles.emptyBtn} onPress={() => router.push('/apps/dating')} />
        </View>
      ) : (
        <FlatList
          data={bonds}
          keyExtractor={(b) => b.id}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            const time = timeLabel(item);
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push({ pathname: '/bond/[bondId]', params: { bondId: item.id } })}>
                <CharAvatar
                  name={item.name}
                  color={c?.color ?? Romance.accent}
                  size={Space.avatar.card}
                  characterId={item.characterId}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
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
    emptyHeart: { fontSize: 48, color: Romance.accent, marginBottom: 12 },
    emptyText: { fontSize: 14, color: Romance.sub, textAlign: 'center', lineHeight: 22 },
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
    rowName: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    rowPreview: { fontSize: 13, color: Romance.sub, marginTop: 3 },
    rowRight: { alignItems: 'flex-end', gap: 5 },
    rowTime: { fontSize: 11, fontWeight: '500', color: Romance.sub },
    rowTimeLatin: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
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
    unreadText: { fontFamily: Fonts.labelBold, fontSize: 11, color: '#FFFFFF' },
    unreadGhost: { height: 19 },
  })
);

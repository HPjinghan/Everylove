/**
 * Message：模拟 LINE 的聊天列表（D-027）——白底通栏行、细分割线、右侧时间 + 绿色未读角标。
 * 全部是加了好友的（缘分搭话不入这里）。
 */

import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { Romance } from '@/constants/theme';
import { clockTime, timeAgo } from '@/lib/format';
import type { Bond } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

function preview(b: Bond): string {
  const last = b.messages[b.messages.length - 1];
  if (!last) return '……';
  if (last.kind === 'voice') return '▶ 语音消息';
  if (last.kind === 'image') return '[照片]';
  if (last.kind === 'system') return last.text;
  return (last.from === 'me' ? '你：' : '') + last.text;
}

function timeLabel(b: Bond): string {
  const last = b.messages[b.messages.length - 1];
  if (!last) return '';
  const isToday = new Date(last.at).toDateString() === new Date().toDateString();
  return isToday ? clockTime(last.at) : timeAgo(last.at);
}

function arrivalPill(b: Bond): string | null {
  if (!b.arrivalAt || b.arrivalAt <= Date.now()) return null;
  const arrival = new Date(b.arrivalAt);
  const today = arrival.toDateString() === new Date().toDateString();
  return today ? '今晚 20:00 来找你' : '明晚 20:00 来找你';
}

export default function MessagesScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);

  return (
    <AppScreen title="Message">
      {bonds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHeart}>♡</Text>
          <Text style={styles.emptyText}>
            广场里聊得来的人，{'\n'}交换联系方式后就会住进这里。
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/apps/dating')}>
            <Text style={styles.emptyBtnText}>去广场逛逛</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bonds}
          keyExtractor={(b) => b.id}
          style={styles.listBg}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            const pill = arrivalPill(item);
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/bond/[bondId]', params: { bondId: item.id } })
                }>
                <CharAvatar name={item.name} color={c?.color ?? Romance.accent} size={54} characterId={item.characterId} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {preview(item)}
                  </Text>
                  {pill && <Text style={styles.arrivalHint}>{pill}</Text>}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowTime}>{timeLabel(item)}</Text>
                  {item.unread > 0 && (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
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

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyHeart: { fontSize: 48, color: Romance.accent, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Romance.sub, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: '#06C755',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // LINE 式列表：白底通栏、细分割线
  listBg: { backgroundColor: '#FFFFFF' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECEEF1', marginLeft: 82 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#111111' },
  rowPreview: { fontSize: 13, color: '#8E97A3', marginTop: 3 },
  arrivalHint: { fontSize: 11, color: '#06C755', marginTop: 3, fontWeight: '500' },
  rowRight: { alignItems: 'flex-end', gap: 5 },
  rowTime: { fontSize: 11, color: '#B3BAC4' },
  unreadDot: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#06C755',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});

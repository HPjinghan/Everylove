/**
 * 消息：通讯录形态，全部是领回家的（广场搭话不入此 tab）。
 */

import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { Romance } from '@/constants/theme';
import { clockTime, timeAgo } from '@/lib/format';
import type { Bond } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

function preview(b: Bond): string {
  const last = b.messages[b.messages.length - 1];
  if (!last) return '……';
  if (last.kind === 'voice') return '▶ 语音消息';
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>消息</Text>
      {bonds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHeart}>♡</Text>
          <Text style={styles.emptyText}>
            广场里聊得来的人，{'\n'}交换联系方式后就会住进这里。
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.emptyBtnText}>去广场逛逛</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bonds}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const c = findCharacter(item.characterId);
            const pill = arrivalPill(item);
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/bond/[bondId]', params: { bondId: item.id } })
                }>
                <CharAvatar name={item.name} color={c?.color ?? Romance.accent} size={50} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowTime}>{timeLabel(item)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {preview(item)}
                    </Text>
                    {item.unread > 0 && (
                      <View style={styles.unreadDot}>
                        <Text style={styles.unreadText}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                  {pill && (
                    <View style={styles.arrivalPill}>
                      <Text style={styles.arrivalPillText}>{pill}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Romance.ink,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyHeart: { fontSize: 48, color: Romance.accent, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Romance.sub, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: Romance.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 16, fontWeight: '600', color: Romance.ink },
  rowTime: { fontSize: 11, color: Romance.faint },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  rowPreview: { flex: 1, fontSize: 13, color: Romance.sub },
  unreadDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Romance.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  arrivalPill: {
    alignSelf: 'flex-start',
    backgroundColor: Romance.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  arrivalPillText: { fontSize: 10, color: Romance.accent, fontWeight: '600' },
});

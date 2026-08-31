/**
 * 通讯录（D-020/D-027/D-032/D-052）：加了好友的 TA 们 + 你创造的、还在「心动中」的 TA。
 * 自创角色发布即入册（带 tag 的暧昧期）：心动满 100 才缔结占槽、开始羁绊等级。
 * 认识新的人去「交友」；这里是家里的通讯录。
 */

import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, View, Pressable } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { HEART_FULL, levelLabel as levelLabelOf } from '@/lib/bond';
import { CHARACTERS } from '@/content/characters';
import { Romance, themed } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function ContactsScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const squareChats = useAppStore((s) => s.squareChats);

  const bondedIds = new Set(bonds.map((b) => b.characterId));
  // 心动中（D-052）：你创造的、还没确定关系的 TA（共享池快照不算你的创作，D-060）
  const crushes = customs.filter((c) => !bondedIds.has(c.id) && !c.shared);

  const sections = [
    {
      data: [
        ...bonds.map((b) => ({
          key: b.id,
          characterId: b.characterId,
          name: b.name,
          sub: levelLabelOf(b.affinity),
          tag: undefined as string | undefined,
          onPress: () => router.push({ pathname: '/bond/[bondId]', params: { bondId: b.id } }),
        })),
        ...crushes.map((c) => ({
          key: c.id,
          characterId: c.id,
          name: c.name,
          sub: `心动 ${Math.min(HEART_FULL, squareChats[c.id]?.heart ?? 0)}/${HEART_FULL} · 满了 TA 会想和你确定关系`,
          tag: '心动中' as string | undefined,
          onPress: () =>
            router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } }),
        })),
      ],
    },
  ].filter((s) => s.data.length > 0);

  const colorOf = (characterId: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === characterId)?.color ?? Romance.accent;

  return (
    <AppScreen title="通讯录">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={item.onPress}>
            <CharAvatar
              name={item.name}
              color={colorOf(item.characterId)}
              size={44}
              characterId={item.characterId}
            />
            <View style={styles.rowText}>
              <View style={styles.nameRow}>
                <Text style={styles.rowName}>{item.name}</Text>
                {item.tag ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.tag}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>这里还空着。{'\n'}去「交友」滑到心动，再和 TA 加好友。</Text>
        }
      />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: 14, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 12,
      marginBottom: 8,
    },
    rowText: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tag: {
      backgroundColor: Romance.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    tagText: { fontSize: 10, fontWeight: '700', color: Romance.accent },
    rowName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    empty: { textAlign: 'center', color: Romance.faint, marginTop: 60, fontSize: 13 },
  })
);

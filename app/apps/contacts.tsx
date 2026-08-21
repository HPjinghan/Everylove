/**
 * 通讯录（D-020/D-027）：只有缔结契约（领养）的人。
 * 认识新的人去「缘分」；这里是家里的通讯录。
 */

import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, View, Pressable } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { CHARACTERS } from '@/content/characters';
import { Romance } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function ContactsScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);

  const sections = [
    {
      title: `缔结契约的（${bonds.length}）`,
      data: bonds.map((b) => ({
        key: b.id,
        characterId: b.characterId,
        name: b.name,
        sub: `♥ ${b.affinity}`,
        onPress: () => router.push({ pathname: '/bond/[bondId]', params: { bondId: b.id } }),
      })),
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
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={item.onPress}>
            <CharAvatar
              name={item.name}
              color={colorOf(item.characterId)}
              size={44}
              characterId={item.characterId}
            />
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>还没有缔结契约的人。{'\n'}去「缘分」认识、聊到心动，再和 TA 加好友。</Text>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Romance.sub,
    marginTop: 14,
    marginBottom: 6,
  },
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
  rowName: { fontSize: 15, fontWeight: '600', color: Romance.ink },
  rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
  empty: { textAlign: 'center', color: Romance.faint, marginTop: 60, fontSize: 13 },
});

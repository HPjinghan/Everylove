/**
 * 通讯录（D-020/D-027/D-032/D-052；D-100 纸面）：加了好友的 TA 们 + 你创造的、还在「心动中」的 TA。
 * 白卡描边行：头像 44、名 15/600、「心动中」标签（accentSoft 底 accent 10/600 r4）、副文 12 muted，数字 Fredoka。无分组标题。
 * 自创角色发布即入册（带 tag 的暧昧期）：心动满 100 才缔结占槽、开始羁绊等级。认识新的人去「交友」；这里是家里的通讯录。
 */

import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { HEART_FULL, levelInfo } from '@/lib/bond';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

type Entry = {
  key: string;
  characterId: string;
  name: string;
  onPress: () => void;
} & ({ kind: 'bond'; level: number; levelName: string } | { kind: 'crush'; heart: number });

export default function ContactsScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const squareChats = useAppStore((s) => s.squareChats);

  const bondedIds = new Set(bonds.map((b) => b.characterId));
  // 心动中（D-052）：你创造的、还没确定关系的 TA（共享池快照不算你的创作，D-060）
  const crushes = customs.filter((c) => !bondedIds.has(c.id) && !c.shared);

  const entries: Entry[] = [
    ...bonds.map((b) => {
      const lv = levelInfo(b.affinity);
      return {
        key: b.id,
        characterId: b.characterId,
        name: b.name,
        kind: 'bond' as const,
        level: lv.level,
        levelName: lv.name,
        onPress: () => router.push({ pathname: '/bond/[bondId]', params: { bondId: b.id } }),
      };
    }),
    ...crushes.map((c) => ({
      key: c.id,
      characterId: c.id,
      name: c.name,
      kind: 'crush' as const,
      heart: Math.min(HEART_FULL, squareChats[c.id]?.heart ?? 0),
      onPress: () => router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } }),
    })),
  ];

  const colorOf = (characterId: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === characterId)?.color ?? Romance.accent;

  return (
    <AppScreen title={t('通讯录')}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={item.onPress}>
            <Card style={styles.row}>
              <CharAvatar name={item.name} color={colorOf(item.characterId)} size={44} characterId={item.characterId} />
              <View style={styles.rowText}>
                <View style={styles.nameRow}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.kind === 'crush' ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{t('心动中')}</Text>
                    </View>
                  ) : null}
                </View>
                {item.kind === 'bond' ? (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {t('羁绊')} <Text style={styles.rowSubNum}>LV{item.level}</Text> · {t(item.levelName)}
                  </Text>
                ) : (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {t('心动')}{' '}
                    <Text style={styles.rowSubNum}>
                      {item.heart}/{HEART_FULL}
                    </Text>
                  </Text>
                )}
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('这里还空着。')}</Text>}
      />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: Space.screen, paddingBottom: 40, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowName: { fontSize: 15, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    // 「心动中」标签：accentSoft 底、accent 字、内层圆角 4
    tag: {
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    tagText: { fontSize: 10, fontWeight: '600', color: Romance.accentStrong },
    rowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    rowSubNum: { fontFamily: Fonts.label },
    empty: { textAlign: 'center', color: Romance.sub, marginTop: 60, fontSize: 13 },
  })
);

/**
 * 传记 App（D-149）：已缔结 TA 的故事，只看——每位 TA 一本，按章连载；创作者在创造里写、设每章开放的羁绊等级。
 * 第一屏：缔结的 TA 一人一张白卡（立绘 48、名字、身份、几章 / 还没有传记）→ 点进章节列表（app/story/[bondId]）。
 * 章节读的是角色的现行版本（lib/story.ts），进页顺手刷一次共享池，别人续写的章节能到。
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { refreshSharedPool } from '@/lib/pool';
import { chaptersForBond, liveCharacterFor } from '@/lib/story';
import { useAppStore } from '@/store/app-store';

export default function BiographyScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customCharacters = useAppStore((s) => s.customCharacters);
  const sharedPool = useAppStore((s) => s.sharedPool);

  useEffect(() => {
    void refreshSharedPool();
  }, []);

  const sources = { customCharacters, sharedPool };
  const rows = [...bonds].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <AppScreen title={t('传记')}>
      <ScrollView contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('还没有人的故事可以翻开')}</Text>
          </View>
        ) : (
          rows.map((b) => {
            const c = liveCharacterFor(b, sources);
            const chapters = chaptersForBond(b, sources);
            const color = c?.color ?? Romance.accent;
            return (
              <Pressable key={b.id} onPress={() => router.push({ pathname: '/story/[bondId]', params: { bondId: b.id } } as never)}>
                <Card style={styles.row}>
                  <CharAvatar name={b.name} color={color} size={48} characterId={b.characterId} />
                  <View style={styles.text}>
                    <Text style={styles.name} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {c?.identity ?? ''}
                    </Text>
                  </View>
                  {chapters.length ? (
                    <Text style={styles.count}>
                      <Text style={styles.countNum}>{chapters.length}</Text> {t('章')}
                    </Text>
                  ) : (
                    <Text style={styles.none}>{t('还没有传记')}</Text>
                  )}
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    list: { padding: Space.screen, gap: Space.inline, paddingBottom: 40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    text: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    count: { fontSize: 12, color: Romance.sub },
    countNum: { fontFamily: Fonts.label, fontSize: 14, color: Romance.ink },
    none: { fontSize: 12, color: Romance.faint },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: Romance.sub },
  })
);

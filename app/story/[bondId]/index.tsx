/**
 * 一位 TA 的传记——章节列表（D-149）：每章一张白卡（标题 15/600 + 第一段预览 12 muted）；
 * 还没开放的章节灰掉、右侧一把小锁 + 需要的羁绊 LV（只标数字，不解释）；开放的点进阅读页。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { MingCute } from '@/components/mingcute';
import { Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { chapterOpen, chaptersForBond, chapterText } from '@/lib/story';
import { useAppStore } from '@/store/app-store';

export default function StoryChaptersScreen() {
  const router = useRouter();
  const { bondId } = useLocalSearchParams<{ bondId: string }>();
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === bondId));
  const customCharacters = useAppStore((s) => s.customCharacters);
  const sharedPool = useAppStore((s) => s.sharedPool);
  if (!bond) return <AppScreen title={t('传记')}>{null}</AppScreen>;

  const chapters = chaptersForBond(bond, { customCharacters, sharedPool });

  return (
    <AppScreen title={bond.name}>
      <ScrollView contentContainerStyle={styles.list}>
        {chapters.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('还没有传记')}</Text>
          </View>
        ) : (
          chapters.map((ch, i) => {
            const open = chapterOpen(bond, ch);
            const preview = chapterText(ch).split('\n')[0] ?? '';
            return (
              <Pressable
                key={ch.id}
                disabled={!open}
                onPress={() => router.push({ pathname: '/story/[bondId]/[chapterId]', params: { bondId: bond.id, chapterId: ch.id } } as never)}>
                <Card style={[styles.row, !open && styles.rowLocked]}>
                  <Text style={styles.index}>{i + 1}</Text>
                  <View style={styles.text}>
                    <Text style={styles.title} numberOfLines={1}>
                      {ch.title}
                    </Text>
                    {open ? (
                      <Text style={styles.preview} numberOfLines={2}>
                        {preview}
                      </Text>
                    ) : null}
                  </View>
                  {open ? null : (
                    <View style={styles.lock}>
                      <MingCute name="lock" size={16} color={Romance.faint} />
                      <Text style={styles.lockLevel}>LV{ch.unlockLevel}</Text>
                    </View>
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
    rowLocked: { opacity: 0.55 },
    index: { fontFamily: Fonts.label, fontSize: 18, color: Romance.faint, width: 22, textAlign: 'center' },
    text: { flex: 1, minWidth: 0 },
    title: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    preview: { fontSize: 12, color: Romance.sub, marginTop: 3, lineHeight: 17 },
    lock: { alignItems: 'center', gap: 2 },
    lockLevel: { fontFamily: Fonts.label, fontSize: 11, color: Romance.faint },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: Romance.sub },
  })
);

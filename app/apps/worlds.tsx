/**
 * 世界书（D-110；纸面）：TA 所处的世界与 TA 对一切的认知。
 * 列表：第一张永远是「现实世界（当前）」（内置、默认、不用收藏）；下面是她创建的世界，每张白卡 = 名字 + 一句话 + 收藏星。
 * 只有收藏的世界才会出现在创造角色的「TA 所在的世界」里；点卡片进编辑页（app/apps/world-edit.tsx），顶栏右「新建」。
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { REAL_WORLD } from '@/content/worlds';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

export default function WorldsScreen() {
  const router = useRouter();
  const worlds = useAppStore((s) => s.worldBooks);
  const favorites = useAppStore((s) => s.worldFavorites);
  const usedBy = useAppStore((s) => s.customCharacters);
  const countFor = (id: string) => usedBy.filter((c) => !c.shared && c.worldId === id).length;

  return (
    <AppScreen
      title={t('世界书')}
      right={<HeaderAction label={t('新建')} onPress={() => router.push('/apps/world-edit' as never)} />}>
      <ScrollView contentContainerStyle={styles.list}>
        <Card style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.name}>{t(REAL_WORLD.name)}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {t(REAL_WORLD.summary)}
            </Text>
            <Text style={styles.tagDefault}>{t('默认')}</Text>
          </View>
        </Card>

        {worlds.length === 0 ? (
          <Text style={styles.empty}>{t('还没有别的世界。')}</Text>
        ) : (
          [...worlds]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((w) => {
              const fav = favorites.includes(w.id);
              const n = countFor(w.id);
              return (
                <Pressable key={w.id} onPress={() => router.push({ pathname: '/apps/world-edit', params: { id: w.id } } as never)}>
                  <Card style={styles.row}>
                    <View style={styles.text}>
                      <Text style={styles.name} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <Text style={styles.sub} numberOfLines={2}>
                        {w.summary || t('还没写一句话')}
                      </Text>
                      <View style={styles.tags}>
                        {fav ? <Text style={styles.tagFav}>{t('已收藏')}</Text> : null}
                        {n > 0 ? <Text style={styles.tag}>{t('{n} 位 TA 住在这里', { n })}</Text> : null}
                      </View>
                    </View>
                    <Pressable hitSlop={10} onPress={() => useAppStore.getState().toggleWorldFavorite(w.id)}>
                      <Text style={[styles.star, fav && styles.starOn]}>{fav ? '★' : '☆'}</Text>
                    </Pressable>
                  </Card>
                </Pressable>
              );
            })
        )}
        <Text style={styles.note}>{t('收藏的世界才会出现在创造角色的选项里。')}</Text>
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
    sub: { fontSize: 12, color: Romance.sub, marginTop: 2, lineHeight: 17 },
    tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
    tag: {
      fontSize: 11,
      fontWeight: '500',
      color: Romance.sub,
      backgroundColor: Romance.line,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    tagFav: {
      fontSize: 11,
      fontWeight: '500',
      color: Romance.accentStrong,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    tagDefault: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '500',
      color: Romance.accentStrong,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
      marginTop: 6,
    },
    star: { fontSize: 22, color: Romance.faint, paddingHorizontal: 4 },
    starOn: { color: Romance.accent },
    empty: { textAlign: 'center', color: Romance.sub, fontSize: 13, marginTop: 16 },
    note: { textAlign: 'center', color: Romance.faint, fontSize: 11, marginTop: 12 },
  })
);

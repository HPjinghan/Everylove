/**
 * 我创建的（D-095）：自创角色的列表页——从创造页顶部搬出来（角色一多顶部就撑不住）。
 * 每行：立绘头像、名字、身份、状态（心动中 / 已缔结）、公开 / 私密；「编辑」带参数打开创造页回填
 * （D-050 的全部字段 + D-094 的台词都在那里改）。入口：创造页顶部一行、设置 → 我的创作。
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

export default function MyCharactersScreen() {
  const router = useRouter();
  const customs = useAppStore((s) => s.customCharacters);
  const bonds = useAppStore((s) => s.bonds);
  // 共享池领来的快照不算你的创作（D-060）
  const mine = customs.filter((c) => !c.shared);
  const bondedIds = new Set(bonds.map((b) => b.characterId));

  return (
    <AppScreen title={t('我创建的')}>
      <ScrollView contentContainerStyle={styles.list}>
        {mine.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('还没有创造过 TA')}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.replace('/apps/create' as never)}>
              <Text style={styles.primaryBtnText}>{t('去创造一个')}</Text>
            </Pressable>
          </View>
        ) : (
          mine.map((c) => {
            const bonded = bondedIds.has(c.id);
            return (
              <Card key={c.id} style={styles.row}>
                <CharAvatar name={c.name} color={c.color} size={48} characterId={c.id} />
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {c.identity}
                  </Text>
                  <View style={styles.tags}>
                    <Text style={[styles.tag, bonded && styles.tagBonded]}>{bonded ? t('已缔结') : t('心动中')}</Text>
                    <Text style={styles.tag}>{c.visibility === 'public' ? t('公开') : t('私密')}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.editBtn}
                  onPress={() => router.push({ pathname: '/apps/create', params: { edit: c.id } } as never)}>
                  <Text style={styles.editText}>{t('编辑')}</Text>
                </Pressable>
              </Card>
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
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, padding: Space.inline + 2 },
    text: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
    tag: {
      fontFamily: Fonts.label,
      fontSize: 11,
      color: Romance.sub,
      backgroundColor: Romance.line,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    tagBonded: { color: Romance.accent, backgroundColor: Romance.accentSoft },
    editBtn: {
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radius,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    editText: { fontFamily: Fonts.labelBold, fontSize: 13, color: Romance.accent },
    empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
    emptyText: { fontSize: 14, color: Romance.sub },
    primaryBtn: {
      backgroundColor: Romance.accent,
      borderRadius: Shape.radius,
      paddingHorizontal: 22,
      paddingVertical: 11,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  })
);

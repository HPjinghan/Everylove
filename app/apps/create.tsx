/**
 * 创造（D-149 改版为列表；D-095 列表原在「我创建的」；D-100 纸面）：
 * 进来就是自创角色的列表——每行一张白卡：立绘头像 48、名字 15/600、身份 12 muted、状态标签 r4 11
 * （已缔结 = accentSoft 底 accent 字；心动中 / 公开 / 私密 = line 底 muted 字）、右侧「编辑」描边按钮带 edit=<id>
 * 进创造流程回填（app/apps/character-edit.tsx：设定 / 台词 / 传记都在那里改）。
 * 右下角「+」= 新建（primary 圆钮，无阴影无渐变）。入口：桌面「创造」图标、设置 → 我的创作。
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Shape, Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

export default function CreateScreen() {
  const router = useRouter();
  const customs = useAppStore((s) => s.customCharacters);
  const bonds = useAppStore((s) => s.bonds);
  // 共享池领来的快照不算你的创作（D-060）
  const mine = customs.filter((c) => !c.shared);
  const bondedIds = new Set(bonds.map((b) => b.characterId));

  return (
    <AppScreen title={t('创造')}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.list}>
          {mine.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('还没有创造过 TA')}</Text>
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
                      <Text style={[styles.tag, bonded && styles.tagBonded]}>{bonded ? t('已缔结') : t('认识中')}</Text>
                      <Text style={styles.tag}>{c.visibility === 'public' ? t('公开') : t('私密')}</Text>
                      {c.chapters?.length ? <Text style={styles.tag}>{t('传记 {n} 章', { n: c.chapters.length })}</Text> : null}
                    </View>
                  </View>
                  <Button
                    label={t('编辑')}
                    variant="outline"
                    size="sm"
                    onPress={() => router.push({ pathname: '/apps/character-edit', params: { edit: c.id } } as never)}
                  />
                </Card>
              );
            })
          )}
        </ScrollView>
        {/* 新建（D-149）：右下角 primary 圆钮 */}
        <Pressable style={styles.fab} hitSlop={6} onPress={() => router.push('/apps/character-edit' as never)}>
          <MingCute name="plus" size={Space.iconTile} color="#FFFFFF" />
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: Space.screen, gap: Space.inline, paddingBottom: 120 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose },
    text: { flex: 1, minWidth: 0 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    sub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    // 状态标签：中文走系统字体 11/500，r4 小标签
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
    tagBonded: { color: Romance.accentStrong, backgroundColor: Romance.accentSoft },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: Romance.sub },
    // 右下角圆钮：appTile 大小、primary 底、1.5 描边同按钮
    fab: {
      position: 'absolute',
      right: Space.screen + Space.inline,
      bottom: Space.dockBottom,
      width: Space.appTile,
      height: Space.appTile,
      borderRadius: Space.appTile / 2,
      backgroundColor: Romance.accent,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);

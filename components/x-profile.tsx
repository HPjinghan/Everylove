/**
 * TA 在 X 上的主页（D-252）：点时间线里 TA 的头像进来——角色色横幅 + 圆头像压在边上、名字 / @handle / 一句身份、帖子数，
 * 下面只列 TA 自己的帖子（同时间线一样能评论、点赞）。右上「资料」打开原来的资料卡（立绘、身份、钩子、见过面）。
 */

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { CharacterSheet } from '@/components/character-sheet';
import { MingCute } from '@/components/mingcute';
import { handleFor, PostRow } from '@/components/x-post-row';
import { Shape, Space, Type } from '@/constants/design';
import { Romance, themed, withAlpha } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { findCharacter, useAppStore } from '@/store/app-store';

const BANNER_H = 110;
const AVATAR = 72;

export function XProfile({ characterId, now, onClose }: { characterId: string | null; now: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const posts = useAppStore((s) => s.posts);
  const bond = useAppStore((s) => (characterId ? s.bonds.find((b) => b.characterId === characterId) : undefined));
  const [sheetOpen, setSheetOpen] = useState(false);
  const c = characterId ? findCharacter(characterId) : undefined;
  const mine = c ? posts.filter((p) => p.characterId === c.id && p.at <= now).sort((a, b) => b.at - a.at) : [];
  const name = bond?.name ?? c?.name ?? '';

  return (
    <Modal visible={!!c} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {c ? (
        <View style={styles.sheet}>
          <FlatList
            data={mine}
            keyExtractor={(p) => p.id}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListHeaderComponent={
              <View>
                <View style={[styles.banner, { backgroundColor: c.color }]}>
                  <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t('关闭')}>
                    <MingCute name="close" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.headRow}>
                  <View style={styles.avatarRing}>
                    <CharAvatar name={name} color={c.color} size={AVATAR} characterId={c.id} round />
                  </View>
                  <Pressable onPress={() => setSheetOpen(true)} style={styles.profileBtn} hitSlop={6}>
                    <Text style={styles.profileBtnText}>{t('资料')}</Text>
                  </Pressable>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.handle}>{handleFor(c)}</Text>
                  <Text style={styles.bio}>{c.identity}</Text>
                  <Text style={styles.count}>{t('{n} 条帖子', { n: mine.length })}</Text>
                </View>
                <View style={styles.separator} />
              </View>
            }
            renderItem={({ item }) => <PostRow post={item} now={now} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <CharacterSheet characterId={c.id} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
        </View>
      ) : null}
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: Romance.card },
    banner: { height: BANNER_H },
    close: {
      position: 'absolute',
      top: 12,
      right: Space.screen,
      width: 32,
      height: 32,
      borderRadius: Shape.radiusPill,
      backgroundColor: withAlpha(Romance.ink, 0.35),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Space.screen, marginTop: -AVATAR / 2 },
    avatarRing: { padding: 3, borderRadius: Shape.radiusPill, backgroundColor: Romance.card },
    profileBtn: {
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      borderRadius: Shape.radiusPill,
      paddingHorizontal: 16,
      paddingVertical: 6,
      marginBottom: 4,
    },
    profileBtnText: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.ink },
    info: { paddingHorizontal: Space.screen, paddingTop: 8, paddingBottom: 14, gap: 2 },
    name: { fontSize: Type.scale.screenTitle.size, fontWeight: '700', color: Romance.ink },
    handle: { fontSize: Type.scale.label.size, color: Romance.sub },
    bio: { fontSize: Type.scale.sub.size, color: Romance.ink, marginTop: 8 },
    count: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 6 },
    separator: { height: 1, backgroundColor: Romance.line },
  })
);

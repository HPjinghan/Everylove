/**
 * TA 的资料页（D-110；纸面）：广场 / X / 现场里点 TA 的头像弹出——立绘（3:4 白框）、名字 + 风格标签、身份、
 * 一句钩子、自介、tag；下面是「见过面」：广场偶遇的记录（在哪、什么时候、聊了什么），TA 自己也记得（进初识 / 广场 prompt）。
 * 已在通讯录的 TA 显示羁绊等级；活在别的世界的 TA 显示世界名。
 */

import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { levelInfo } from '@/lib/bond';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { portraitSource } from '@/lib/imagegen';
import { isRealWorld, worldOf } from '@/lib/worlds';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 立绘宽度（居中，3:4） */
const PORTRAIT_W = 200;

export function CharacterSheet({ characterId, visible, onClose }: { characterId: string | null; visible: boolean; onClose: () => void }) {
  const stored = useAppStore((s) => (characterId ? s.portraits[characterId] : undefined));
  const bond = useAppStore((s) => (characterId ? s.bonds.find((b) => b.characterId === characterId) : undefined));
  const chat = useAppStore((s) => (characterId ? s.squareChats[characterId] : undefined));
  const c = characterId ? findCharacter(characterId) : undefined;
  if (!c) return null;
  const portrait = portraitSource(c.id, stored);
  const name = bond?.name ?? c.name;
  const world = worldOf(c);
  const encounters = [...(chat?.encounters ?? [])].reverse();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <MingCute name="close" size={18} color={Romance.sub} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.portraitWrap}>
            {portrait ? (
              <Image source={portrait} style={styles.portrait} contentFit="cover" transition={200} />
            ) : (
              <CharAvatar name={name} color={c.color} size={PORTRAIT_W} characterId={c.id} />
            )}
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            {c.styleLabel ? <Text style={styles.styleTag}>{c.styleLabel}</Text> : null}
          </View>
          <Text style={styles.identity}>{c.identity}</Text>
          {bond ? (
            <Text style={styles.status}>
              {t('已在通讯录')} · <Text style={styles.statusNum}>LV{levelInfo(bond.affinity).level}</Text>
            </Text>
          ) : null}
          {!isRealWorld(world) ? <Text style={styles.status}>{t('来自「{world}」', { world: world.name })}</Text> : null}

          <Card style={styles.card}>
            <Text style={styles.hook}>「{c.hook}」</Text>
            <Text style={styles.intro}>{c.intro}</Text>
            {c.tags.length ? (
              <View style={styles.tags}>
                {c.tags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>

          <Text style={styles.eyebrow}>{t('见过面')}</Text>
          {encounters.length ? (
            <Card style={styles.card}>
              {encounters.map((e, i) => (
                <View key={i} style={[styles.encounter, i > 0 && styles.encounterGap]}>
                  <Text style={styles.encounterHead}>
                    {t(e.placeName)} · <Text style={styles.encounterTime}>{timeAgo(e.at)}</Text>
                  </Text>
                  <Text style={styles.encounterText} numberOfLines={4}>
                    {e.summary}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Text style={styles.empty}>{bond ? t('你们已经很熟了。') : t('还没在广场上碰到过。')}</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: Romance.bg },
    header: { alignItems: 'center', justifyContent: 'center', paddingTop: 14, paddingBottom: 10, paddingHorizontal: 16 },
    title: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    close: { position: 'absolute', right: 16, top: 14 },
    body: { paddingHorizontal: Space.screen, paddingBottom: 40, gap: Space.inlineLoose },
    portraitWrap: { alignItems: 'center', marginTop: 4 },
    portrait: {
      width: PORTRAIT_W,
      height: (PORTRAIT_W * 4) / 3,
      borderRadius: Shape.radius,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      backgroundColor: Romance.card,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.inline, marginTop: 4 },
    name: { fontSize: 20, fontWeight: '600', color: Romance.ink },
    styleTag: {
      fontSize: 11,
      fontWeight: '500',
      color: Romance.accentStrong,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    identity: { textAlign: 'center', fontSize: 13, color: Romance.sub },
    status: { textAlign: 'center', fontSize: 12, color: Romance.accent, fontWeight: '500' },
    statusNum: { fontFamily: Fonts.label },
    card: { gap: 8 },
    hook: { fontSize: 15, fontWeight: '600', color: Romance.ink, lineHeight: 22 },
    intro: { fontSize: 13, lineHeight: 20, color: Romance.sub },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
    eyebrow: { fontSize: 12, fontWeight: '500', color: Romance.sub, letterSpacing: 0.5, marginTop: 6, marginLeft: 4 },
    encounter: { gap: 3 },
    encounterGap: { marginTop: 4, paddingTop: 8, borderTopWidth: Shape.stroke, borderTopColor: Romance.line },
    encounterHead: { fontSize: 13, fontWeight: '600', color: Romance.ink },
    encounterTime: { fontFamily: Fonts.label, fontWeight: '400', color: Romance.sub },
    encounterText: { fontSize: 13, lineHeight: 19, color: Romance.sub },
    empty: { fontSize: 13, color: Romance.faint, marginLeft: 4 },
  })
);

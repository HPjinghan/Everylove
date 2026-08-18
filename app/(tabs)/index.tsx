/**
 * 广场：双列瀑布流，角色卡 + 角色公开动态混排。即点即聊。
 * 搭话记录不入消息 tab、会过期——免费层的天花板是商业决策。
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CHARACTERS } from '@/content/characters';
import { Romance } from '@/constants/theme';
import { adoptedCountLabel, timeAgo } from '@/lib/format';
import type { Character, Post } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const CHIPS = [
  { key: 'all', label: '推荐' },
  { key: 'male', label: '男生' },
  { key: 'female', label: '女生' },
  { key: 'nonhuman', label: '非人类' },
  { key: 'custom', label: '自创' },
] as const;

type ChipKey = (typeof CHIPS)[number]['key'];

type SquareItem = { type: 'char'; c: Character } | { type: 'post'; p: Post };

function CharacterCard({
  c,
  status,
  onPress,
}: {
  c: Character;
  status: 'adopted' | 'chatted' | 'new';
  onPress: () => void;
}) {
  if (c.teaser) {
    return (
      <Pressable onPress={onPress} style={[styles.card, { backgroundColor: Romance.night }]}>
        <View style={styles.teaserBadge}>
          <Text style={styles.teaserBadgeText}>即将降临</Text>
        </View>
        <CharAvatar name={c.name} color={c.color} size={56} style={styles.cardAvatar} characterId={c.id} />
        <Text style={[styles.cardName, { color: '#fff' }]}>{c.name}</Text>
        <Text style={[styles.cardIdentity, { color: '#B8AECB' }]}>{c.identity}</Text>
        <Text style={[styles.cardHook, { color: '#D8CFE8' }]}>「{c.hook}」</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: c.colorSoft }]}>
      <CharAvatar name={c.name} color={c.color} size={56} style={styles.cardAvatar} characterId={c.id} />
      <Text style={styles.cardName}>{c.name}</Text>
      <Text style={styles.cardIdentity}>{c.identity}</Text>
      <Text style={styles.cardHook}>「{c.hook}」</Text>
      <View style={styles.tagRow}>
        {c.tags.slice(0, 3).map((t) => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.adoptCount}>
          {c.custom ? '你的创作' : adoptedCountLabel(c.adoptedCount)}
        </Text>
        <View
          style={[
            styles.chatPill,
            status === 'adopted' && { backgroundColor: Romance.gold },
            status !== 'new' && status !== 'adopted' && { backgroundColor: c.color },
          ]}>
          <Text style={styles.chatPillText}>
            {status === 'adopted' ? '去找他' : status === 'chatted' ? '继续聊' : '搭话'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function SquarePostCard({
  p,
  c,
  onPress,
}: {
  p: Post;
  c: Character;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
      <View style={styles.postHead}>
        <CharAvatar name={c.name} color={c.color} size={30} characterId={c.id} />
        <View style={styles.postHeadText}>
          <Text style={styles.postName}>{c.name}</Text>
          <Text style={styles.postMeta}>广场动态 · {timeAgo(p.at)}</Text>
        </View>
      </View>
      <Text style={styles.postBody}>{p.text}</Text>
      <View style={styles.postFooter}>
        <IconSymbol name="heart" size={13} color={Romance.faint} />
        <Text style={styles.postLikes}>{p.likes}</Text>
        <Text style={styles.postGo}>去搭话 ›</Text>
      </View>
    </Pressable>
  );
}

export default function SquareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [chip, setChip] = useState<ChipKey>('all');
  const customs = useAppStore((s) => s.customCharacters);
  const bonds = useAppStore((s) => s.bonds);
  const squareChats = useAppStore((s) => s.squareChats);
  const lovePref = useAppStore((s) => s.lovePref);
  const allPosts = useAppStore((s) => s.posts);
  const squarePosts = useMemo(() => allPosts.filter((p) => !p.bondId), [allPosts]);

  const items = useMemo(() => {
    const all = [...customs, ...CHARACTERS];
    let chars =
      chip === 'all'
        ? all
        : chip === 'custom'
          ? customs
          : all.filter((c) => c.loveTag === chip);
    // 推荐流按 onboarding 口味置顶（火力女频先行，架构全性向）
    if (chip === 'all' && lovePref && lovePref !== 'any') {
      chars = [...chars].sort(
        (a, b) => Number(b.loveTag === lovePref) - Number(a.loveTag === lovePref)
      );
    }
    const charIds = new Set(chars.map((c) => c.id));
    const posts = squarePosts.filter((p) => charIds.has(p.characterId));
    const mixed: SquareItem[] = [];
    let pi = 0;
    chars.forEach((c, i) => {
      mixed.push({ type: 'char', c });
      if ((i + 1) % 2 === 0 && pi < posts.length) {
        mixed.push({ type: 'post', p: posts[pi++] });
      }
    });
    while (pi < posts.length) mixed.push({ type: 'post', p: posts[pi++] });
    return mixed;
  }, [chip, customs, squarePosts, lovePref]);

  const colA = items.filter((_, i) => i % 2 === 0);
  const colB = items.filter((_, i) => i % 2 === 1);

  const openCharacter = (c: Character) => {
    const bond = bonds.find((b) => b.characterId === c.id);
    if (bond) {
      router.push({ pathname: '/bond/[bondId]', params: { bondId: bond.id } });
      return;
    }
    if (c.teaser) {
      Alert.alert('他还未降临', '有什么东西正朝你走来。再等等。');
      return;
    }
    router.push({ pathname: '/chat/[characterId]', params: { characterId: c.id } });
  };

  const statusOf = (c: Character) =>
    bonds.some((b) => b.characterId === c.id)
      ? ('adopted' as const)
      : squareChats[c.id]?.messages.length
        ? ('chatted' as const)
        : ('new' as const);

  const renderItem = (item: SquareItem, key: string) =>
    item.type === 'char' ? (
      <CharacterCard
        key={key}
        c={item.c}
        status={statusOf(item.c)}
        onPress={() => openCharacter(item.c)}
      />
    ) : (
      <SquarePostCard
        key={key}
        p={item.p}
        c={[...customs, ...CHARACTERS].find((c) => c.id === item.p.characterId)!}
        onPress={() =>
          openCharacter([...customs, ...CHARACTERS].find((c) => c.id === item.p.characterId)!)
        }
      />
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>广场</Text>
      <Text style={styles.subtitle}>这里人人都接你的话</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}>
        {CHIPS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setChip(c.key)}
            style={[styles.chip, chip === c.key && styles.chipActive]}>
            <Text style={[styles.chipText, chip === c.key && styles.chipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
        <View style={styles.columns}>
          <View style={styles.column}>{colA.map((it, i) => renderItem(it, `a${i}`))}</View>
          <View style={styles.column}>{colB.map((it, i) => renderItem(it, `b${i}`))}</View>
        </View>
        {items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>这里还空着。去捏＋里创造第一个他吧。</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg },
  title: { fontSize: 28, fontWeight: '700', color: Romance.ink, paddingHorizontal: 18 },
  subtitle: { fontSize: 13, color: Romance.sub, paddingHorizontal: 18, marginTop: 2 },
  chipScroll: { flexGrow: 0, marginTop: 12 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: Romance.accent },
  chipText: { fontSize: 13, color: Romance.sub },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  feed: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },
  columns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 10 },
  card: {
    borderRadius: 20,
    padding: 14,
  },
  cardAvatar: { marginBottom: 10 },
  cardName: { fontSize: 17, fontWeight: '700', color: Romance.ink },
  cardIdentity: { fontSize: 11, color: Romance.sub, marginTop: 2 },
  cardHook: { fontSize: 13, color: Romance.ink, lineHeight: 19, marginTop: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: { fontSize: 10, color: Romance.sub },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  adoptCount: { fontSize: 10, color: Romance.sub, flexShrink: 1 },
  chatPill: {
    backgroundColor: Romance.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chatPillText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  teaserBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 10,
  },
  teaserBadgeText: { fontSize: 10, color: '#D8CFE8' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postHeadText: { flex: 1 },
  postName: { fontSize: 13, fontWeight: '600', color: Romance.ink },
  postMeta: { fontSize: 10, color: Romance.faint },
  postBody: { fontSize: 13, color: Romance.ink, lineHeight: 19, marginTop: 8 },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  postLikes: { fontSize: 11, color: Romance.faint, flex: 1 },
  postGo: { fontSize: 11, color: Romance.accent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 13, color: Romance.sub },
});

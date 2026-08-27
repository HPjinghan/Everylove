/**
 * 朋友圈：只有缔结契约（领养）的 TA 们的帖子流（D-027）。「偷看」的家。
 * TA 会回你的评论。想看更多人？先去「交友」和 TA 加好友。
 */

import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance, themed } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import type { Post } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

function PostCard({ post }: { post: Post }) {
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const character = findCharacter(post.characterId);
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === post.bondId));
  if (!character) return null;
  const displayName = bond?.name ?? character.name;
  const canComment = !!post.bondId;

  const submitComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setCommentDraft('');
    useAppStore.getState().addMyComment(post.id, text);
    setTimeout(() => useAppStore.getState().addHisReply(post.id), 1400);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <CharAvatar name={displayName} color={character.color} size={38} characterId={character.id} />
        <View style={styles.headText}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.meta}>
            {post.bondId ? '只有你能看到' : '加好友前的动态'} · {timeAgo(post.at)}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>{post.text}</Text>
      <View style={styles.actions}>
        <Pressable
          style={styles.action}
          onPress={() => useAppStore.getState().toggleLike(post.id)}>
          <IconSymbol
            name={post.liked ? 'heart.fill' : 'heart'}
            size={17}
            color={post.liked ? Romance.accent : Romance.faint}
          />
          <Text style={[styles.actionText, post.liked && { color: Romance.accent }]}>
            {post.likes}
          </Text>
        </Pressable>
        <Pressable
          style={styles.action}
          onPress={() => canComment && setCommentOpen((v) => !v)}>
          <IconSymbol name="bubble.right" size={16} color={Romance.faint} />
          <Text style={styles.actionText}>
            {canComment ? post.comments.length || '评论' : '加好友前的动态，只能看看'}
          </Text>
        </Pressable>
      </View>
      {post.comments.map((c) => (
        <View key={c.id} style={styles.comment}>
          <Text style={styles.commentFrom}>{c.from === 'me' ? '你' : displayName}</Text>
          <Text style={styles.commentText}>{c.text}</Text>
        </View>
      ))}
      {commentOpen && canComment && (
        <View style={styles.commentBar}>
          <TextInput
            style={styles.commentInput}
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="说点什么，TA 会看到"
            placeholderTextColor={Romance.faint}
            onSubmitEditing={submitComment}
            returnKeyType="send"
          />
          <Pressable onPress={submitComment} hitSlop={8}>
            <IconSymbol
              name="arrow.up.circle.fill"
              size={28}
              color={commentDraft.trim() ? Romance.accent : Romance.faint}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function FeedScreen() {
  const posts = useAppStore((s) => s.posts);
  const bonds = useAppStore((s) => s.bonds);
  // 只看缔结契约的 TA（D-027）：领养后帖 + 这些角色的公开帖
  const bondedCharIds = new Set(bonds.map((b) => b.characterId));
  const sorted = posts
    .filter((p) => bondedCharIds.has(p.characterId))
    .sort((a, b) => b.at - a.at);

  return (
    <AppScreen title="朋友圈">
      <Text style={styles.subtitle}>偷看 TA 们的生活，TA 们不会介意</Text>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              朋友圈还是空的。{'\n'}和 TA 加好友，这里就会热闹起来。
            </Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    title: { fontSize: 28, fontWeight: '700', color: Romance.ink, paddingHorizontal: 18 },
    subtitle: {
      fontSize: 13,
      color: Romance.sub,
      paddingHorizontal: 18,
      marginTop: 2,
      marginBottom: 10,
    },
    list: { paddingHorizontal: 14, paddingBottom: 24 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, marginBottom: 10 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    meta: { fontSize: 11, color: Romance.faint, marginTop: 1 },
    body: { fontSize: 15, color: Romance.ink, lineHeight: 22, marginTop: 10 },
    actions: { flexDirection: 'row', gap: 18, marginTop: 12 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionText: { fontSize: 12, color: Romance.faint },
    comment: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      backgroundColor: Romance.bg,
      borderRadius: 10,
      padding: 10,
    },
    commentFrom: { fontSize: 13, fontWeight: '600', color: Romance.accent },
    commentText: { flex: 1, fontSize: 13, color: Romance.ink, lineHeight: 19 },
    commentBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    commentInput: {
      flex: 1,
      height: 36,
      borderRadius: 22,
      backgroundColor: Romance.bg,
      paddingHorizontal: 14,
      fontSize: 14,
      color: Romance.ink,
    },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 13, color: Romance.sub },
  })
);

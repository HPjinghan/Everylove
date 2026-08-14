/**
 * 动态：领养的和广场角色们的帖子流。「偷看」的家。
 * 领养后他会回你的评论；广场角色的帖子只能看和赞（免费层）。
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance } from '@/constants/theme';
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
        <CharAvatar name={displayName} color={character.color} size={38} />
        <View style={styles.headText}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.meta}>
            {post.bondId ? '只有你能看到' : '广场动态'} · {timeAgo(post.at)}
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
            {canComment ? post.comments.length || '评论' : '领养后 TA 会回你'}
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
  const insets = useSafeAreaInsets();
  const posts = useAppStore((s) => s.posts);
  const sorted = [...posts].sort((a, b) => b.at - a.at);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>动态</Text>
      <Text style={styles.subtitle}>偷看 TA 们的生活，TA 们不会介意</Text>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有动态。先去广场认识一下他们。</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 10 },
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
    borderRadius: 18,
    backgroundColor: Romance.bg,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Romance.ink,
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 13, color: Romance.sub },
});

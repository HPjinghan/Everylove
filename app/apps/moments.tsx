/**
 * X（原朋友圈，D-053 推特模式改版）：缔结契约（领养）的 TA 们的时间线（D-027 口径不变）。
 * - 推特式行布局：头像 + 名字 + @handle + 相对时间，正文，回复/喜欢操作行，细线分隔
 * - 回复实装模型（D-053）：她评论 → TA 用当前引擎真的回一条（带人设/关系/记忆），
 *   暗面路由前置（红线 #3：评论区也不例外）；mock/无 key/失败回落台词库 commentReply
 * - 加好友前的公开帖只能看（免费层口径不变）
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
import { DARK_SIDE_PATTERN, DARK_SIDE_REPLY, scriptFor } from '@/content/characters';
import { buildPostReplySystem, buildPostReplyUserPrompt } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { completeText, splitBubbles, stripStageDirections } from '@/lib/engine';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Bond, Character, Post } from '@/lib/types';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

/** @handle：角色 id 转推特腔（拟真细节） */
function handleFor(c: Character): string {
  return `@${c.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/** TA 的回帖：模型实装（D-053），暗面前置，失败回落台词库 */
async function generatePostReply(
  post: Post,
  character: Character,
  bond: Bond | undefined,
  userComment: string
): Promise<string> {
  if (DARK_SIDE_PATTERN.test(userComment)) return DARK_SIDE_REPLY;
  const { engine, anthropicKey, qianfanKey } = useAppStore.getState();
  try {
    const raw = await completeText(
      buildPostReplySystem(character, bond, meForCharacter(character.id)),
      buildPostReplyUserPrompt({
        postText: post.text,
        comments: [...post.comments, { from: 'me', text: userComment }],
        hisName: bond?.name ?? character.name,
      }),
      engine,
      { anthropic: anthropicKey, qianfan: qianfanKey },
      300
    );
    const cleaned = stripStageDirections(splitBubbles(raw, 1, character.name));
    if (cleaned[0]) return cleaned[0];
  } catch (e) {
    console.warn('[x] 回帖生成失败，回落台词库：', e);
  }
  return scriptFor(character).commentReply;
}

function PostRow({ post }: { post: Post }) {
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const character = findCharacter(post.characterId);
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === post.bondId));
  const me = useAppStore((s) => s.me);
  if (!character) return null;
  const displayName = bond?.name ?? character.name;
  const canComment = !!post.bondId;
  const myName = me?.nickname || t('你');

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || replying) return;
    setCommentDraft('');
    useAppStore.getState().addMyComment(post.id, text);
    setReplying(true);
    const reply = await generatePostReply(post, character, bond, text);
    useAppStore.getState().addHisReply(post.id, reply);
    setReplying(false);
  };

  return (
    <View style={styles.row}>
      <CharAvatar name={displayName} color={character.color} size={40} characterId={character.id} />
      <View style={styles.rowBody}>
        <View style={styles.headLine}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {handleFor(character)} · {timeAgo(post.at)}
          </Text>
        </View>
        {!post.bondId ? <Text style={styles.lockedMeta}>{t('加好友前的帖子')}</Text> : null}
        <Text style={styles.body}>{post.text}</Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => canComment && setCommentOpen((v) => !v)}
            disabled={!canComment}>
            <IconSymbol name="bubble.right" size={16} color={Romance.faint} />
            <Text style={styles.actionText}>
              {canComment ? post.comments.length || '' : t('只能看看')}
            </Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => useAppStore.getState().toggleLike(post.id)}>
            <IconSymbol
              name={post.liked ? 'heart.fill' : 'heart'}
              size={16}
              color={post.liked ? Romance.accent : Romance.faint}
            />
            <Text style={[styles.actionText, post.liked && { color: Romance.accent }]}>
              {post.likes}
            </Text>
          </Pressable>
        </View>

        {/* 回复线（推特式缩进） */}
        {post.comments.map((cm) => (
          <View key={cm.id} style={styles.reply}>
            {cm.from === 'him' ? (
              <CharAvatar
                name={displayName}
                color={character.color}
                size={26}
                characterId={character.id}
              />
            ) : (
              <View style={styles.myAvatar}>
                <Text style={styles.myAvatarText}>{myName.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.replyBody}>
              <Text style={styles.replyName}>
                {cm.from === 'me' ? myName : displayName}
                <Text style={styles.replyHandle}>
                  {'  '}
                  {cm.from === 'me' ? '@me' : handleFor(character)}
                </Text>
              </Text>
              <Text style={styles.replyText}>{cm.text}</Text>
            </View>
          </View>
        ))}
        {replying ? (
          <View style={styles.reply}>
            <CharAvatar
              name={displayName}
              color={character.color}
              size={26}
              characterId={character.id}
            />
            <Text style={styles.replyTyping}>{t('{name} 正在回复…', { name: displayName })}</Text>
          </View>
        ) : null}

        {commentOpen && canComment && (
          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder={t('发布你的回复')}
              placeholderTextColor={Romance.faint}
              onSubmitEditing={submitComment}
              returnKeyType="send"
            />
            <Pressable onPress={submitComment} hitSlop={8} disabled={replying}>
              <IconSymbol
                name="arrow.up.circle.fill"
                size={28}
                color={commentDraft.trim() && !replying ? '#1D9BF0' : Romance.faint}
              />
            </Pressable>
          </View>
        )}
      </View>
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
    <AppScreen title="X">
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        style={styles.feed}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PostRow post={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🕊️</Text>
            <Text style={styles.emptyText}>
              {t('时间线还是空的。\n和 TA 加好友，TA 的帖子就会出现在这里。')}
            </Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    feed: { backgroundColor: '#FFFFFF' },
    list: { paddingBottom: 24 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8ECEF' },
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
    },
    rowBody: { flex: 1 },
    headLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    name: { fontSize: 15, fontWeight: '700', color: '#0F1419', flexShrink: 1 },
    handle: { fontSize: 13, color: '#536471', flexShrink: 1 },
    lockedMeta: { fontSize: 11, color: Romance.faint, marginTop: 1 },
    body: { fontSize: 15, color: '#0F1419', lineHeight: 21, marginTop: 3 },
    actions: { flexDirection: 'row', gap: 46, marginTop: 10 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 34 },
    actionText: { fontSize: 12, color: '#536471' },
    reply: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingLeft: 2,
    },
    replyBody: { flex: 1 },
    replyName: { fontSize: 13, fontWeight: '700', color: '#0F1419' },
    replyHandle: { fontSize: 12, fontWeight: '400', color: '#536471' },
    replyText: { fontSize: 14, color: '#0F1419', lineHeight: 20, marginTop: 1 },
    replyTyping: { fontSize: 13, color: '#536471', alignSelf: 'center' },
    myAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: Romance.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    myAvatarText: { fontSize: 12, fontWeight: '700', color: Romance.accent },
    commentBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    commentInput: {
      flex: 1,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#EFF3F4',
      paddingHorizontal: 14,
      fontSize: 14,
      color: '#0F1419',
    },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyEmoji: { fontSize: 38 },
    emptyText: { fontSize: 13, color: '#536471', textAlign: 'center', lineHeight: 20, marginTop: 10 },
  })
);

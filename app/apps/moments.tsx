/**
 * X（原朋友圈，D-053 推特模式改版；D-100 纸面）：缔结契约（领养）的 TA 们的时间线（D-027 口径不变）。
 * - 白通栏、行间 1px line：头像 40、名 15/600 + @handle 13 muted、正文 15/21、动作行 Fredoka 12 muted（已赞 primary）
 * - 回复缩进、头像 26；「我的头像」= paper 底 accent 首字（不是角色色）；评论输入框 paper r6
 * - 回复走回合管线的 post 模式（D-053 / D-178）：她评论 → TA 用当前引擎真的回一条（亲密背景 + 回帖写法），
 *   暗面路由、失败口径与会话一样（轻提示「TA 这条没回上」，没有脚本回落）
 * - 加好友前的公开帖只能看（免费层口径不变）；在广场见过的 TA 的公开帖带「在广场见过」（D-110）
 * - 评论区不只有她（D-110）：TA 身边的人与其他缔结的 TA 会来评论（lib/posts.ts deliverDueReactions，进页补投），TA 可回一句
 * - 点头像打开 TA 的资料页（components/character-sheet.tsx）；回帖失败走轻提示，不弹窗
 */

import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { CharacterSheet } from '@/components/character-sheet';
import { MingCute } from '@/components/mingcute';
import { runJobs } from '@/core/jobs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { sendText } from '@/lib/chat';
import { compactAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Character, Post } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** @handle：种子角色用 id 转推特腔；自创的 id 是 c_17xxx 这种时间戳，用名字（D-197） */
function handleFor(c: Character): string {
  const fromId = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@${c.custom || /^c_\d+/.test(c.id) ? c.name.replace(/\s+/g, '_') : fromId}`;
}

function PostRow({ post, onOpenCharacter }: { post: Post; onOpenCharacter: (id: string) => void }) {
  const [commentDraft, setCommentDraft] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const character = findCharacter(post.characterId);
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === post.bondId));
  const me = useAppStore((s) => s.me);
  const met = useAppStore((s) => !!s.squareChats[post.characterId]?.encounters?.length);
  if (!character) return null;
  const displayName = bond?.name ?? character.name;
  const canComment = !!post.bondId;
  const myName = me?.nickname || t('你');
  // 推文串（D-206）：帖子下有回复时，头像下垂一条串线连到最后一条回复
  const threaded = post.comments.length > 0 || replying || commentOpen;

  // 回帖走 post 模式（D-178）：她的评论落评论线 + 记账 → TA 回一句；失败同会话口径（轻提示）
  const submitComment = () => {
    const text = commentDraft.trim();
    if (!text || replying || !post.bondId) return;
    setCommentDraft('');
    void sendText({ mode: 'post', bondId: post.bondId, postId: post.id }, text, { ui: { pace: 'none', typing: setReplying } });
  };

  return (
    <View style={styles.row}>
      <View style={styles.avatarCol}>
        <Pressable onPress={() => onOpenCharacter(character.id)} hitSlop={6}>
          <CharAvatar name={displayName} color={character.color} size={40} characterId={character.id} />
        </Pressable>
        {threaded ? <View style={styles.threadLine} /> : null}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.headLine}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {handleFor(character)}
          </Text>
          <Text style={styles.ago}>· {compactAgo(post.at)}</Text>
        </View>
        {!post.bondId ? <Text style={styles.lockedMeta}>{met ? t('在广场见过 · 加好友前的帖子') : t('加好友前的帖子')}</Text> : null}
        <Text style={styles.body}>{post.text}</Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            hitSlop={8}
            accessibilityLabel={t('评论')}
            onPress={() => canComment && setCommentOpen((v) => !v)}
            disabled={!canComment}>
            <MingCute name="chat" size={15} color={Romance.sub} />
            {canComment ? (
              <Text style={styles.actionCount}>{post.comments.length || ''}</Text>
            ) : (
              <Text style={styles.actionLabel}>{t('只能看看')}</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => {
              const s = useAppStore.getState();
              // 点赞（不是取消）TA 的帖子 = 亲密度来源（D-126）
              if (!post.liked && post.bondId) s.creditBond(post.bondId, 'like');
              s.toggleLike(post.id);
            }}
          >
            <MingCute name="heart" size={15} color={post.liked ? Romance.accent : Romance.sub} />
            <Text style={[styles.actionCount, post.liked && styles.actionCountOn]}>{post.likes || ''}</Text>
          </Pressable>
        </View>

        {/* 回复线（推特式缩进） */}
        {post.comments.map((cm) => {
          // 别人（D-110）：另一位缔结的 TA 用立绘头像、可点开资料页；TA 身边的人 = line 底首字
          const other = cm.from === 'other' ? (cm.characterId ? findCharacter(cm.characterId) : undefined) : undefined;
          const otherName = cm.from === 'other' ? (cm.name ?? other?.name ?? '') : '';
          return (
            <View key={cm.id} style={styles.reply}>
              {cm.from === 'him' ? (
                <CharAvatar name={displayName} color={character.color} size={26} characterId={character.id} />
              ) : cm.from === 'other' ? (
                other ? (
                  <Pressable onPress={() => onOpenCharacter(other.id)} hitSlop={6}>
                    <CharAvatar name={otherName} color={other.color} size={26} characterId={other.id} />
                  </Pressable>
                ) : (
                  <View style={styles.otherAvatar}>
                    <Text style={styles.otherAvatarText}>{otherName.slice(0, 1)}</Text>
                  </View>
                )
              ) : (
                <View style={styles.myAvatar}>
                  <Text style={styles.myAvatarText}>{myName.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.replyBody}>
                <Text style={styles.replyName}>
                  {cm.from === 'me' ? myName : cm.from === 'other' ? otherName : displayName}
                  <Text style={styles.replyHandle}>
                    {'  '}
                    {cm.from === 'me' ? '@me' : cm.from === 'other' ? (other ? handleFor(other) : `@${otherName}`) : handleFor(character)}
                  </Text>
                </Text>
                <Text style={styles.replyText}>{cm.text}</Text>
              </View>
            </View>
          );
        })}
        {replying ? (
          <View style={styles.reply}>
            <CharAvatar name={displayName} color={character.color} size={26} characterId={character.id} />
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
              placeholderTextColor={Romance.sub}
              onSubmitEditing={submitComment}
              returnKeyType="send"
            />
            <Pressable onPress={submitComment} hitSlop={8} disabled={replying}>
              <IconSymbol
                name="arrow.up.circle.fill"
                size={28}
                color={commentDraft.trim() && !replying ? Romance.accent : Romance.sub}
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
  const [sheetId, setSheetId] = useState<string | null>(null);
  // 进页补一次别人的互动（D-110）：缔结时铺的帖也会有人来评论
  useEffect(() => {
    void runJobs('screen:x');
  }, []);
  // 只看缔结契约的 TA（D-027）：领养后帖 + 这些角色的公开帖
  const bondedCharIds = new Set(bonds.map((b) => b.characterId));
  const sorted = posts.filter((p) => bondedCharIds.has(p.characterId)).sort((a, b) => b.at - a.at);

  return (
    <AppScreen title="X">
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        style={styles.feed}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <PostRow post={item} onOpenCharacter={setSheetId} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('时间线还是空的。')}</Text>
          </View>
        }
      />
      <CharacterSheet characterId={sheetId} visible={!!sheetId} onClose={() => setSheetId(null)} />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // 白通栏：列表底白、行间 1px line
    feed: { backgroundColor: Romance.card },
    list: { paddingBottom: 24 },
    separator: { height: 1, backgroundColor: Romance.line },
    row: {
      flexDirection: 'row',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.screen,
      paddingVertical: 12,
    },
    avatarCol: { alignItems: 'center' },
    // 推文串线：line 色 2px，从头像下沿垂到这条帖子的最后一条回复
    threadLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: Romance.line, marginTop: 6 },
    rowBody: { flex: 1, minWidth: 0 },
    headLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    name: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    handle: { fontSize: Type.scale.label.size, color: Romance.sub, flexShrink: 1 },
    ago: { fontFamily: Fonts.label, fontSize: Type.scale.label.size, color: Romance.sub },
    lockedMeta: { fontSize: Type.scale.timestamp.size, color: Romance.faint, marginTop: 1 },
    body: { fontSize: Type.scale.body.size, lineHeight: 21, color: Romance.ink, marginTop: 3 },
    actions: { flexDirection: 'row', gap: 46, marginTop: 10 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 34, paddingVertical: 6 },
    actionCount: { fontFamily: Fonts.label, fontSize: Type.scale.caption.size, color: Romance.sub },
    actionCountOn: { color: Romance.accent },
    actionLabel: { fontSize: Type.scale.caption.size, color: Romance.sub },
    reply: { flexDirection: 'row', gap: Space.inline, marginTop: 12 },
    replyBody: { flex: 1 },
    replyName: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.ink },
    replyHandle: { fontSize: Type.scale.caption.size, fontWeight: '400', color: Romance.sub },
    replyText: { fontSize: Type.scale.sub.size, lineHeight: 20, color: Romance.ink, marginTop: 1 },
    replyTyping: { fontSize: Type.scale.label.size, color: Romance.sub, alignSelf: 'center' },
    // 我的头像：paper 底 + accent 首字（不是角色色）
    myAvatar: {
      width: 26,
      height: 26,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    myAvatarText: { fontSize: Type.scale.caption.size, fontWeight: '600', color: Romance.accentStrong },
    // 别人的头像（TA 身边的人，D-110）：line 底 ink 首字
    otherAvatar: {
      width: 26,
      height: 26,
      borderRadius: Shape.radius,
      backgroundColor: Romance.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otherAvatarText: { fontFamily: Fonts.initial, fontSize: Type.scale.caption.size, fontWeight: '600', color: Romance.ink },
    commentBar: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, marginTop: 10 },
    commentInput: {
      flex: 1,
      height: 36,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      paddingHorizontal: 14,
      fontSize: Type.scale.sub.size,
      color: Romance.ink,
    },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyText: { fontSize: Type.scale.label.size, color: Romance.sub, textAlign: 'center', lineHeight: 20 },
  })
);

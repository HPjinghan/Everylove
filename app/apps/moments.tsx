/**
 * X（原朋友圈，D-053 推特模式改版；D-100 纸面）：缔结契约（领养）的 TA 们的时间线（D-027 口径不变）。
 * - 白通栏、行间 1px line：头像 40、名 15/600 + @handle 13 muted、正文 15/21、动作行 Fredoka 12 muted（已赞 primary）
 * - 回复缩进、头像 26；「我的头像」= paper 底 accent 首字（不是角色色）；评论输入框 paper r6
 * - 回复实装模型（D-053）：她评论 → TA 用当前引擎真的回一条（带人设/关系/记忆），
 *   暗面路由前置（红线 #3：评论区也不例外）；AI 不可用/失败不回帖、弹窗露出原因（D-069 起没有脚本回落）
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
import { showToast } from '@/components/toast';
import { TURN_ERROR_TOAST_MS } from '@/core/turn';
import { deliverDueReactions } from '@/lib/posts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { DARK_SIDE_PATTERN, darkSideReply } from '@/content/characters';
import { buildPostReplySystem, buildPostReplyUserPrompt } from '@/content/prompts';
import { completeText, describeAiError, splitBubbles, stripStageDirections } from '@/lib/engine';
import { timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Bond, Character, Post } from '@/lib/types';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

/** @handle：角色 id 转推特腔（拟真细节） */
function handleFor(c: Character): string {
  return `@${c.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/** TA 的回帖：模型实装（D-053），暗面前置；失败抛错由调用方露出原因（D-069：不再回落台词库） */
async function generatePostReply(
  post: Post,
  character: Character,
  bond: Bond | undefined,
  userComment: string
): Promise<string> {
  if (DARK_SIDE_PATTERN.test(userComment)) return darkSideReply();
  const raw = await completeText(
    buildPostReplySystem(character, bond, meForCharacter(character.id)),
    buildPostReplyUserPrompt({
      postText: post.text,
      comments: [...post.comments, { from: 'me', text: userComment }],
      hisName: bond?.name ?? character.name,
    }),
    300
  );
  const cleaned = stripStageDirections(splitBubbles(raw, 1, character.name));
  if (!cleaned[0]) throw new Error('empty reply');
  return cleaned[0];
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

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || replying) return;
    setCommentDraft('');
    useAppStore.getState().addMyComment(post.id, text);
    setReplying(true);
    try {
      const reply = await generatePostReply(post, character, bond, text);
      useAppStore.getState().addHisReply(post.id, reply);
    } catch (e) {
      console.warn('[x] 回帖生成失败：', e);
      showToast(t('模型调用失败，TA 这条没回上：{reason}', { reason: describeAiError(e) }), { durationMs: TURN_ERROR_TOAST_MS });
    } finally {
      setReplying(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onOpenCharacter(character.id)} hitSlop={6}>
        <CharAvatar name={displayName} color={character.color} size={40} characterId={character.id} />
      </Pressable>
      <View style={styles.rowBody}>
        <View style={styles.headLine}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {handleFor(character)} · {timeAgo(post.at)}
          </Text>
        </View>
        {!post.bondId ? <Text style={styles.lockedMeta}>{met ? t('在广场见过 · 加好友前的帖子') : t('加好友前的帖子')}</Text> : null}
        <Text style={styles.body}>{post.text}</Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            onPress={() => canComment && setCommentOpen((v) => !v)}
            disabled={!canComment}>
            <MingCute name="chat" size={15} color={Romance.sub} />
            {canComment ? (
              <Text style={styles.actionCount}>{post.comments.length || ''}</Text>
            ) : (
              <Text style={styles.actionLabel}>{t('只能看看')}</Text>
            )}
          </Pressable>
          <Pressable style={styles.action} onPress={() => useAppStore.getState().toggleLike(post.id)}>
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
    void deliverDueReactions();
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
    rowBody: { flex: 1, minWidth: 0 },
    headLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    name: { fontSize: 15, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    handle: { fontSize: 13, color: Romance.sub, flexShrink: 1 },
    lockedMeta: { fontSize: 11, color: Romance.faint, marginTop: 1 },
    body: { fontSize: 15, lineHeight: 21, color: Romance.ink, marginTop: 3 },
    actions: { flexDirection: 'row', gap: 46, marginTop: 10 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 34 },
    actionCount: { fontFamily: Fonts.label, fontSize: 12, color: Romance.sub },
    actionCountOn: { color: Romance.accent },
    actionLabel: { fontSize: 12, color: Romance.sub },
    reply: { flexDirection: 'row', gap: Space.inline, marginTop: 12 },
    replyBody: { flex: 1 },
    replyName: { fontSize: 13, fontWeight: '600', color: Romance.ink },
    replyHandle: { fontSize: 12, fontWeight: '400', color: Romance.sub },
    replyText: { fontSize: 14, lineHeight: 20, color: Romance.ink, marginTop: 1 },
    replyTyping: { fontSize: 13, color: Romance.sub, alignSelf: 'center' },
    // 我的头像：paper 底 + accent 首字（不是角色色）
    myAvatar: {
      width: 26,
      height: 26,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    myAvatarText: { fontSize: 12, fontWeight: '600', color: Romance.accentStrong },
    // 别人的头像（TA 身边的人，D-110）：line 底 ink 首字
    otherAvatar: {
      width: 26,
      height: 26,
      borderRadius: Shape.radius,
      backgroundColor: Romance.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otherAvatarText: { fontFamily: Fonts.initial, fontSize: 12, fontWeight: '600', color: Romance.ink },
    commentBar: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, marginTop: 10 },
    commentInput: {
      flex: 1,
      height: 36,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      paddingHorizontal: 14,
      fontSize: 14,
      color: Romance.ink,
    },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyText: { fontSize: 13, color: Romance.sub, textAlign: 'center', lineHeight: 20 },
  })
);

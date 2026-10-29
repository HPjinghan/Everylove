/**
 * X 的一条帖子（D-053 推特模式 → D-252 拆出来给时间线与 TA 的主页共用）：
 * - 白通栏一行：头像 40、名 + @handle + 紧凑时间；正文；配图（TA 随手拍的，冲洗中画显影相纸，没洗出来就不出现）；动作行
 * - 评论线（推特式缩进）：只显示到点了的评论（她自己的帖子底下，TA 们的评论 1 小时内陆续进来）；
 *   TA 身边的人用配角头像池（content/avatars.ts，和 TA 手机里同一张）；另一位缔结的 TA 用立绘头像、可点开主页
 * - 她在 TA 帖子底下评论 → 那位 TA 回；她在自己帖子底下点某位 TA 的「回复」→ 那位 TA 回（都走回合管线的 post 模式）
 * - 上次打开之后新发的帖，名字旁一个小圆点
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { CharAvatar } from '@/components/char-avatar';
import { DevelopingFilm } from '@/components/developing';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { appTint } from '@/constants/apps';
import { Shape, Space, Type } from '@/constants/design';
import { BASE_PALETTE, Fonts, Romance, themed } from '@/constants/theme';
import { avatarFor } from '@/content/avatars';
import { sendText } from '@/lib/chat';
import { compactAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { likesAt } from '@/lib/posts';
import type { Character, Post } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** X 的颜色（D-231）：黑白，发送键是黑的；点赞仍是粉红 */
const TINT = appTint('moments') ?? Romance.ink;
/** 配图在时间线里的尺寸 */
const PHOTO_W = 220;
const PHOTO_H = 275;

/** @handle（D-252）：种子按语言各有一个；自创的用名字 */
export function handleFor(c: Character): string {
  if (c.handle) return `@${c.handle}`;
  const fromId = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@${c.custom || /^c_\d+/.test(c.id) ? c.name.replace(/\s+/g, '_') : fromId}`;
}

/** 她自己的头像：浅底圆头像 + 黑色首字（不是角色色） */
export function MyAvatar({ name, size }: { name: string; size: number }) {
  return (
    <View style={[styles.myAvatar, { width: size, height: size }]}>
      <Text style={[styles.myAvatarText, { fontSize: size * 0.42 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

/** 点赞键：赞上时心形弹一下 + 轻震；她自己的帖子只显示数 */
function LikeButton({ liked, count, onToggle }: { liked: boolean; count: number; onToggle?: () => void }) {
  const scale = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      style={styles.action}
      accessibilityLabel={t('赞')}
      disabled={!onToggle}
      onPress={() => {
        if (!liked) {
          scale.set(withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 260 })));
          haptic.tap();
        }
        onToggle?.();
      }}>
      <Animated.View style={pop}>
        <MingCute name="heart" size={15} color={liked ? BASE_PALETTE.accent : Romance.sub} />
      </Animated.View>
      <Text style={[styles.actionCount, liked && styles.actionCountOn]}>{count || ''}</Text>
    </Pressable>
  );
}

export function PostRow({
  post,
  now,
  isNew,
  onOpenProfile,
}: {
  post: Post;
  now: number;
  /** 上次打开 X 之后新发的 */
  isNew?: boolean;
  /** 点头像：打开那位 TA 的主页 */
  onOpenProfile?: (characterId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [barOpen, setBarOpen] = useState(false);
  // 她自己的帖子底下回某位 TA：回给谁（羁绊 id + 名字）
  const [target, setTarget] = useState<{ bondId: string; name: string } | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const character = post.mine ? undefined : findCharacter(post.characterId);
  const bond = useAppStore((s) => (post.bondId ? s.bonds.find((b) => b.id === post.bondId) : undefined));
  const bonds = useAppStore((s) => s.bonds);
  const me = useAppStore((s) => s.me);
  const met = useAppStore((s) => !!s.squareChats[post.characterId]?.encounters?.length);
  if (!post.mine && !character) return null;
  const myName = me?.nickname || t('你');
  const displayName = post.mine ? myName : (bond?.name ?? character!.name);
  const comments = post.comments.filter((c) => c.at <= now);
  const canComment = post.mine ? false : !!post.bondId;
  // 推文串（D-206）：帖子下有回复时，头像下垂一条串线连到最后一条回复
  const threaded = comments.length > 0 || !!replying || barOpen;
  const likes = post.mine ? comments.filter((c) => c.from === 'other').length : likesAt(post, now);

  const submit = () => {
    const text = draft.trim();
    if (!text || replying) return;
    const bondId = post.mine ? target?.bondId : post.bondId;
    const name = post.mine ? target?.name : displayName;
    if (!bondId || !name) return;
    setDraft('');
    setBarOpen(false);
    void sendText({ mode: 'post', bondId, postId: post.id }, text, {
      ui: { pace: 'none', typing: (on: boolean) => setReplying(on ? name : null) },
    });
  };

  const openReplyTo = (characterId: string | undefined, name: string) => {
    const b = bonds.find((x) => x.characterId === characterId);
    if (!b) return;
    setTarget({ bondId: b.id, name });
    setBarOpen(true);
  };

  return (
    <View style={styles.row}>
      <View style={styles.avatarCol}>
        {post.mine ? (
          <MyAvatar name={myName} size={40} />
        ) : (
          <Pressable onPress={() => onOpenProfile?.(character!.id)} hitSlop={6} disabled={!onOpenProfile}>
            <CharAvatar name={displayName} color={character!.color} size={40} characterId={character!.id} round />
          </Pressable>
        )}
        {threaded ? <View style={styles.threadLine} /> : null}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.headLine}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {post.mine ? '@me' : handleFor(character!)}
          </Text>
          <Text style={styles.ago}>· {compactAgo(post.at)}</Text>
          {isNew ? <View style={styles.newDot} /> : null}
        </View>
        {!post.bondId && !post.mine && met ? <Text style={styles.lockedMeta}>{t('在广场见过')}</Text> : null}
        <Text style={styles.body}>{post.text}</Text>
        {post.imageUri ? (
          <Image source={{ uri: post.imageUri }} style={styles.photo} contentFit="cover" />
        ) : post.imageStatus === 'pending' ? (
          <DevelopingFilm width={PHOTO_W} height={PHOTO_H} style={styles.photoPending} />
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.action}
            hitSlop={8}
            accessibilityLabel={t('评论')}
            onPress={() => canComment && setBarOpen((v) => !v)}
            disabled={!canComment}>
            <MingCute name="chat" size={15} color={canComment || post.mine ? Romance.sub : Romance.faint} />
            <Text style={styles.actionCount}>{comments.length || ''}</Text>
          </Pressable>
          <LikeButton
            liked={!!post.liked}
            count={likes}
            onToggle={
              post.mine
                ? undefined
                : () => {
                    const s = useAppStore.getState();
                    // 点赞（不是取消）TA 的帖子 = 亲密度来源（D-126）
                    if (!post.liked && post.bondId) s.creditBond(post.bondId, 'like');
                    s.toggleLike(post.id);
                  }
            }
          />
        </View>

        {comments.map((cm) => {
          // 别人（D-110）：另一位缔结的 TA 用立绘头像、可点开主页；TA 身边的人用配角头像池
          const other = cm.from === 'other' && cm.characterId ? findCharacter(cm.characterId) : undefined;
          const otherName = cm.from === 'other' ? (cm.name ?? other?.name ?? '') : '';
          const name = cm.from === 'me' ? myName : cm.from === 'other' ? otherName : displayName;
          const handle =
            cm.from === 'me' ? '@me' : cm.from === 'other' ? (other ? handleFor(other) : '') : character ? handleFor(character) : '';
          return (
            <View key={cm.id} style={styles.reply}>
              {cm.from === 'him' ? (
                <CharAvatar name={displayName} color={character!.color} size={26} characterId={character!.id} round />
              ) : cm.from === 'other' ? (
                other ? (
                  <Pressable onPress={() => onOpenProfile?.(other.id)} hitSlop={6} disabled={!onOpenProfile}>
                    <CharAvatar name={otherName} color={other.color} size={26} characterId={other.id} round />
                  </Pressable>
                ) : (
                  <Image source={avatarFor(`${post.characterId}:${otherName}`)} style={styles.circleAvatar} />
                )
              ) : (
                <MyAvatar name={myName} size={26} />
              )}
              <View style={styles.replyBody}>
                <Text style={styles.replyName}>
                  {name}
                  {handle ? <Text style={styles.replyHandle}>{`  ${handle}`}</Text> : null}
                </Text>
                <Text style={styles.replyText}>
                  {cm.to ? <Text style={styles.replyTo}>{`@${cm.to} `}</Text> : null}
                  {cm.text}
                </Text>
                {post.mine && other ? (
                  <Pressable hitSlop={8} onPress={() => openReplyTo(other.id, otherName)} style={styles.replyAction}>
                    <Text style={styles.replyActionText}>{t('回复')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {replying ? (
          <View style={styles.reply}>
            <Text style={styles.replyTyping}>{t('{name} 正在回复…', { name: replying })}</Text>
          </View>
        ) : null}

        {barOpen && (canComment || target) ? (
          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={post.mine && target ? t('回复 {name}', { name: target.name }) : t('发布你的回复')}
              placeholderTextColor={Romance.sub}
              onSubmitEditing={submit}
              returnKeyType="send"
              autoFocus={post.mine}
            />
            <Pressable onPress={submit} hitSlop={8} disabled={!!replying}>
              <IconSymbol name="arrow.up.circle.fill" size={28} color={draft.trim() && !replying ? TINT : Romance.sub} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: Space.inlineLoose, paddingHorizontal: Space.screen, paddingVertical: 12 },
    avatarCol: { alignItems: 'center' },
    // 推文串线：line 色 2px，从头像下沿垂到这条帖子的最后一条回复
    threadLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: Romance.line, marginTop: 6 },
    rowBody: { flex: 1, minWidth: 0 },
    headLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    name: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink, flexShrink: 1 },
    handle: { fontSize: Type.scale.label.size, color: Romance.sub, flexShrink: 1 },
    ago: { fontFamily: Fonts.label, fontSize: Type.scale.label.size, color: Romance.sub },
    newDot: { width: 7, height: 7, borderRadius: Shape.radiusPill, backgroundColor: BASE_PALETTE.accent, alignSelf: 'center', marginLeft: 2 },
    lockedMeta: { fontSize: Type.scale.timestamp.size, color: Romance.faint, marginTop: 1 },
    body: { fontSize: Type.scale.body.size, lineHeight: 21, color: Romance.ink, marginTop: 3 },
    photo: { width: PHOTO_W, height: PHOTO_H, borderRadius: Shape.radius, marginTop: 8, backgroundColor: BASE_PALETTE.bg },
    photoPending: { marginTop: 8 },
    actions: { flexDirection: 'row', gap: 46, marginTop: 10 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 34, paddingVertical: 6 },
    actionCount: { fontFamily: Fonts.label, fontSize: Type.scale.caption.size, color: Romance.sub },
    actionCountOn: { color: BASE_PALETTE.accent },
    reply: { flexDirection: 'row', gap: Space.inline, marginTop: 12 },
    replyBody: { flex: 1 },
    replyName: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.ink },
    replyHandle: { fontSize: Type.scale.caption.size, fontWeight: '400', color: Romance.sub },
    replyText: { fontSize: Type.scale.sub.size, lineHeight: 20, color: Romance.ink, marginTop: 1 },
    replyTo: { color: Romance.sub },
    replyAction: { alignSelf: 'flex-start', marginTop: 4 },
    replyActionText: { fontSize: Type.scale.caption.size, color: Romance.sub },
    replyTyping: { fontSize: Type.scale.label.size, color: Romance.sub, alignSelf: 'center' },
    myAvatar: { borderRadius: Shape.radiusPill, backgroundColor: BASE_PALETTE.bg, alignItems: 'center', justifyContent: 'center' },
    myAvatarText: { fontWeight: '600', color: Romance.ink },
    circleAvatar: { width: 26, height: 26, borderRadius: Shape.radiusPill },
    commentBar: { flexDirection: 'row', alignItems: 'center', gap: Space.inline, marginTop: 10 },
    commentInput: {
      flex: 1,
      height: 36,
      borderRadius: Shape.radiusPill,
      backgroundColor: BASE_PALETTE.bg,
      paddingHorizontal: 14,
      fontSize: Type.scale.sub.size,
      color: Romance.ink,
    },
  })
);

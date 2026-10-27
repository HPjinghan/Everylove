/**
 * X（原朋友圈，D-053 推特模式改版；D-231 黑白时间线、圆头像）：缔结的 TA 们的时间线（D-027）+ 她自己发的帖（D-252）。
 * - 一条帖子的样子与评论都在 components/x-post-row.tsx（时间线与 TA 的主页共用）
 * - 回复走回合管线的 post 模式（D-053 / D-178）：她评论 → TA 用当前引擎真的回一条；暗面路由、失败口径与会话一样
 * - 评论区不只有她（D-110）：TA 身边的人与其他缔结的 TA 会来评论（lib/posts.ts deliverDueReactions，进页补投）
 * - D-252：右下「+」她自己发帖，关注她的 TA 们 1 小时内陆续来评论（features/x-post.ts）；点 TA 的头像进 TA 的主页；
 *   上次打开之后新发的帖带小圆点（桌面图块的角标同一个口径）；时间线每半分钟走一次，到点的评论与涨上去的赞自己出现
 */

import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { MingCute } from '@/components/mingcute';
import { XProfile } from '@/components/x-profile';
import { PostRow } from '@/components/x-post-row';
import { runJobs } from '@/core/jobs';
import { appTint } from '@/constants/apps';
import { Elevation, Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { MY_POST_MAX, publishMyPost } from '@/features/x-post';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/** X 的颜色（D-231）：黑白 */
const TINT = appTint('moments') ?? Romance.ink;
/** 时间线多久走一次（到点的评论、涨的赞） */
const TICK_MS = 30_000;

function Composer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const sending = useRef(false);
  const close = () => {
    setText('');
    onClose();
  };
  const publish = () => {
    if (sending.current || !text.trim()) return;
    sending.current = true;
    const ok = publishMyPost(text);
    sending.current = false;
    if (ok) close();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.composer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composerHead}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.cancel}>{t('取消')}</Text>
          </Pressable>
          <Button label={t('发帖')} size="sm" variant="primary" disabled={!text.trim()} onPress={publish} style={styles.postBtn} />
        </View>
        <TextInput
          style={styles.composerInput}
          value={text}
          onChangeText={(v) => setText(v.slice(0, MY_POST_MAX))}
          placeholder={t('有什么新鲜事？')}
          placeholderTextColor={Romance.sub}
          multiline
          autoFocus
        />
        <Text style={[styles.counter, { marginBottom: insets.bottom + 8 }]}>
          {text.length}/{MY_POST_MAX}
        </Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FeedScreen() {
  const posts = useAppStore((s) => s.posts);
  const bonds = useAppStore((s) => s.bonds);
  const insets = useSafeAreaInsets();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // 上次打开 X 的时刻（进页那一刻读出来，这次看的时候不变）：之后新发的帖带小圆点
  const [seenBefore] = useState(() => useAppStore.getState().xSeenAt);

  useEffect(() => {
    // 进页补一次别人的互动（D-110）；记下「看过了」，离开时再记一次（看的时候进来的评论也算看过）
    void runJobs('screen:x');
    useAppStore.getState().markXSeen(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(id);
      useAppStore.getState().markXSeen(Date.now());
    };
  }, []);

  // 只看缔结的 TA（D-027）+ 她自己的帖
  const bondedCharIds = new Set(bonds.map((b) => b.characterId));
  const sorted = posts.filter((p) => (p.mine || bondedCharIds.has(p.characterId)) && p.at <= now).sort((a, b) => b.at - a.at);

  return (
    <AppScreen title="X">
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        style={styles.feed}
        contentContainerStyle={styles.list}
        // 评论框在列表里：键盘弹起时把列表往上推，回复靠下的帖子也看得见输入框
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PostRow
            post={item}
            now={now}
            isNew={!item.mine && seenBefore !== undefined && item.at > seenBefore}
            onOpenProfile={setProfileId}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('时间线还是空的。')}</Text>
          </View>
        }
      />
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setComposing(true)}
        accessibilityLabel={t('发帖')}>
        <MingCute name="plus" size={24} color="#FFFFFF" />
      </Pressable>
      <Composer visible={composing} onClose={() => setComposing(false)} />
      <XProfile characterId={profileId} now={now} onClose={() => setProfileId(null)} />
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // 白通栏：列表底白、行间 1px line
    feed: { flex: 1, backgroundColor: Romance.card },
    list: { paddingBottom: 96 },
    separator: { height: 1, backgroundColor: Romance.line },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyText: { fontSize: Type.scale.label.size, color: Romance.sub, textAlign: 'center', lineHeight: 20 },
    // 发帖键：X 的黑色圆键
    fab: {
      position: 'absolute',
      right: Space.screen,
      width: 56,
      height: 56,
      borderRadius: Shape.radiusPill,
      backgroundColor: TINT,
      alignItems: 'center',
      justifyContent: 'center',
      ...Elevation.high,
    },
    composer: { flex: 1, backgroundColor: Romance.card, paddingHorizontal: Space.screen },
    composerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    cancel: { fontSize: Type.scale.body.size, color: Romance.ink },
    postBtn: { backgroundColor: TINT },
    composerInput: { flex: 1, fontSize: Type.scale.md.size, lineHeight: 24, color: Romance.ink, textAlignVertical: 'top', paddingTop: 8 },
    counter: { alignSelf: 'flex-end', fontFamily: Fonts.label, fontSize: Type.scale.caption.size, color: Romance.sub },
  })
);

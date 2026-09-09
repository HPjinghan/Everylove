/**
 * 交友试聊（D-040 滑到即配对后进入这里；D-100 纸面）：TA 先开口。
 * 免费层机制：TA 有点兴趣但不太主动；3 天不聊配对过期、TA 会忘记你。
 * 心动值（D-029）：她每开口一句都会涨（速度 = 角色的确定关系节奏 offerAfterTurns，±15% 浮动）；
 * 满 100 = 羁绊 LV1——TA 主动开口交换联系方式（产品触发器，不由模型决定；features/adoption.ts）。
 * 回合走底座管线（D-086）：这里只管界面与 TA 的开场白。
 *
 * 纸面（D-100）：顶栏 ‹ / 头像 36 / 名 17 / 身份 12，右侧标签白底 r6——自创显示「你创造的 TA」，配对显示倒计时「还剩 N 天」（最后一天 accent）；
 * 心动条吸顶：header 下方通栏（白底、1.5px ink 下沿），不随消息滚动，满 100 保持满格；
 * offer 仍是输入栏上方的 cta 卡（白卡描边 + primary 小按钮），贴近拇指。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { scriptFor } from '@/content/characters';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { himMsg, wait } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { sendImage, sendText, sendVoice, squareScope } from '@/lib/chat';
import { findCharacter, SQUARE_CHAT_TTL_MS, useAppStore } from '@/store/app-store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 渲染期只读它的「现在」：每分钟刷新一次（渲染里不直接叫 Date.now） */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** 配对倒计时（D-100）：还剩 N 天 = 配对时限的天数 − 距上次说话的整天数，最少 1；
 * now 最多晚 1 分钟，刚说完话时 lastActiveAt 可能比它新，经过天数钳到 0 */
function daysLeft(lastActiveAt: number, now: number): number {
  const total = Math.round(SQUARE_CHAT_TTL_MS / DAY_MS);
  const elapsed = Math.max(0, Math.floor((now - lastActiveAt) / DAY_MS));
  return Math.max(1, total - elapsed);
}

export default function SquareChatScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const character = findCharacter(characterId);
  const chat = useAppStore((s) => s.squareChats[characterId]);
  const bond = useAppStore((s) => s.bonds.find((b) => b.characterId === characterId));
  const [typing, setTyping] = useState(false);
  const booted = useRef(false);
  const now = useNow();

  // 进场：过期判定 + 他先开口
  useEffect(() => {
    if (!character || bond || booted.current) return;
    booted.current = true;
    const { ensureSquareChat, appendSquare } = useAppStore.getState();
    const wasExpired = ensureSquareChat(character.id);
    const run = async () => {
      if (wasExpired) {
        appendSquare(character.id, [
          {
            id: uid('m'),
            from: 'system',
            kind: 'system',
            text: t('隔了太久，TA 已经不记得你了。'),
            at: Date.now(),
          },
        ]);
      }
      const existing = useAppStore.getState().squareChats[character.id];
      if (existing && existing.messages.filter((m) => m.from !== 'system').length === 0) {
        const script = scriptFor(character);
        for (const line of script.opening) {
          setTyping(true);
          await wait(900);
          setTyping(false);
          useAppStore.getState().appendSquare(character.id, [himMsg(line)]);
          await wait(400);
        }
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!character) return <Redirect href="/apps/dating" />;
  if (bond) {
    return <Redirect href={{ pathname: '/bond/[bondId]', params: { bondId: bond.id } }} />;
  }

  // 回合走底座管线（D-086）：心动记账、暗面路由、心动满的 offer 都在管线与钩子里
  const scope = squareScope(character.id);
  const ui = { typing: setTyping };
  const onSend = (text: string, replyTo?: ReplyRef) => void sendText(scope, text, { replyTo, ui });
  const onSendVoice = (uri: string, durationMs: number) => void sendVoice(scope, uri, durationMs, ui);
  const onSendImage = (uri: string) => void sendImage(scope, uri, ui);

  const offered = chat?.adoptionOffered;
  // 满 100 之后吸顶条保持满格
  const heart = offered ? HEART_FULL : Math.min(HEART_FULL, chat?.heart ?? 0);
  const left = daysLeft(chat?.lastActiveAt ?? now, now);
  const lastDay = left <= 1;
  // 「还剩 N 天」：数字用 Fredoka，所以按 {n} 把译文拆成前后两段
  const [leftBefore, leftAfter] = t('还剩 {n} 天').split('{n}');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
        </Pressable>
        <CharAvatar name={character.name} color={character.color} size={Space.avatar.row} characterId={character.id} />
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {character.name}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {character.identity}
          </Text>
        </View>
        <View style={styles.tag}>
          {character.custom ? (
            <Text style={styles.tagText}>{t('你创造的 TA')}</Text>
          ) : (
            <Text style={[styles.tagText, lastDay && styles.tagUrgent]}>
              {leftBefore}
              <Text style={[styles.tagNum, lastDay && styles.tagUrgent]}>{left}</Text>
              {leftAfter}
            </Text>
          )}
        </View>
      </View>

      {/* 心动条吸顶（D-100）：白底通栏 + 1.5px 下沿，不随消息滚动 */}
      <View style={styles.heartBar}>
        <Text style={styles.heartLabel}>{t('心动')}</Text>
        <View style={styles.heartTrack}>
          <View style={[styles.heartFill, { width: `${heart}%` }]} />
        </View>
        <Text style={styles.heartNum}>
          {heart}/{HEART_FULL}
        </Text>
      </View>

      <ChatThread
        messages={chat?.messages ?? []}
        color={character.color}
        name={character.name}
        characterId={character.id}
        typing={typing}
        onSend={onSend}
        onSendImage={onSendImage}
        onSendVoice={onSendVoice}
        onRecall={(m) => useAppStore.getState().recallMessage({ characterId: character.id }, m.id)}
        onDelete={(m) => useAppStore.getState().deleteMessage({ characterId: character.id }, m.id)}
        cta={
          offered ? (
            <Card style={styles.cta}>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>
                  {character.custom ? t('TA 想和你确定关系') : t('TA 想要你的联系方式')}
                </Text>
                <Text style={styles.ctaSub}>
                  {character.custom ? t('这一次，是 TA 自己想留在你身边') : t('心动满了，TA 先开了口')}
                </Text>
              </View>
              <Button
                size="sm"
                label={character.custom ? t('答应 TA') : t('交换联系方式')}
                onPress={() =>
                  router.push({
                    pathname: '/adopt/[characterId]',
                    params: { characterId: character.id },
                  })
                }
              />
            </Card>
          ) : null
        }
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    // 顶栏透底、1.5px ink 下沿
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.screen,
      paddingTop: 6,
      paddingBottom: 10,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    headerText: { flex: 1 },
    headerName: { fontSize: 17, fontWeight: '600', color: Romance.ink },
    headerSub: { fontSize: 12, color: Romance.sub, marginTop: 3 },
    // 右侧标签：白底 r6 11，无描边
    tag: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    tagText: { fontSize: 11, fontWeight: '500', color: Romance.sub },
    tagNum: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    // 最后一天整条 accent
    tagUrgent: { color: Romance.accentStrong },
    heartBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.screen,
      paddingVertical: 8,
      backgroundColor: Romance.card,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    heartLabel: { fontSize: 12, fontWeight: '600', color: Romance.accentStrong },
    heartTrack: {
      flex: 1,
      height: 7,
      borderRadius: Shape.radiusTail,
      backgroundColor: Romance.bg,
      overflow: 'hidden',
    },
    heartFill: { height: '100%', backgroundColor: Romance.accent },
    heartNum: { fontFamily: Fonts.labelBold, fontSize: 12, color: Romance.accentStrong },
    // offer 卡：白卡描边，贴在输入栏上方
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      marginHorizontal: Space.screen,
      marginBottom: 8,
    },
    ctaText: { flex: 1 },
    ctaTitle: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    ctaSub: { fontSize: 11, color: Romance.sub, marginTop: 2 },
  })
);

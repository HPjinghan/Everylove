/**
 * 交友试聊（D-040 滑到即配对后进入这里）：TA 先开口。
 * 免费层机制：TA 有点兴趣但不太主动；3 天不聊配对过期、TA 会忘记你。
 * 心动值（D-029）：她每开口一句都会涨（速度 = 角色的确定关系节奏 offerAfterTurns，±15% 浮动）；
 * 满 100 = 羁绊 LV1——TA 主动开口交换联系方式（产品触发器，不由模型决定；features/adoption.ts）。
 * 回合走底座管线（D-086）：这里只管界面与 TA 的开场白。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { scriptFor } from '@/content/characters';
import { Romance, themed } from '@/constants/theme';
import { himMsg, wait } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { sendImage, sendText, sendVoice, squareScope } from '@/lib/chat';
import { findCharacter, useAppStore } from '@/store/app-store';

export default function SquareChatScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const character = findCharacter(characterId);
  const chat = useAppStore((s) => s.squareChats[characterId]);
  const bond = useAppStore((s) => s.bonds.find((b) => b.characterId === characterId));
  const [typing, setTyping] = useState(false);
  const booted = useRef(false);

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
        </Pressable>
        <CharAvatar name={character.name} color={character.color} size={36} characterId={character.id} />
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{character.name}</Text>
          <Text style={styles.headerSub}>{character.identity}</Text>
        </View>
        <View style={styles.squareTag}>
          <Text style={styles.squareTagText}>{character.custom ? t('你创造的 TA') : t('刚刚配对')}</Text>
        </View>
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
        banner={
          <View style={styles.banner}>
            <View style={styles.heartRow}>
              <Text style={styles.heartLabel}>{t('心动')}</Text>
              <View style={styles.heartTrack}>
                <View
                  style={[
                    styles.heartFill,
                    { width: `${Math.min(100, chat?.heart ?? 0)}%` },
                  ]}
                />
              </View>
              <Text style={styles.heartNum}>
                {Math.min(100, chat?.heart ?? 0)}/{HEART_FULL}
              </Text>
            </View>
          </View>
        }
        cta={
          offered ? (
            <View style={styles.ctaWrap}>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>
                  {character.custom ? t('TA 想和你确定关系') : t('TA 想要你的联系方式')}
                </Text>
                {character.custom ? (
                  <Text style={styles.ctaSub}>{t('这一次，是 TA 自己想留在你身边')}</Text>
                ) : null}
              </View>
              <Pressable
                style={styles.ctaBtn}
                onPress={() =>
                  router.push({
                    pathname: '/adopt/[characterId]',
                    params: { characterId: character.id },
                  })
                }>
                <Text style={styles.ctaBtnText}>
                  {character.custom ? t('答应 TA') : t('交换联系方式')}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Romance.line,
    },
    headerText: { flex: 1 },
    headerName: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    headerSub: { fontSize: 11, color: Romance.sub },
    squareTag: {
      backgroundColor: Romance.line,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    squareTagText: { fontSize: 10, color: Romance.sub },
    banner: {
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: Romance.accentSoft,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 4,
    },
    heartRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heartLabel: { fontSize: 11, color: Romance.accent, fontWeight: '700' },
    heartTrack: {
      width: 120,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    },
    heartFill: { height: '100%', borderRadius: 4, backgroundColor: Romance.accent },
    heartNum: { fontSize: 11, color: Romance.accent, fontWeight: '600' },
    ctaWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginBottom: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 12,
      shadowColor: '#3B2126',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    ctaTextWrap: { flex: 1 },
    ctaTitle: { fontSize: 14, fontWeight: '700', color: Romance.ink },
    ctaSub: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    ctaBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    ctaBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  })
);

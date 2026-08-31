/**
 * 交友试聊（D-040 滑到即配对后进入这里）：TA 先开口。
 * 免费层机制：TA 有点兴趣但不太主动；3 天不聊配对过期、TA 会忘记你。
 * 心动值（D-029）：她每开口一句都会涨（速度 = 角色的确定关系节奏 offerAfterTurns，±15% 浮动）；
 * 满 100 = 羁绊 LV1——TA 主动开口交换联系方式（产品触发器，不由模型决定），
 * 缔结后 TA 说去忙了、不再回消息（广场偶遇的告别），直到八点开门。
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
import { HEART_FULL, heartGain } from '@/lib/bond';
import { ADOPTION_OFFER_AFTER_TURNS, darkSideCheck, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ChatMessage } from '@/lib/types';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function himMsg(text: string, kind: 'text' | 'voice' = 'text'): ChatMessage {
  return { id: uid('m'), from: 'him', kind, text, at: Date.now() };
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
            text: t('配对已过期——TA 忘记你了。重新开始吧。'),
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

  const onSend = async (text: string, replyTo?: ReplyRef) => {
    const { appendSquare, engine, anthropicKey, qianfanKey } = useAppStore.getState();
    const pace = character.offerAfterTurns ?? ADOPTION_OFFER_AFTER_TURNS;
    const turnsSoFar = useAppStore.getState().squareChats[character.id]?.userTurns ?? 0;
    appendSquare(
      character.id,
      [{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now(), replyTo }],
      {
        userTurn: true,
        heartDelta: heartGain(pace, turnsSoFar * 31 + text.length),
      }
    );

    const current = useAppStore.getState().squareChats[character.id];

    // 系统层前置：暗面路由绕过一切模式，任何引擎不可绕过
    const dark = darkSideCheck(text);
    let darkSide = false;
    if (dark) {
      darkSide = true;
      setTyping(true);
      await wait(900);
      setTyping(false);
      for (const t of dark.texts) {
        useAppStore.getState().appendSquare(character.id, [himMsg(t)]);
      }
    } else {
      // 纯文本回复（D-037：初见回归纯文本，会话内生图已下线）
      setTyping(true);
      const reply = await generateReply(
        {
          character,
          mode: 'square',
          me: meForCharacter(character.id),
          history: current?.messages ?? [],
          userText: text,
        },
        engine,
        { anthropic: anthropicKey, qianfan: qianfanKey }
      );
      await wait(700 + Math.min(1200, text.length * 40));
      setTyping(false);
      for (const [i, t] of reply.texts.entries()) {
        if (i > 0) await wait(500);
        useAppStore.getState().appendSquare(character.id, [himMsg(t)]);
      }
      darkSide = !!reply.darkSide;
    }

    // 羁绊 LV1 触发（D-029）：心动值满 100，TA 主动开口交换联系方式（只在非暗面回合）
    const after = useAppStore.getState().squareChats[character.id];
    if (after && !after.adoptionOffered && !darkSide && (after.heart ?? 0) >= HEART_FULL) {
      const script = scriptFor(character);
      await wait(1100);
      for (const line of script.offer) {
        setTyping(true);
        await wait(800);
        setTyping(false);
        useAppStore.getState().appendSquare(character.id, [himMsg(line)]);
      }
      useAppStore.getState().appendSquare(character.id, [], { offered: true });
    }
  };

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
        onSendImage={(uri) =>
          useAppStore
            .getState()
            .appendSquare(character.id, [
              { id: uid('m'), from: 'me', kind: 'image', text: '', imageUri: uri, at: Date.now() },
            ])
        }
        onSendVoice={(uri, durationMs) =>
          useAppStore
            .getState()
            .appendSquare(character.id, [
              { id: uid('m'), from: 'me', kind: 'voice', text: '', audioUri: uri, durationMs, at: Date.now() },
            ])
        }
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
            <Text style={styles.bannerText}>
              {character.custom
                ? t('TA 是你亲手创造的 · 心动满了，TA 会想和你确定关系')
                : t('3 天不聊，TA 会忘记你')}
            </Text>
          </View>
        }
        cta={
          offered ? (
            <View style={styles.ctaWrap}>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>
                  {character.custom ? t('羁绊 LV1 · TA 想和你确定关系') : t('羁绊 LV1 · TA 想要你的联系方式')}
                </Text>
                <Text style={styles.ctaSub}>
                  {character.custom
                    ? t('这一次，是 TA 自己想留在你身边')
                    : t('加好友之后，TA 会搬进你的 Message 里')}
                </Text>
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
    bannerText: { fontSize: 10, color: Romance.sub },
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

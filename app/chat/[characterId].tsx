/**
 * 广场试聊：即点即聊，他先开口。
 * 免费层机制：他有点兴趣但不太主动；3 天不聊他会忘记你；
 * 用户第 4 次发言后，他开口要联系方式（领养触发，产品触发器）。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { ChatThread } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { scriptFor } from '@/content/characters';
import { Romance } from '@/constants/theme';
import { ADOPTION_OFFER_AFTER_TURNS, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import type { ChatMessage } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

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
            text: '搭话记录已过期——他忘记你了。重新开始吧。',
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

  if (!character) return <Redirect href="/(tabs)" />;
  if (bond) {
    return <Redirect href={{ pathname: '/bond/[bondId]', params: { bondId: bond.id } }} />;
  }

  const onSend = async (text: string) => {
    const { appendSquare, engine, anthropicKey } = useAppStore.getState();
    appendSquare(character.id, [{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now() }], {
      userTurn: true,
    });

    const current = useAppStore.getState().squareChats[character.id];
    setTyping(true);
    const reply = await generateReply(
      {
        character,
        mode: 'square',
        history: current?.messages ?? [],
        userText: text,
      },
      engine,
      anthropicKey
    );
    await wait(700 + Math.min(1200, text.length * 40));
    setTyping(false);
    for (const [i, t] of reply.texts.entries()) {
      if (i > 0) await wait(500);
      useAppStore.getState().appendSquare(character.id, [himMsg(t)]);
    }

    // 领养触发：他开口要联系方式（只在非暗面回合）
    const after = useAppStore.getState().squareChats[character.id];
    if (
      after &&
      !after.adoptionOffered &&
      !reply.darkSide &&
      after.userTurns >= ADOPTION_OFFER_AFTER_TURNS
    ) {
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
        <CharAvatar name={character.name} color={character.color} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.headerName}>{character.name}</Text>
          <Text style={styles.headerSub}>{character.identity}</Text>
        </View>
        <View style={styles.squareTag}>
          <Text style={styles.squareTagText}>广场搭话</Text>
        </View>
      </View>

      <ChatThread
        messages={chat?.messages ?? []}
        color={character.color}
        name={character.name}
        typing={typing}
        onSend={onSend}
        banner={
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              TA 现在只是有点在意你 · 3 天不聊，TA 会忘记你
            </Text>
          </View>
        }
        cta={
          offered ? (
            <View style={styles.ctaWrap}>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>TA 想要你的联系方式</Text>
                <Text style={styles.ctaSub}>交换之后，TA 会搬进你的消息里</Text>
              </View>
              <Pressable
                style={styles.ctaBtn}
                onPress={() =>
                  router.push({
                    pathname: '/adopt/[characterId]',
                    params: { characterId: character.id },
                  })
                }>
                <Text style={styles.ctaBtnText}>交换联系方式</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Romance.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerText: { fontSize: 11, color: Romance.accent },
  ctaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ctaBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

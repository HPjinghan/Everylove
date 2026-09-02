/**
 * 羁绊会话：加好友之后的家。会话顶部进「他的主页」。
 * 开门/离席已下线（D-046）：加好友即在线，TA 一直会回消息。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { ChatThread, type ReplyRef } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ARCHETYPE_LABEL } from '@/content/characters';
import { characterSecrets, unlockedSecretCount } from '@/content/prompts';
import { Romance, themed } from '@/constants/theme';
import { describeAiError, generateReply } from '@/lib/engine';
import { updateBondMemory } from '@/lib/memory';
import { daysTogether, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { levelInfo, XP_PER_MESSAGE } from '@/lib/bond';
import type { EngineReply } from '@/lib/types';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BondScreen() {
  const { bondId } = useLocalSearchParams<{ bondId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bond = useAppStore((s) => s.bonds.find((b) => b.id === bondId));
  const [typing, setTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const messageCount = bond?.messages.length ?? 0;
  useEffect(() => {
    if (bond && bond.unread > 0) {
      useAppStore.getState().markBondRead(bond.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bondId, messageCount]);

  if (!bond) return <Redirect href="/apps/messages" />;
  const character = findCharacter(bond.characterId);
  if (!character) return <Redirect href="/apps/messages" />;

  const onSend = async (text: string, replyTo?: ReplyRef) => {
    const { appendBond } = useAppStore.getState();
    appendBond(
      bond.id,
      [{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now(), replyTo }],
      { affinityDelta: XP_PER_MESSAGE }
    );

    setTyping(true);
    const current = useAppStore.getState().bonds.find((b) => b.id === bond.id);
    let reply: EngineReply;
    try {
      reply = await generateReply({
        character,
        mode: 'bonded',
        bond: {
          name: bond.name,
          nickname: bond.nickname,
          affinity: bond.affinity,
          birthday: bond.birthday,
          createdAt: bond.createdAt,
          memory: current?.memory,
        },
        me: meForCharacter(character.id),
        history: current?.messages ?? [],
        userText: text,
      });
    } catch (e) {
      // 模型调用失败：在会话里露出原因（D-069：没有脚本回落，错误要看得见）
      setTyping(false);
      useAppStore.getState().appendBond(bond.id, [
        {
          id: uid('m'),
          from: 'system',
          kind: 'system',
          text: t('模型调用失败，TA 这条没回上：{reason}', { reason: describeAiError(e) }),
          at: Date.now(),
        },
      ]);
      return;
    }
    await wait(700 + Math.min(1200, text.length * 40));
    setTyping(false);
    for (const [i, t] of reply.texts.entries()) {
      if (i > 0) await wait(500);
      useAppStore
        .getState()
        .appendBond(bond.id, [{ id: uid('m'), from: 'him', kind: 'text', text: t, at: Date.now() }]);
    }

    // 记忆库后台更新：每隔几轮提取长期事实 + 滚动摘要，失败静默（D-016）
    // （升级出画面已下线：聊天回归纯文本，D-037；升级系统提示仍在 store.appendBond）
    void updateBondMemory(bond.id);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
        </Pressable>
        <Pressable style={styles.headerMain} onPress={() => setProfileOpen(true)}>
          <CharAvatar name={bond.name} color={character.color} size={36} characterId={character.id} />
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{bond.name}</Text>
            <Text style={styles.headerSub}>
              {t('羁绊')} LV{levelInfo(bond.affinity).level} · {t(levelInfo(bond.affinity).name)}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={14} color={Romance.faint} />
        </Pressable>
      </View>

      <ChatThread
        messages={bond.messages}
        color={character.color}
        name={bond.name}
        characterId={character.id}
        variant="line"
        typing={typing}
        onSend={onSend}
        onSendImage={(uri) =>
          useAppStore
            .getState()
            .appendBond(bond.id, [
              { id: uid('m'), from: 'me', kind: 'image', text: '', imageUri: uri, at: Date.now() },
            ])
        }
        onSendVoice={(uri, durationMs) =>
          useAppStore
            .getState()
            .appendBond(bond.id, [
              { id: uid('m'), from: 'me', kind: 'voice', text: '', audioUri: uri, durationMs, at: Date.now() },
            ])
        }
        onRecall={(m) => useAppStore.getState().recallMessage({ bondId: bond.id }, m.id)}
        onDelete={(m) => useAppStore.getState().deleteMessage({ bondId: bond.id }, m.id)}
        placeholder={t('和{name}说点什么…', { name: bond.name })}
      />

      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.profile}>
          <Pressable style={styles.profileClose} onPress={() => setProfileOpen(false)}>
            <IconSymbol name="xmark" size={18} color={Romance.sub} />
          </Pressable>
          <CharAvatar name={bond.name} color={character.color} size={84} characterId={character.id} />
          <Text style={styles.profileName}>{bond.name}</Text>
          <Text style={styles.profileIdentity}>
            {character.identity} · {character.styleLabel ?? ARCHETYPE_LABEL[character.archetype]}
          </Text>

          <View style={styles.profileStats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>LV{levelInfo(bond.affinity).level}</Text>
              <Text style={styles.statLabel}>{t(levelInfo(bond.affinity).name)}</Text>
              <View style={styles.lvBarTrack}>
                <View
                  style={[styles.lvBarFill, { width: `${levelInfo(bond.affinity).ratio * 100}%` }]}
                />
              </View>
              <Text style={styles.lvBarText}>
                {levelInfo(bond.affinity).max
                  ? 'MAX'
                  : `${levelInfo(bond.affinity).gained}/${levelInfo(bond.affinity).need}`}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{daysTogether(bond.createdAt)}</Text>
              <Text style={styles.statLabel}>{t('在一起的天数')}</Text>
            </View>
          </View>

          <View style={styles.profileRows}>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('TA 叫你')}</Text>
              <Text style={styles.profileRowValue}>「{bond.nickname}」</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('纪念日')}</Text>
              <Text style={styles.profileRowValue}>
                {new Date(bond.createdAt).toLocaleDateString('zh-CN')} {t('交换联系方式')}
              </Text>
            </View>
            {bond.birthday && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t('你的生日')}</Text>
                <Text style={styles.profileRowValue}>{bond.birthday}</Text>
              </View>
            )}
            {characterSecrets(character).length > 0 && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>{t('TA 的秘密')}</Text>
                <Text style={styles.profileRowValueDim}>
                  {t('已看见')} {unlockedSecretCount(levelInfo(bond.affinity).level, characterSecrets(character).length)}/
                  {characterSecrets(character).length} · {t('关系越近，看得越深')}
                </Text>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('TA 的故事')}</Text>
              <Text style={styles.profileRowValueDim}>{t('主线连载 · 敬请期待')}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>{t('相册')}</Text>
              <Text style={styles.profileRowValueDim}>{t('正在慢慢变厚')}</Text>
            </View>
          </View>
        </View>
      </Modal>
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
    headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerText: { flex: 1 },
    headerName: { fontSize: 16, fontWeight: '600', color: Romance.ink },
    headerSub: { fontSize: 11, color: Romance.accent },
    banner: {
      alignSelf: 'center',
      backgroundColor: Romance.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    bannerText: { fontSize: 11, color: Romance.accent },
    profile: { flex: 1, backgroundColor: Romance.bg, alignItems: 'center', paddingTop: 40 },
    profileClose: { position: 'absolute', top: 16, right: 16, padding: 8 },
    profileName: { fontSize: 24, fontWeight: '700', color: Romance.ink, marginTop: 14 },
    profileIdentity: { fontSize: 13, color: Romance.sub, marginTop: 4 },
    profileStats: { flexDirection: 'row', gap: 14, marginTop: 24 },
    stat: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingVertical: 14,
      alignItems: 'center',
      minWidth: 130,
    },
    statNum: { fontSize: 24, fontWeight: '700', color: Romance.accent },
    lvBarTrack: {
      width: 96,
      height: 6,
      borderRadius: 3,
      backgroundColor: Romance.accentSoft,
      marginTop: 8,
      overflow: 'hidden',
    },
    lvBarFill: { height: '100%', borderRadius: 3, backgroundColor: Romance.accent },
    lvBarText: { fontSize: 10, color: Romance.faint, marginTop: 4 },
    statLabel: { fontSize: 11, color: Romance.sub, marginTop: 4 },
    profileRows: { alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 24, gap: 10 },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    profileRowLabel: { fontSize: 13, color: Romance.sub },
    profileRowValue: { fontSize: 13, color: Romance.ink, fontWeight: '500' },
    profileRowValueDim: { fontSize: 13, color: Romance.faint },
  })
);

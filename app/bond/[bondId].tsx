/**
 * 羁绊会话：领回家之后的家。
 * 他主动、有作息；到点开门的消息在这里投递。会话顶部进「他的主页」。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { ChatThread } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ARCHETYPE_LABEL } from '@/content/characters';
import { Romance } from '@/constants/theme';
import { generateReply } from '@/lib/engine';
import { deliverComic } from '@/lib/imagegen';
import { daysTogether, uid } from '@/lib/format';
import { arrivalTimeLabel } from '@/lib/notifications';
import { affinityStage, findCharacter, useAppStore } from '@/store/app-store';

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

  if (!bond) return <Redirect href="/(tabs)/messages" />;
  const character = findCharacter(bond.characterId);
  if (!character) return <Redirect href="/(tabs)/messages" />;

  const onSend = async (text: string) => {
    const { appendBond, markAwayNotified, engine, anthropicKey, qianfanKey } =
      useAppStore.getState();
    appendBond(
      bond.id,
      [{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now() }],
      { affinityDelta: 1 }
    );

    // 他先走了就是真的走了：离席期不回复，只提示一次（D-012，会离开的才是人）
    if (bond.away) {
      if (!bond.awayNotified) {
        markAwayNotified(bond.id);
        const timeLabel = bond.arrivalAt
          ? arrivalTimeLabel(bond.arrivalAt, new Date())
          : '晚点';
        useAppStore.getState().appendBond(bond.id, [
          {
            id: uid('m'),
            from: 'system',
            kind: 'system',
            text: `${bond.name}去忙了，${timeLabel}会来找你`,
            at: Date.now(),
          },
        ]);
      }
      return;
    }

    setTyping(true);
    const current = useAppStore.getState().bonds.find((b) => b.id === bond.id);
    const reply = await generateReply(
      {
        character,
        mode: 'bonded',
        bond: {
          name: bond.name,
          nickname: bond.nickname,
          affinity: bond.affinity,
          birthday: bond.birthday,
        },
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
      useAppStore
        .getState()
        .appendBond(bond.id, [{ id: uid('m'), from: 'him', kind: 'text', text: t, at: Date.now() }]);
    }

    // 亲密度每跨过一个 20 的整数级，他送来一格漫画（显影以剧情语法送达，D-013）
    if (Math.floor((bond.affinity + 1) / 20) > Math.floor(bond.affinity / 20)) {
      deliverComic(bond.id);
    }
  };

  const arrivalPending = bond.arrivalAt && bond.arrivalAt > Date.now();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
        </Pressable>
        <Pressable style={styles.headerMain} onPress={() => setProfileOpen(true)}>
          <CharAvatar name={bond.name} color={character.color} size={36} />
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{bond.name}</Text>
            <Text style={styles.headerSub}>
              ♥ {bond.affinity} · {affinityStage(bond.affinity)}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={14} color={Romance.faint} />
        </Pressable>
      </View>

      <ChatThread
        messages={bond.messages}
        color={character.color}
        name={bond.name}
        typing={typing}
        onSend={onSend}
        placeholder={`和${bond.name}说点什么…`}
        banner={
          arrivalPending ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {arrivalTimeLabel(bond.arrivalAt!)}TA 会来找你 · TA 说到做到
              </Text>
            </View>
          ) : null
        }
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
          <CharAvatar name={bond.name} color={character.color} size={84} />
          <Text style={styles.profileName}>{bond.name}</Text>
          <Text style={styles.profileIdentity}>
            {character.identity} · {character.styleLabel ?? ARCHETYPE_LABEL[character.archetype]}
          </Text>

          <View style={styles.profileStats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{bond.affinity}</Text>
              <Text style={styles.statLabel}>亲密度 · {affinityStage(bond.affinity)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{daysTogether(bond.createdAt)}</Text>
              <Text style={styles.statLabel}>在一起的天数</Text>
            </View>
          </View>

          <View style={styles.profileRows}>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>TA 叫你</Text>
              <Text style={styles.profileRowValue}>「{bond.nickname}」</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>纪念日</Text>
              <Text style={styles.profileRowValue}>
                {new Date(bond.createdAt).toLocaleDateString('zh-CN')} 交换联系方式
              </Text>
            </View>
            {bond.birthday && (
              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>你的生日</Text>
                <Text style={styles.profileRowValue}>{bond.birthday}（他记下了）</Text>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>TA 的故事</Text>
              <Text style={styles.profileRowValueDim}>主线连载 · 敬请期待</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileRowLabel}>相册</Text>
              <Text style={styles.profileRowValueDim}>显影中 · 敬请期待</Text>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    minWidth: 130,
  },
  statNum: { fontSize: 24, fontWeight: '700', color: Romance.accent },
  statLabel: { fontSize: 11, color: Romance.sub, marginTop: 4 },
  profileRows: { alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 24, gap: 10 },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  profileRowLabel: { fontSize: 13, color: Romance.sub },
  profileRowValue: { fontSize: 13, color: Romance.ink, fontWeight: '500' },
  profileRowValueDim: { fontSize: 13, color: Romance.faint },
});

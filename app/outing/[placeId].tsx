/**
 * 外出场景（D-038/D-040）：两个人真的在同一个空间——亲身互动的故事模式。
 * 有约定 = 赴约（TA 提前到了，约定优先于离席：TA 说到做到）；
 * 没有 = 偶遇（通讯录里、此刻不在忙的人恰好也在）；
 * 广场 = 偶遇陌生人（D-040：还没配对的角色，TA 不认识她、也没有她的资料——想再见去「交友」里滑）。
 * 她在这里发的每句话同样 +XP（仅限有羁绊的 TA）；
 * 结束外出时在羁绊会话留一条「你们一起去了××」的系统记录（陌生人不留）。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatThread } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { OUTING_OPENERS } from '@/content/prompts';
import { placeById } from '@/content/places';
import { Romance, themed } from '@/constants/theme';
import { XP_PER_MESSAGE } from '@/lib/bond';
import { generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { weatherLine } from '@/lib/weather';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function OutingSceneScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const place = placeById(placeId);
  const session = useAppStore((s) => s.outingSession);
  const bonds = useAppStore((s) => s.bonds);
  const [typing, setTyping] = useState(false);
  const [noOne, setNoOne] = useState(false);
  const booted = useRef(false);

  const active = session && session.placeId === placeId ? session : null;
  const bond = active ? bonds.find((b) => b.characterId === active.characterId) : undefined;
  const character = active ? findCharacter(active.characterId) : undefined;

  // 进场：开一场外出；新场次由 TA 先开口（离线模板，带现场动作）
  useEffect(() => {
    if (!place || booted.current) return;
    booted.current = true;
    const s = useAppStore.getState().startOuting(place.id);
    if (!s) {
      setNoOne(true);
      return;
    }
    if (s.messages.length === 0) {
      const b = useAppStore.getState().bonds.find((x) => x.characterId === s.characterId);
      const pool = OUTING_OPENERS[s.kind];
      const line = pool[Math.floor(Math.random() * pool.length)]
        .replace(/\{place\}/g, place.name)
        .replace(/\{nickname\}/g, b?.nickname ?? '你');
      void (async () => {
        setTyping(true);
        await wait(1000);
        setTyping(false);
        useAppStore.getState().appendOuting([
          { id: uid('m'), from: 'him', kind: 'text', text: line, at: Date.now() },
        ]);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!place) return <Redirect href="/apps/outing" />;

  const leave = () => {
    useAppStore.getState().endOuting();
    router.back();
  };

  // 没遇到人：广场新面孔见完了 / 还没有好友 / 大家都在忙
  if (noOne) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Header place={place} subtitle={weatherLine()} onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>{place.emoji}</Text>
          <Text style={styles.emptyText}>
            {place.stranger
              ? '广场今天安安静静的——\n新面孔都被你认识完了。'
              : bonds.length
                ? '认识的人这会儿都在忙。\n晚上八点之后再出来走走，说不定就遇到了。'
                : '这里风景很好，但一个人逛有点安静。\n去广场碰碰运气，或先在「交友」里滑一滑。'}
          </Text>
        </View>
      </View>
    );
  }

  if (!active || !character) return null;

  const onSend = async (text: string) => {
    const { appendOuting, appendBond, engine, anthropicKey, qianfanKey } = useAppStore.getState();
    appendOuting([{ id: uid('m'), from: 'me', kind: 'text', text, at: Date.now() }]);
    // 她开口 = +XP（升级系统提示会出现在羁绊会话里）
    if (bond) appendBond(bond.id, [], { affinityDelta: XP_PER_MESSAGE });

    setTyping(true);
    const current = useAppStore.getState().outingSession;
    const reply = await generateReply(
      {
        character,
        mode: 'outing',
        bond: bond
          ? {
              name: bond.name,
              nickname: bond.nickname,
              affinity: bond.affinity,
              birthday: bond.birthday,
              createdAt: bond.createdAt,
              memory: bond.memory,
            }
          : undefined,
        me: meForCharacter(character.id),
        outing: {
          placeName: place.name,
          scene: place.scene,
          kind: active.kind,
          weatherLine: weatherLine(),
        },
        history: current?.messages ?? [],
        userText: text,
      },
      engine,
      { anthropic: anthropicKey, qianfan: qianfanKey }
    );
    await wait(700 + Math.min(1200, text.length * 40));
    setTyping(false);
    for (const t of reply.texts) {
      useAppStore
        .getState()
        .appendOuting([{ id: uid('m'), from: 'him', kind: 'text', text: t, at: Date.now() }]);
    }
  };

  const name = bond?.name ?? character.name;
  const subtitle =
    active.kind === 'date'
      ? `和${name}的约会`
      : active.kind === 'stranger'
        ? `陌生人 · ${name}`
        : `偶遇了${name}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header
        place={place}
        subtitle={`${subtitle} · ${weatherLine()}`}
        onBack={() => router.back()}
        onLeave={leave}
      />
      <ChatThread
        messages={active.messages}
        color={character.color}
        name={name}
        characterId={character.id}
        typing={typing}
        typingLabel="……"
        onSend={onSend}
        placeholder="说点什么，或用（）写下你的动作…"
        banner={
          <View style={styles.sceneBanner}>
            <Text style={styles.sceneBannerText}>
              {active.kind === 'stranger'
                ? `${place.emoji} 你们还不认识 · 想再见到 TA，去「交友」里滑到 TA`
                : `${place.emoji} ${place.hook} · 你们面对面`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function Header({
  place,
  subtitle,
  onBack,
  onLeave,
}: {
  place: { name: string; emoji: string };
  subtitle: string;
  onBack: () => void;
  onLeave?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10}>
        <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerName}>
          {place.emoji} {place.name}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {onLeave ? (
        <Pressable style={styles.leaveBtn} onPress={onLeave} hitSlop={6}>
          <Text style={styles.leaveText}>结束外出</Text>
        </Pressable>
      ) : null}
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
    headerSub: { fontSize: 11, color: Romance.sub, marginTop: 1 },
    leaveBtn: {
      backgroundColor: Romance.line,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    leaveText: { fontSize: 11, color: Romance.sub, fontWeight: '600' },
    sceneBanner: {
      alignSelf: 'center',
      backgroundColor: Romance.accentSoft,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    sceneBannerText: { fontSize: 11, color: Romance.accent },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyEmoji: { fontSize: 52 },
    emptyText: {
      textAlign: 'center',
      fontSize: 13,
      color: Romance.sub,
      lineHeight: 21,
      marginTop: 14,
    },
  })
);

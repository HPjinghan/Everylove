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
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatThread } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { scriptFor } from '@/content/characters';
import { buildOutingPhotoPrompt, OUTING_OPENERS, transcript } from '@/content/prompts';
import { placeById } from '@/content/places';
import { Romance, themed } from '@/constants/theme';
import { HEART_FULL, heartGain, XP_PER_MESSAGE } from '@/lib/bond';
import { ADOPTION_OFFER_AFTER_TURNS, generateReply } from '@/lib/engine';
import { uid } from '@/lib/format';
import { generateScenePhoto, imageKeyReady } from '@/lib/imagegen';
import { t } from '@/lib/i18n';
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
  const [shooting, setShooting] = useState<null | 'solo' | 'together'>(null);
  const booted = useRef(false);

  const active = session && session.placeId === placeId ? session : null;
  const bond = active ? bonds.find((b) => b.characterId === active.characterId) : undefined;
  const character = active ? findCharacter(active.characterId) : undefined;
  const squareChat = useAppStore((s) =>
    active ? s.squareChats[active.characterId] : undefined
  );
  // 陌生人在现场交换了联系方式后（D-056），这场偶遇就地升格为熟人偶遇
  const kind = active?.kind === 'stranger' && bond ? 'encounter' : active?.kind;

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
              ? t('广场今天安安静静的——\n新面孔都被你认识完了。')
              : bonds.length
                ? t('认识的人这会儿都在忙。\n晚上八点之后再出来走走，说不定就遇到了。')
                : t('这里风景很好，但一个人逛有点安静。\n去广场碰碰运气，或先在「交友」里滑一滑。')}
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

    // 陌生人偶遇也积累心动（D-056）：与交友试聊同一套心动值（记在 squareChats 上，两处共通）
    if (!bond) {
      const { ensureSquareChat, appendSquare } = useAppStore.getState();
      ensureSquareChat(character.id);
      const chat = useAppStore.getState().squareChats[character.id];
      const pace = character.offerAfterTurns ?? ADOPTION_OFFER_AFTER_TURNS;
      appendSquare(character.id, [], {
        userTurn: true,
        heartDelta: heartGain(pace, (chat?.userTurns ?? 0) * 31 + text.length),
      });
    }

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
          kind: kind ?? active.kind,
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
    for (const line of reply.texts) {
      useAppStore
        .getState()
        .appendOuting([{ id: uid('m'), from: 'him', kind: 'text', text: line, at: Date.now() }]);
    }

    // 心动满 100（D-056）：TA 当场开口想交换联系方式（产品触发器，不由模型决定，D-029 纪律）
    const after = useAppStore.getState().squareChats[character.id];
    if (!bond && after && !after.adoptionOffered && (after.heart ?? 0) >= HEART_FULL) {
      const script = scriptFor(character);
      for (const line of script.offer) {
        await wait(900);
        useAppStore
          .getState()
          .appendOuting([{ id: uid('m'), from: 'him', kind: 'text', text: line, at: Date.now() }]);
      }
      useAppStore.getState().appendSquare(character.id, [], { offered: true });
    }
  };

  const name = bond?.name ?? character.name;

  /** 拍照（D-051）：合影 / 拍TA——她主动按快门；照片在结束外出时并入羁绊会话与相册 */
  const shoot = async (kind: 'solo' | 'together') => {
    if (shooting) return;
    if (!imageKeyReady()) {
      Alert.alert(t('未配置千帆 key'), t('拍照与聊天共用千帆 key：在 .env.local 或「设置 → 开发者」里填好即可。'));
      return;
    }
    setShooting(kind);
    try {
      const digest = transcript(active.messages.slice(-4), '主角');
      const uri = await generateScenePhoto(
        buildOutingPhotoPrompt(character, {
          placeName: place.name,
          scene: place.scene,
          weatherLine: weatherLine(),
          kind,
          digest: digest || undefined,
        })
      );
      useAppStore.getState().appendOuting([
        {
          id: uid('m'),
          from: 'me',
          kind: 'image',
          // 拍立得手写字（D-056）
          text:
            kind === 'together'
              ? t('和{name}的合影 · {place}', { name, place: t(place.name) })
              : name + ' · ' + t(place.name),
          imageUri: uri,
          polaroid: true,
          at: Date.now(),
        },
      ]);
    } catch (e) {
      console.warn('[outing] 拍照失败：', e);
      Alert.alert(t('没拍成'), t('生图服务出了点问题，可以再试一次。'));
    } finally {
      setShooting(null);
    }
  };

  const heart = Math.min(HEART_FULL, squareChat?.heart ?? 0);
  const offered = !bond && !!squareChat?.adoptionOffered;
  const subtitle =
    kind === 'date'
      ? t('和{name}的约会', { name })
      : kind === 'stranger'
        ? t('陌生人 · {name} · 心动 {h}/{f}', { name, h: heart, f: HEART_FULL })
        : t('偶遇了{name}', { name });

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
        placeholder={t('说点什么，或用（）写下你的动作…')}
        cta={
          <View>
            {offered ? (
              <View style={styles.offerWrap}>
                <View style={styles.offerText}>
                  <Text style={styles.offerTitle}>{t('羁绊 LV1 · TA 想和你交换联系方式')}</Text>
                  <Text style={styles.offerSub}>{t('就在这里、就是现在——面对面的那种')}</Text>
                </View>
                <Pressable
                  style={styles.offerBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/adopt/[characterId]',
                      params: { characterId: character.id },
                    })
                  }>
                  <Text style={styles.offerBtnText}>{t('交换')}</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.shootRow}>
            <Pressable
              style={[styles.shootBtn, shooting && styles.shootBtnDim]}
              disabled={!!shooting}
              onPress={() => shoot('together')}>
              <Text style={styles.shootText}>
                {shooting === 'together' ? t('拍摄中…') : t('📸 合影')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.shootBtn, shooting && styles.shootBtnDim]}
              disabled={!!shooting}
              onPress={() => shoot('solo')}>
              <Text style={styles.shootText}>{shooting === 'solo' ? t('拍摄中…') : t('📷 拍 TA')}</Text>
            </Pressable>
            </View>
          </View>
        }
        banner={
          <View style={styles.sceneBanner}>
            <Text style={styles.sceneBannerText}>
              {kind === 'stranger'
                ? `${place.emoji} ${t('你们还不认识 · 聊得来，TA 会想留下你的联系方式')}`
                : `${place.emoji} ${t(place.hook)} · ${t('你们面对面')}`}
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
          {place.emoji} {t(place.name)}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {onLeave ? (
        <Pressable style={styles.leaveBtn} onPress={onLeave} hitSlop={6}>
          <Text style={styles.leaveText}>{t('结束外出')}</Text>
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
    shootRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingBottom: 8,
    },
    shootBtn: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 10,
      alignItems: 'center',
      shadowColor: '#3B2126',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    shootBtnDim: { opacity: 0.5 },
    shootText: { fontSize: 13, fontWeight: '600', color: Romance.ink },
    offerWrap: {
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
    offerText: { flex: 1 },
    offerTitle: { fontSize: 14, fontWeight: '700', color: Romance.ink },
    offerSub: { fontSize: 11, color: Romance.sub, marginTop: 2 },
    offerBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    offerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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

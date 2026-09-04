/**
 * 外出场景（D-038/D-040）：两个人真的在同一个空间——亲身互动的故事模式。
 * 有约定 = 赴约（TA 提前到了，约定优先于离席：TA 说到做到）；
 * 没有 = 偶遇（通讯录里、此刻不在忙的人恰好也在）；
 * 广场 = 偶遇陌生人（D-040：还没配对的角色，TA 不认识她、也没有她的资料——想再见去「交友」里滑）。
 * 她在这里发的每句话同样 +XP（仅限有羁绊的 TA）；
 * 结束外出时在羁绊会话留一条「你们一起去了××」的系统记录（陌生人不留），现场对话并进羁绊记忆（D-079）；
 * 没点结束就离开，TA 还在这里等——一小时没说话再进来才是新的一场；照片洗好即进相册（lib/outing.ts）。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatThread } from '@/components/chat-thread';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { outingOpeners } from '@/content/prompts';
import { placeById } from '@/content/places';
import { Romance, themed } from '@/constants/theme';
import { wait } from '@/core/turn';
import { HEART_FULL } from '@/lib/bond';
import { uid } from '@/lib/format';
import { imageKeyReady } from '@/lib/imagegen';
import { t } from '@/lib/i18n';
import { ON_TIME_TOLERANCE_MIN, planTimeLabel } from '@/lib/appointments';
import { outingScope, sendText } from '@/lib/chat';
import { enterPlace, finishOuting, setSceneVisible, shootPhoto } from '@/lib/outing';
import { weatherLine } from '@/lib/weather';
import { findCharacter, useAppStore } from '@/store/app-store';

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
    const s = enterPlace(place.id);
    if (!s) {
      setNoOne(true);
      return;
    }
    if (s.messages.length === 0) {
      const b = useAppStore.getState().bonds.find((x) => x.characterId === s.characterId);
      // 赴约迟到了（D-079）：开场就知道
      const late = s.kind === 'date' && (s.lateMinutes ?? 0) > ON_TIME_TOLERANCE_MIN;
      const openers = outingOpeners();
      const pool = late ? openers.dateLate : openers[s.kind];
      const line = pool[Math.floor(Math.random() * pool.length)]
        .replace(/\{place\}/g, place.name)
        .replace(/\{nickname\}/g, b?.nickname ?? '你')
        .replace(/\{minutes\}/g, String(s.lateMinutes ?? 0));
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

  // 她正看着这一场（D-079）：照片洗好时人在就贴进现场，不在就只进相册并轻提示
  const activeId = active?.id ?? null;
  useEffect(() => {
    setSceneVisible(activeId);
    return () => setSceneVisible(null);
  }, [activeId]);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  if (!place) return <Redirect href="/apps/outing" />;

  const leave = () => {
    finishOuting();
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
                ? t('认识的人这会儿都在忙。\n晚点再来走走。')
                : t('这里风景很好，但一个人逛有点安静。')}
          </Text>
        </View>
      </View>
    );
  }

  if (!active || !character) return null;

  // 回合走底座管线（D-086）：XP / 陌生人心动记账、现场描写不剥、心动满的 offer 都在模式与钩子里
  const onSend = (text: string) => void sendText(outingScope(character.id), text, { ui: { typing: setTyping } });

  const name = bond?.name ?? character.name;

  /** 拍照（D-051/D-079）：合影 / 拍TA——她主动按快门；洗好即进相册，人还在场就贴进现场（lib/outing.ts） */
  const shoot = async (kind: 'solo' | 'together') => {
    if (shooting) return;
    if (!imageKeyReady()) {
      Alert.alert(t('AI 不可用'), t('拍照与聊天共用千帆 key：在 .env.local 配置，或登录后走服务端代理。'));
      return;
    }
    setShooting(kind);
    try {
      await shootPhoto(active, character, place, kind, name);
    } catch (e) {
      console.warn('[outing] 拍照失败：', e);
      if (mounted.current) Alert.alert(t('没拍成'), t('生图服务出了点问题，可以再试一次。'));
    } finally {
      if (mounted.current) setShooting(null);
    }
  };

  const heart = Math.min(HEART_FULL, squareChat?.heart ?? 0);
  const offered = !bond && !!squareChat?.adoptionOffered;
  const subtitle =
    kind === 'date'
      ? `${t('和{name}的约会', { name })}${active.planAt ? ` · ${planTimeLabel(active.planAt)}` : ''}`
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
                  <Text style={styles.offerTitle}>{t('TA 想和你交换联系方式')}</Text>
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
                ? `${place.emoji} ${t('你们还不认识')}`
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

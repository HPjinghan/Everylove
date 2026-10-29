/**
 * 外出场景（D-038/D-040；D-254 跑团式改版）：她真的在一个地方——像跑团，每个地点有自己的规矩，旁白交代环境与工作人员。
 * - 进门（lib/outing.ts enterPlace）：约定窗口里 = 赴约（永远两个人）；打烊了 = 关门的样子；这会儿没人 = 空场；
 *   两人场（咖啡馆 / 书店 / 海边 / 天台 / 便利店）有几位在就先选坐到谁旁边——不认识的人只看得到样子，写「陌生人」；
 *   多人场（广场 / 公园 / 游乐园 / 夜市 / 水族馆）与安静的地方（自习室）、电影院：在场的都在，一次最多三个人。
 * - 输入框左边「（ ）」插一对括号写动作；安静的地方与电影院多一个「纸条」键；输入框上方是这个地方的现成动作。
 * - 多人场里输入框上方第一颗是「@对谁说」（D-255）：点开从底下拉出在场的人，选了这一位，她说的话 / 纸条带上对象，气泡里写「@名字」。
 * - 安静的地方出声三次被请出去：输入框关上，只能离开。多人场里好奇满了的陌生人当场开口要联系方式。
 * - 一人场照旧能拍照（合影 / 拍 TA）；开场 TA 先开口（模型，失败回落模板）；多人场由主持人开场。
 * - 结束外出留记录、现场对话并进在场每位 TA 的记忆（D-079）；没点结束就离开，一小时内回来还在。
 */

import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, showAlert } from '@/components/action-sheet';
import { alertAiUnavailable } from '@/components/ai-unavailable';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { CharacterSheet } from '@/components/character-sheet';
import { ChatThread, type Speakers } from '@/components/chat-thread';
import { DevelopingPolaroid } from '@/components/developing';
import { PixelArt } from '@/components/pixel-art';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { outingOpenerUserLine, pickOutingOpener, SCENE_OPENER_USER } from '@/content/prompts';
import { placeById, type Place } from '@/content/places';
import { sendNote } from '@/features/outing-scene';
import { HEART_FULL } from '@/lib/bond';
import { uid } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { imageKeyReady } from '@/lib/imagegen';
import { t } from '@/lib/i18n';
import { ON_TIME_TOLERANCE_MIN, planTimeLabel } from '@/lib/appointments';
import { describeAiError, resendTurn, respond, sendText, sessionScope, wait } from '@/lib/chat';
import { enterPlace, finishOuting, setSceneVisible, shootPhoto, type EnterResult } from '@/lib/outing';
import { dayPartOf } from '@/lib/presence';
import type { Presence } from '@/lib/presence';
import { tempNow, todayWeather } from '@/lib/weather';
import type { OutingSession } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 进门那一刻怎么开场：一人场 TA 先开口（模型，失败回落模板）；多人场主持人开场 */
async function openScene(s: OutingSession, place: Place, setTyping: (v: boolean) => void): Promise<void> {
  if (s.messages.length) return;
  const scope = sessionScope(s);
  if (s.cast && s.cast.length > 1) {
    await respond(scope, SCENE_OPENER_USER, { typing: setTyping });
    return;
  }
  const b = useAppStore.getState().bonds.find((x) => x.characterId === s.characterId);
  // 赴约迟到了（D-079）：开场就知道
  const late = s.kind === 'date' && (s.lateMinutes ?? 0) > ON_TIME_TOLERANCE_MIN;
  const openerKind = late ? 'dateLate' : s.kind === 'group' ? 'encounter' : s.kind;
  const { reply } = await respond(scope, outingOpenerUserLine(openerKind), { typing: setTyping });
  if (reply) return;
  // 模板按界面语言取：地点名与称呼也要同一种语言（称呼缺省回落她的昵称）
  const own = b?.nickname && b.nickname !== '你' ? b.nickname : undefined;
  const nickname = own || useAppStore.getState().me?.nickname || t('你');
  const line = pickOutingOpener(openerKind)
    .replace(/\{place\}/g, t(place.name))
    .replace(/\{nickname\}/g, nickname)
    .replace(/\{minutes\}/g, String(s.lateMinutes ?? 0));
  setTyping(true);
  await wait(1000);
  setTyping(false);
  useAppStore.getState().appendOuting([{ id: uid('m'), from: 'him', kind: 'text', text: line, at: Date.now() }]);
}

export default function OutingSceneScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const insets = useSafeAreaInsets();
  const outingPlans = useAppStore((st) => st.outingPlans);
  const [openedAt] = useState(() => Date.now());
  const router = useRouter();
  const place = placeById(placeId);
  const session = useAppStore((s) => s.outingSession);
  const bonds = useAppStore((s) => s.bonds);
  const squareChats = useAppStore((s) => s.squareChats);
  const [typing, setTyping] = useState(false);
  // 进门的结果：没有一场时是关门 / 没人 / 两人场要她选
  const [entry, setEntry] = useState<Exclude<EnterResult, { session: OutingSession }> | null>(null);
  const [shooting, setShooting] = useState<null | 'solo' | 'together'>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | undefined>(undefined);
  // 快门白闪（D-209）
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const [sheetId, setSheetId] = useState<string | null>(null);
  // 多人场里对谁说（D-255）：null = 对大家
  const [toId, setToId] = useState<string | null>(null);
  const [pickingTo, setPickingTo] = useState(false);
  const booted = useRef(false);

  const active = session && session.placeId === placeId ? session : null;
  const cast = active ? (active.cast ?? [active.characterId]) : [];
  const group = cast.length > 1;
  const character = active ? findCharacter(active.characterId) : undefined;
  const bond = active ? bonds.find((b) => b.characterId === active.characterId) : undefined;
  // 陌生人在现场交换了联系方式后（D-056），这场偶遇就地升格为熟人偶遇
  const kind = active?.kind === 'stranger' && bond ? 'encounter' : active?.kind;

  const enter = (pick?: string) => {
    if (!place) return;
    const r = enterPlace(place.id, pick);
    if ('session' in r) {
      setEntry(null);
      void openScene(r.session, place, setTyping);
    } else {
      setEntry(r);
    }
  };

  // 进场：开一场外出（没人 / 关门 / 要选的结果放到 effect 之后的微任务里落——规则不许 effect 体内同步 setState）
  useEffect(() => {
    if (!place || booted.current) return;
    booted.current = true;
    queueMicrotask(() => enter());
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

  // 顶栏副文里的天气：「晴 24°」；夜里像素图换夜色
  const w = todayWeather();
  const weatherShort = { label: t(w.label), temp: `${tempNow(w)}°` };
  const night = dayPartOf(new Date(openedAt)) === 'night';

  // 关门 / 没人 / 选人
  if (!active && entry) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Header place={place} night={night || 'closed' in entry} weather={weatherShort} onBack={() => router.back()} />
        {'choose' in entry ? (
          <ScrollView contentContainerStyle={styles.chooseWrap}>
            <PixelArt id={place.id} size={120} night={night} />
            <Text style={styles.chooseTitle}>{t('坐到谁旁边？')}</Text>
            {entry.choose.map((p) => (
              <ChooseRow key={p.characterId} presence={p} onPress={() => enter(p.characterId)} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <PixelArt id={'closed' in entry ? 'closed' : place.id} size={'closed' in entry ? 72 : 120} night={night} />
            <Text style={styles.emptyText}>
              {'closed' in entry
                ? t('这会儿关门了。')
                : place.stranger
                  ? t('广场今天安安静静的。')
                  : t('这会儿没人。')}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (!active || !character) return null;

  const nameOf = (cid: string) => {
    const b = bonds.find((x) => x.characterId === cid);
    return b?.name ?? (b ? '' : t('陌生人'));
  };
  // 对某一位说（D-255）：模型认得的名字是真名（陌生人在界面上才写「陌生人」）
  const target = group && toId && cast.includes(toId) ? toId : null;
  const to = target ? { id: target, name: bonds.find((x) => x.characterId === target)?.name ?? findCharacter(target)?.name ?? '' } : undefined;

  const scope = sessionScope(active);
  // 回合走底座管线（D-086）：XP / 陌生人好奇记账、现场描写不剥、旁白与纸条按说话人分条都在模式与钩子里
  const onSend = (text: string) => void sendText(scope, text, { ui: { typing: setTyping }, to });
  const onResend = (m: { id: string }) => void resendTurn(scope, m.id, { typing: setTyping });
  const onSendNote = place.rule === 'quiet' || place.rule === 'cinema' ? (text: string) => void sendNote(text, { typing: setTyping }, to) : undefined;
  const name = bond?.name ?? character.name;
  // 多人场的说话人：认识的写名字，不认识的写「陌生人」
  const speakers: Speakers = Object.fromEntries(
    cast.map((cid) => {
      const c = findCharacter(cid);
      return [cid, { name: nameOf(cid), color: c?.color ?? Romance.accent, characterId: cid }];
    })
  );

  /** 拍照（D-051/D-079）：合影 / 拍TA——她主动按快门；洗好即进相册，人还在场就贴进现场（lib/outing.ts） */
  const shoot = async (k: 'solo' | 'together') => {
    if (shooting) return;
    if (!imageKeyReady()) {
      alertAiUnavailable();
      return;
    }
    // 快门（D-209）：白闪一下 + 一记震动，然后相纸在输入栏上方慢慢显影
    haptic.medium();
    flash.set(withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 320 })));
    setShooting(k);
    try {
      await shootPhoto(active, character, place, k, name);
    } catch (e) {
      console.warn('[outing] 拍照失败：', e);
      if (mounted.current) showAlert(t('没拍成'), `${t('生图服务出了点问题，可以再试一次。')}\n\n${t('原因：{reason}', { reason: describeAiError(e) })}`);
    } finally {
      if (mounted.current) setShooting(null);
    }
  };

  // 还不认识、好奇满了、开口要联系方式的那几位（一人场 / 多人场都有）
  const offers = cast.filter((cid) => !bonds.some((b) => b.characterId === cid) && squareChats[cid]?.adoptionOffered);
  const heart = Math.min(HEART_FULL, squareChats[character.id]?.heart ?? 0);
  // 约定窗口还没开就进来了（比如从日历太早点「赴约」）：这一场是偶遇，副文带上约的时间（D-197）
  const pendingPlan = kind === 'encounter' ? outingPlans.find((p) => p.characterId === character.id && p.placeId === place.id && p.at !== undefined && p.at > openedAt) : undefined;
  const subtitle = group
    ? cast.map(nameOf).join('、')
    : kind === 'date'
      ? `${t('和{name}有约', { name })}${active.planAt ? ` · ${planTimeLabel(active.planAt)}` : ''}`
      : kind === 'stranger'
        ? t('陌生人 · 好奇 {h}/{f}', { h: heart, f: HEART_FULL })
        : pendingPlan?.at
          ? t('偶遇了{name} · 约在{time}', { name, time: planTimeLabel(pendingPlan.at) })
          : t('偶遇了{name}', { name });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
      <Header
        place={place}
        night={night}
        subtitle={subtitle}
        weather={weatherShort}
        onBack={() => router.back()}
        onLeave={leave}
        onSubtitlePress={group ? undefined : () => setSheetId(character.id)}
      />
      <CharacterSheet characterId={sheetId} visible={!!sheetId} onClose={() => setSheetId(null)} />
      {group ? (
        <ActionSheet
          visible={pickingTo}
          title={t('对谁说')}
          onClose={() => setPickingTo(false)}
          actions={[
            {
              label: t('大家'),
              selected: !target,
              leading: (
                <View style={styles.everyone}>
                  <IconSymbol name="person.2.fill" size={16} color={Romance.sub} />
                </View>
              ),
              onPress: () => setToId(null),
            },
            ...cast.map((cid) => ({
              label: nameOf(cid),
              selected: target === cid,
              leading: <CharAvatar name={nameOf(cid)} color={findCharacter(cid)?.color ?? Romance.accent} size={32} characterId={cid} />,
              onPress: () => setToId(cid),
            })),
          ]}
        />
      ) : null}
      <ChatThread
        messages={active.messages}
        color={character.color}
        name={kind === 'stranger' ? t('陌生人') : name}
        characterId={character.id}
        speakers={group ? speakers : undefined}
        onAvatarPress={(cid) => setSheetId(cid ?? character.id)}
        typing={typing}
        typingLabel="……"
        onSend={onSend}
        onResend={onResend}
        onSendNote={onSendNote}
        actionBrackets
        prefill={prefill}
        inputDisabled={!!active.ended}
        placeholder={active.ended ? t('该走了') : target ? t('对{name}说…', { name: nameOf(target) }) : t('说点什么…')}
        cta={
          <View>
            {offers.map((cid) => (
              <Card key={cid} style={styles.offerCard}>
                <CharAvatar name={nameOf(cid)} color={findCharacter(cid)?.color ?? Romance.accent} size={32} characterId={cid} />
                <View style={styles.offerText}>
                  <Text style={styles.offerTitle}>{t('TA 想和你交换联系方式')}</Text>
                </View>
                <Button label={t('交换')} size="sm" onPress={() => router.push({ pathname: '/adopt/[characterId]', params: { characterId: cid } })} />
              </Card>
            ))}
            {shooting ? (
              <View style={styles.developing}>
                <DevelopingPolaroid width={150} lines={DEVELOP_LINES.map((l) => t(l))} tiltKey={place.id} />
              </View>
            ) : null}
            {!active.ended && (group || place.actions.length) ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
                {/* 多人场：对谁说（D-255），点开从底下拉出在场的人 */}
                {group ? (
                  <Pressable style={[styles.actionChip, styles.toChip]} onPress={() => setPickingTo(true)}>
                    <Text style={styles.toChipText} numberOfLines={1}>
                      @{target ? nameOf(target) : t('大家')}
                    </Text>
                    <IconSymbol name="chevron.up" size={11} color={Romance.accent} />
                  </Pressable>
                ) : null}
                {place.actions.map((a) => (
                  <Pressable key={a} style={styles.actionChip} onPress={() => setPrefill({ text: `（${t(a)}）`, nonce: Date.now() })}>
                    <Text style={styles.actionChipText}>{t(a)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {!group && !active.ended ? (
              <View style={styles.shootRow}>
                <Button
                  variant="secondary"
                  size="sm"
                  style={styles.shootBtn}
                  icon="emoji"
                  label={shooting === 'together' ? t('拍摄中…') : t('合影')}
                  disabled={!!shooting}
                  onPress={() => shoot('together')}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  style={styles.shootBtn}
                  icon="camera"
                  label={shooting === 'solo' ? t('拍摄中…') : t('拍 TA')}
                  disabled={!!shooting}
                  onPress={() => shoot('solo')}
                />
              </View>
            ) : null}
          </View>
        }
        banner={
          <View style={styles.sceneBanner}>
            <PixelArt id={place.id} size={96} night={night} />
            <Text style={styles.sceneBannerText}>{t(place.hook)}</Text>
          </View>
        }
      />
    </View>
  );
}

/** 两人场选人：认识的写名字，不认识的只看得到样子 */
function ChooseRow({ presence, onPress }: { presence: Presence; onPress: () => void }) {
  const c = findCharacter(presence.characterId);
  const bond = useAppStore((s) => s.bonds.find((b) => b.characterId === presence.characterId));
  if (!c) return null;
  const label = presence.known ? (bond?.name ?? c.name) : t('陌生人');
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.chooseRow}>
        <CharAvatar name={label} color={c.color} size={48} characterId={c.id} />
        <View style={styles.chooseBody}>
          <Text style={styles.chooseName}>{label}</Text>
          {presence.known ? null : <Text style={styles.chooseSub}>{t('还不认识')}</Text>}
        </View>
        <IconSymbol name="chevron.right" size={14} color={Romance.sub} />
      </Card>
    </Pressable>
  );
}

function Header({
  place,
  night,
  subtitle,
  weather,
  onBack,
  onLeave,
  onSubtitlePress,
}: {
  place: Place;
  night: boolean;
  subtitle?: string;
  weather: { label: string; temp: string };
  onBack: () => void;
  onLeave?: () => void;
  /** 点副文（和谁）看 TA 的资料（D-110） */
  onSubtitlePress?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10}>
        <IconSymbol name="chevron.left" size={22} color={Romance.ink} />
      </Pressable>
      <PixelArt id={place.id} size={30} night={night} />
      <Pressable style={styles.headerText} onPress={onSubtitlePress} disabled={!onSubtitlePress}>
        <Text style={styles.headerName} numberOfLines={1}>
          {t(place.name)}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {subtitle ? `${subtitle} · ` : ''}
          {weather.label} <Text style={styles.headerTemp}>{weather.temp}</Text>
        </Text>
      </Pressable>
      {onLeave ? (
        <Pressable style={styles.leaveBtn} onPress={onLeave} hitSlop={6}>
          <Text style={styles.leaveText}>{t('结束外出')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 显影相纸下面那行字：按快门之后一句一句往下走，停在最后一句（出图约 10 秒到 1 分钟） */
const DEVELOP_LINES = ['咔嚓——', '相纸在慢慢显影…', '轮廓出来了…', '快好了…'];

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inline,
      paddingHorizontal: Space.screen,
      paddingTop: 6,
      paddingBottom: 10,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerName: { fontSize: Type.scale.md.size, fontWeight: '600', color: Romance.ink },
    headerSub: { fontSize: Type.scale.timestamp.size, color: Romance.sub, marginTop: 1 },
    headerTemp: { fontFamily: Fonts.label, fontSize: Type.scale.timestamp.size, color: Romance.sub },
    leaveBtn: { backgroundColor: Romance.card, borderRadius: Shape.radius, paddingHorizontal: 10, paddingVertical: 6 },
    leaveText: { fontSize: Type.scale.timestamp.size, fontWeight: '600', color: Romance.sub },
    // 场景条：像素小场景 + 一句钩子
    sceneBanner: { alignItems: 'center', gap: 6, paddingVertical: 8 },
    sceneBannerText: { fontSize: Type.scale.caption.size, color: Romance.sub, textAlign: 'center' },
    flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 10 },
    developing: { alignItems: 'center', paddingTop: Space.inlineLoose, paddingBottom: 4 },
    actionRow: { gap: Space.inline, paddingHorizontal: Space.screen, paddingBottom: 8 },
    actionChip: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radiusPill,
      borderWidth: Shape.stroke,
      borderColor: Romance.stroke,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    actionChipText: { fontSize: Type.scale.caption.size, color: Romance.ink },
    toChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderColor: Romance.accent },
    toChipText: { fontSize: Type.scale.caption.size, fontWeight: '600', color: Romance.accent },
    everyone: { width: 32, height: 32, borderRadius: Shape.radius, backgroundColor: Romance.bg, alignItems: 'center', justifyContent: 'center' },
    shootRow: { flexDirection: 'row', gap: Space.inlineLoose, paddingHorizontal: Space.screen, paddingBottom: 8 },
    shootBtn: { flex: 1, paddingVertical: 11 },
    offerCard: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, marginHorizontal: Space.screen, marginBottom: 8 },
    offerText: { flex: 1 },
    offerTitle: { fontSize: Type.scale.sub.size, fontWeight: '600', color: Romance.ink },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
    emptyText: { textAlign: 'center', fontSize: Type.scale.label.size, color: Romance.sub, lineHeight: 21 },
    chooseWrap: { alignItems: 'center', padding: Space.screen, gap: Space.inlineLoose },
    chooseTitle: { fontSize: Type.scale.lg.size, fontWeight: '600', color: Romance.ink, marginTop: 8 },
    chooseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
    chooseBody: { flex: 1 },
    chooseName: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    chooseSub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
  })
);

/**
 * 外出（D-038/D-040；D-254 跑团式改版）：把相处从手机屏幕里拿出来。
 * - 天气条 → 约定条（约定只表达一次：时间 · 地点 · 和谁 + 「赴约 ›」；最多 2 条，其余折叠；长按取消）
 * - 广场一张宽卡 + 十一个地点：每张是我们自己画的像素小场景（content/pixel-art.ts；夜里 / 打烊换夜色）。
 *   卡上只说「这里有几个人」——进去才知道是谁（不认识的人不报名字）；约定窗口里写「TA 在等你」；打烊写「打烊了」。
 * - 谁在：按「人 × 这个小时」稳定散开（lib/presence.ts），每分钟看一眼钟。
 */

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { showAlert } from '@/components/action-sheet';
import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute, WEATHER_ICON } from '@/components/mingcute';
import { PixelArt } from '@/components/pixel-art';
import { TimePicker } from '@/components/time-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { PLACES, placeById, type Place } from '@/content/places';
import { planIsOpen, planTimeLabel } from '@/lib/appointments';
import { t } from '@/lib/i18n';
import { sessionExpired } from '@/lib/outing';
import { dayPartOf, isOpen, presenceAt } from '@/lib/presence';
import { todayWeather, tempNow } from '@/lib/weather';
import type { Bond, OutingPlan } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 约定条最多直接露出几条，其余折叠成「还有 n 个约定」（D-100 交互改动 8） */
const MAX_PLAN_STRIPS = 2;
const GRID_GAP = 12;
/** 多久看一眼钟（谁在按小时变、营业按分钟变） */
const TICK_MS = 60_000;

/** 「今天 20:30」拆成日与钟点：钟点（以及纯数字的日期）用 Fredoka */
function splitPlanTime(at: number): { day: string; clock: string; dayNumeric: boolean } {
  const label = planTimeLabel(at);
  const i = label.lastIndexOf(' ');
  const day = i >= 0 ? label.slice(0, i) : '';
  return { day, clock: label.slice(i + 1), dayNumeric: /^[\d/]+$/.test(day) };
}

export default function OutingScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const plans = useAppStore((s) => s.outingPlans);
  const session = useAppStore((s) => s.outingSession);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  // 进行中的一场（D-079）：没点结束、一小时内说过话——卡片上标出「你在这儿」
  const live = session && !sessionExpired(session, now) && !session.ended ? session : null;

  const [planOpen, setPlanOpen] = useState(false);
  const [planCharacterId, setPlanCharacterId] = useState<string | null>(null);
  const [planPlaceId, setPlanPlaceId] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);

  const date = new Date(now);
  const w = todayWeather(date);
  const night = dayPartOf(date) === 'night';
  const plaza: Place | undefined = PLACES.find((p) => p.stranger);
  const spots = PLACES.filter((p) => !p.stranger);
  // 这会儿谁在（同一个小时里稳定）；只用来数人
  const presence = presenceAt(date);

  const colorOf = (characterId: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === characterId)?.color ?? Romance.accent;
  const bondOf = (characterId: string) => bonds.find((b) => b.characterId === characterId);

  /** 约定条：按时间排，没有时间的（旧存档随时有效）排最后 */
  const planRows = useMemo(() => {
    const rows: { plan: OutingPlan; place: Place; bond: Bond }[] = [];
    for (const plan of plans) {
      const place = placeById(plan.placeId);
      const bond = bonds.find((b) => b.characterId === plan.characterId);
      if (place && bond) rows.push({ plan, place, bond });
    }
    rows.sort((a, b) => (a.plan.at ?? Infinity) - (b.plan.at ?? Infinity) || a.plan.createdAt - b.plan.createdAt);
    return rows;
  }, [plans, bonds]);
  const visiblePlans = showAllPlans ? planRows : planRows.slice(0, MAX_PLAN_STRIPS);
  const hiddenPlans = planRows.length - visiblePlans.length;

  const goPlace = (placeId: string) => router.push({ pathname: '/outing/[placeId]', params: { placeId } });

  /** 取消约定（D-100）：长按约定条，确认后删掉这条约定 */
  const confirmCancel = (plan: OutingPlan, place: Place, bond: Bond) => {
    showAlert(t('取消约定'), t('和{name}约在{place}的这次约定会取消。', { name: bond.name, place: t(place.name) }), [
      { text: t('再想想'), style: 'cancel' },
      { text: t('取消约定'), style: 'destructive', onPress: () => useAppStore.getState().removeOutingPlan(plan.id) },
    ]);
  };

  /** 约 TA（D-084 带时间）：选人 → 选地点 → 选时间 */
  const makePlan = (at: number) => {
    if (!planCharacterId || !planPlaceId) return;
    useAppStore.getState().addOutingPlan(planCharacterId, planPlaceId, { at, source: 'manual' });
    setPlanOpen(false);
    setPlanCharacterId(null);
    setPlanPlaceId(null);
  };

  /** 卡上的一行状态：你在这儿 / TA 在等你（约定窗口里）/ 和 TA 有约 / 打烊了 / 这里有 n 个人 / 这会儿没人 */
  const statusOf = (place: Place): string => {
    if (live?.placeId === place.id) return t('你在这儿');
    const plan = plans.find((p) => p.placeId === place.id);
    const planBond = plan ? bondOf(plan.characterId) : undefined;
    if (plan && planBond) return planIsOpen(plan, now) ? t('{name} 在等你', { name: planBond.name }) : t('和{name}有约', { name: planBond.name });
    if (!isOpen(place, date)) return t('打烊了');
    const n = presence[place.id]?.length ?? 0;
    return n ? t('这里有 {n} 个人', { n }) : t('这会儿没人');
  };

  const cardWidth = (useWindowDimensions().width - Space.screen * 2 - GRID_GAP) / 2;

  return (
    <AppScreen
      title={t('外出')}
      right={bonds.length ? <HeaderAction label={t('约 TA')} onPress={() => setPlanOpen(true)} /> : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* 天气条：白 r6 9×14，温度 Fredoka */}
        <View style={styles.weatherStrip}>
          <MingCute name={WEATHER_ICON[w.id]} size={Space.iconBar} color={Romance.accent} />
          <Text style={styles.weatherText} numberOfLines={1}>
            {t(w.label)} <Text style={styles.weatherTemp}>{tempNow(w, date)}°</Text> · {t(w.line)}
          </Text>
        </View>

        {/* 约定条（D-100 交互改动 8）：时间 · 地点 · 和谁 + 赴约；长按取消 */}
        {visiblePlans.map(({ plan, place, bond }) => {
          const time = plan.at ? splitPlanTime(plan.at) : null;
          return (
            <Pressable
              key={plan.id}
              onPress={() => goPlace(place.id)}
              onLongPress={() => confirmCancel(plan, place, bond)}
              delayLongPress={400}>
              <Card padded={false} style={styles.planStrip}>
                <CharAvatar name={bond.name} color={colorOf(plan.characterId)} size={28} characterId={plan.characterId} />
                <Text style={styles.planText} numberOfLines={1}>
                  {time ? (
                    <>
                      {time.day ? <Text style={time.dayNumeric ? styles.planClock : undefined}>{time.day} </Text> : null}
                      <Text style={styles.planClock}>{time.clock}</Text>
                      {' · '}
                    </>
                  ) : null}
                  {t(place.name)} · {t('和{name}', { name: bond.name })}
                </Text>
                <Text style={styles.planGo}>{t('赴约 ›')}</Text>
              </Card>
            </Pressable>
          );
        })}
        {hiddenPlans > 0 ? (
          <Pressable style={styles.morePlans} onPress={() => setShowAllPlans(true)}>
            <Text style={styles.morePlansText}>{t('还有 {n} 个约定', { n: hiddenPlans })}</Text>
          </Pressable>
        ) : null}

        {/* 广场（D-040）：宽卡 */}
        {plaza ? (
          <Pressable onPress={() => goPlace(plaza.id)}>
            <Card padded={false} style={styles.plaza}>
              <PixelArt id={plaza.id} size={64} night={night} />
              <View style={styles.plazaBody}>
                <Text style={styles.plazaTitle}>{t(plaza.name)}</Text>
                <Text style={styles.plazaSub}>{t(plaza.hook)}</Text>
                <Text style={styles.status}>{statusOf(plaza)}</Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        {/* 地点：像素小场景 + 名字 + 一句钩子 + 此刻的状态 */}
        <View style={styles.grid}>
          {spots.map((place) => {
            const open = isOpen(place, date);
            return (
              <Pressable key={place.id} style={{ width: cardWidth }} onPress={() => goPlace(place.id)}>
                <Card padded={false} style={styles.placeCard}>
                  <View style={[styles.placeArt, !open && styles.placeArtClosed]}>
                    <PixelArt id={place.id} size={Math.round(cardWidth * 0.6)} night={night || !open} />
                  </View>
                </Card>
                <Text style={styles.placeName}>{t(place.name)}</Text>
                <Text style={styles.placeHook} numberOfLines={1}>
                  {t(place.hook)}
                </Text>
                <Text style={[styles.status, styles.placeStatus]} numberOfLines={1}>
                  {statusOf(place)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* 约 TA：选人 → 选地点 → 选时间 */}
      <Modal visible={planOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPlanOpen(false)}>
        <View style={styles.modal}>
          <Pressable
            style={styles.modalClose}
            onPress={() => {
              setPlanOpen(false);
              setPlanCharacterId(null);
              setPlanPlaceId(null);
            }}>
            <MingCute name="close" size={20} color={Romance.sub} />
          </Pressable>
          {/* 选错了能退回上一步，不用关掉重来 */}
          {planCharacterId ? (
            <Pressable
              style={styles.modalBack}
              hitSlop={10}
              accessibilityLabel={t('返回')}
              onPress={() => (planPlaceId ? setPlanPlaceId(null) : setPlanCharacterId(null))}>
              <IconSymbol name="chevron.left" size={16} color={Romance.ink} />
              <Text style={styles.modalBackText}>{t('返回')}</Text>
            </Pressable>
          ) : null}
          {!planCharacterId ? (
            <ScrollView>
              <Text style={styles.modalTitle}>{t('约谁出来？')}</Text>
              {bonds.map((b) => (
                <Pressable key={b.id} onPress={() => setPlanCharacterId(b.characterId)}>
                  <Card padded={false} style={styles.modalRow}>
                    <CharAvatar name={b.name} color={colorOf(b.characterId)} size={44} characterId={b.characterId} />
                    <Text style={styles.modalRowText}>{b.name}</Text>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          ) : !planPlaceId ? (
            <ScrollView>
              <Text style={styles.modalTitle}>{t('去哪儿见？')}</Text>
              {spots.map((place) => (
                <Pressable key={place.id} onPress={() => setPlanPlaceId(place.id)}>
                  <Card padded={false} style={styles.modalRow}>
                    <PixelArt id={place.id} size={40} />
                    <View style={styles.modalRowBody}>
                      <Text style={styles.modalRowText}>{t(place.name)}</Text>
                      <Text style={styles.modalRowSub}>{t(place.hook)}</Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <>
              <Text style={styles.modalTitle}>{t('约在什么时候？')}</Text>
              <TimePicker onPick={makePlan} />
            </>
          )}
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { padding: Space.screen, paddingBottom: 40, gap: GRID_GAP },
    weatherStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inline,
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    weatherText: { flex: 1, fontSize: Type.scale.label.size, color: Romance.sub },
    weatherTemp: { fontFamily: Fonts.label, fontSize: Type.scale.label.size, color: Romance.sub },
    planStrip: { flexDirection: 'row', alignItems: 'center', gap: Space.inlineLoose, paddingHorizontal: Space.cardX, paddingVertical: 8 },
    planText: { flex: 1, fontSize: Type.scale.label.size, fontWeight: '500', color: Romance.ink },
    planClock: { fontFamily: Fonts.label, fontSize: Type.scale.label.size, color: Romance.ink },
    planGo: { fontSize: Type.scale.label.size, fontWeight: '600', color: Romance.accent },
    morePlans: { backgroundColor: Romance.card, borderRadius: Shape.radius, paddingVertical: 8, paddingHorizontal: Space.cardX, alignItems: 'center' },
    morePlansText: { fontSize: Type.scale.label.size, fontWeight: '500', color: Romance.sub },
    plaza: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Romance.accentSoft, padding: 14 },
    plazaBody: { flex: 1 },
    plazaTitle: { fontSize: Type.scale.xl.size, fontWeight: '600', color: Romance.ink },
    plazaSub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 3 },
    status: { fontSize: Type.scale.timestamp.size, fontWeight: '600', color: Romance.accentStrong, marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    placeCard: { overflow: 'hidden', borderRadius: Shape.radiusIcon },
    placeArt: { height: 120, backgroundColor: Romance.accentSoft, alignItems: 'center', justifyContent: 'center' },
    placeArtClosed: { backgroundColor: Romance.line },
    placeName: { fontSize: Type.scale.sub.size, fontWeight: '600', color: Romance.ink, marginTop: 8, marginLeft: 4 },
    placeHook: { fontSize: Type.scale.timestamp.size, color: Romance.sub, marginTop: 2, marginLeft: 4 },
    placeStatus: { marginLeft: 4, marginTop: 2 },
    modal: { flex: 1, backgroundColor: Romance.bg, paddingTop: 28, paddingHorizontal: Space.screen },
    modalClose: { position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 2 },
    modalBack: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: Space.inlineLoose },
    modalBackText: { fontSize: Type.scale.sub.size, fontWeight: '500', color: Romance.ink },
    modalTitle: { fontSize: Type.scale.xxl.size, fontWeight: '600', color: Romance.ink, marginBottom: 18 },
    modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
    modalRowBody: { flex: 1 },
    modalRowText: { fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    modalRowSub: { fontSize: Type.scale.caption.size, color: Romance.sub, marginTop: 2 },
  })
);

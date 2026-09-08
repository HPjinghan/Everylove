/**
 * 外出（D-038/D-040；D-100 纸面）：把相处从手机屏幕里拿出来。
 * - 天气条 → 约定条（约定只表达一次：时间 · 地点 · 和谁 + 「赴约 ›」；最多 2 条，其余折叠；长按取消）
 * - 广场（accentSoft 卡）：直接偶遇陌生人——还没配对的角色（D-040）。
 * - 六个地点：点进去就是一场亲身互动（故事模式）。有约定 → 赴约（TA 已经在等你）；没有 → 偶遇通讯录里的人。
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Card } from '@/components/card';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { TimePicker } from '@/components/time-picker';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { PLACES, placeById, type Place } from '@/content/places';
import { planTimeLabel } from '@/lib/appointments';
import { t } from '@/lib/i18n';
import { sessionExpired } from '@/lib/outing';
import { todayWeather, tempNow } from '@/lib/weather';
import type { Bond, OutingPlan } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 约定条最多直接露出几条，其余折叠成「还有 n 个约定」（D-100 交互改动 8） */
const MAX_PLAN_STRIPS = 2;
const GRID_GAP = 12;

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
  // 进行中的一场（D-079）：没点结束、一小时内说过话——卡片上标出 TA 还在那儿
  const live = session && !sessionExpired(session) ? session : null;

  const [planOpen, setPlanOpen] = useState(false);
  const [planCharacterId, setPlanCharacterId] = useState<string | null>(null);
  const [planPlaceId, setPlanPlaceId] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);

  const w = todayWeather();
  const plaza: Place | undefined = PLACES.find((p) => p.stranger);
  const spots = PLACES.filter((p) => !p.stranger);

  const colorOf = (characterId: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === characterId)?.color ?? Romance.accent;
  const bondOf = (characterId: string) => bonds.find((b) => b.characterId === characterId);

  /** 约定条：按时间排，没有时间的（旧存档随时有效）排最后 */
  const planRows = useMemo(() => {
    const rows: { plan: OutingPlan; place: Place; bond: Bond }[] = [];
    for (const plan of plans) {
      const place = placeById(plan.placeId);
      const bond = bondOf(plan.characterId);
      if (place && bond) rows.push({ plan, place, bond });
    }
    rows.sort((a, b) => (a.plan.at ?? Infinity) - (b.plan.at ?? Infinity) || a.plan.createdAt - b.plan.createdAt);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, bonds]);
  const visiblePlans = showAllPlans ? planRows : planRows.slice(0, MAX_PLAN_STRIPS);
  const hiddenPlans = planRows.length - visiblePlans.length;

  const goPlace = (placeId: string) => router.push({ pathname: '/outing/[placeId]', params: { placeId } });

  /** 取消约定（D-100）：长按约定条，确认后删掉这条约定 */
  const confirmCancel = (plan: OutingPlan, place: Place, bond: Bond) => {
    Alert.alert(t('取消约定'), t('和{name}约在{place}的这次约定会取消。', { name: bond.name, place: t(place.name) }), [
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

  const cardWidth = (Dimensions.get('window').width - Space.screen * 2 - GRID_GAP) / 2;

  return (
    <AppScreen
      title={t('外出')}
      right={bonds.length ? <HeaderAction label={t('约 TA')} onPress={() => setPlanOpen(true)} /> : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* 天气条：白 r6 9×14，温度 Fredoka */}
        <View style={styles.weatherStrip}>
          <Text style={styles.weatherEmoji}>{w.emoji}</Text>
          <Text style={styles.weatherText} numberOfLines={1}>
            {t(w.label)} <Text style={styles.weatherTemp}>{tempNow(w)}°</Text> · {t(w.line)}
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
                      {time.day ? (
                        <Text style={time.dayNumeric ? styles.planClock : undefined}>{time.day} </Text>
                      ) : null}
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

        {/* 广场（D-040）：accentSoft 卡，直接偶遇陌生人 */}
        {plaza ? (
          <Pressable onPress={() => goPlace(plaza.id)}>
            <Card padded={false} style={styles.plaza}>
              <Text style={styles.plazaEmoji}>{plaza.emoji}</Text>
              <View style={styles.plazaBody}>
                <Text style={styles.plazaTitle}>{t(plaza.name)}</Text>
                <Text style={styles.plazaSub}>{t(plaza.hook)}</Text>
              </View>
              <Text style={styles.plazaGo}>{t('去逛逛 ›')}</Text>
            </Card>
          </Pressable>
        ) : null}

        {/* 六个地点：白卡描边，上 100 高 paper 底放 emoji，角标「和 X 有约」 */}
        <View style={styles.grid}>
          {spots.map((place) => {
            const plan = plans.find((p) => p.placeId === place.id);
            const planBond = plan ? bondOf(plan.characterId) : undefined;
            const liveName =
              live?.placeId === place.id
                ? (bondOf(live.characterId)?.name ?? findCharacter(live.characterId)?.name)
                : undefined;
            const badge = liveName
              ? t('和{name}在一起', { name: liveName })
              : planBond
                ? t('和{name}有约', { name: planBond.name })
                : null;
            return (
              <Pressable key={place.id} style={{ width: cardWidth }} onPress={() => goPlace(place.id)}>
                <Card padded={false} style={styles.placeCard}>
                  <View style={styles.placeArt}>
                    <Text style={styles.placeEmoji}>{place.emoji}</Text>
                    {badge ? (
                      <View style={styles.placeBadge}>
                        <Text style={styles.placeBadgeText}>{badge}</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
                <Text style={styles.placeName}>{t(place.name)}</Text>
                <Text style={styles.placeHook} numberOfLines={1}>
                  {t(place.hook)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* 约 TA：选人 → 选地点 → 选时间 */}
      <Modal
        visible={planOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPlanOpen(false)}>
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
          {!planCharacterId ? (
            <>
              <Text style={styles.modalTitle}>{t('约谁出来？')}</Text>
              {bonds.map((b) => (
                <Pressable key={b.id} onPress={() => setPlanCharacterId(b.characterId)}>
                  <Card padded={false} style={styles.modalRow}>
                    <CharAvatar name={b.name} color={colorOf(b.characterId)} size={44} characterId={b.characterId} />
                    <Text style={styles.modalRowText}>{b.name}</Text>
                  </Card>
                </Pressable>
              ))}
            </>
          ) : !planPlaceId ? (
            <>
              <Text style={styles.modalTitle}>{t('去哪儿见？')}</Text>
              {spots.map((place) => (
                <Pressable key={place.id} onPress={() => setPlanPlaceId(place.id)}>
                  <Card padded={false} style={styles.modalRow}>
                    <Text style={styles.modalRowEmoji}>{place.emoji}</Text>
                    <View style={styles.modalRowBody}>
                      <Text style={styles.modalRowText}>{t(place.name)}</Text>
                      <Text style={styles.modalRowSub}>{t(place.hook)}</Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </>
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
    weatherEmoji: { fontSize: 20 },
    weatherText: { flex: 1, fontSize: 13, color: Romance.sub },
    weatherTemp: { fontFamily: Fonts.label, fontSize: 13, color: Romance.sub },
    planStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.cardX,
      paddingVertical: 8,
    },
    planText: { flex: 1, fontSize: 13, fontWeight: '500', color: Romance.ink },
    planClock: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    planGo: { fontSize: 13, fontWeight: '600', color: Romance.accent },
    morePlans: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingVertical: 8,
      paddingHorizontal: Space.cardX,
      alignItems: 'center',
    },
    morePlansText: { fontSize: 13, fontWeight: '500', color: Romance.sub },
    plaza: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Romance.accentSoft,
      padding: 16,
    },
    plazaEmoji: { fontSize: 36 },
    plazaBody: { flex: 1 },
    plazaTitle: { fontSize: 20, fontWeight: '600', color: Romance.ink },
    plazaSub: { fontSize: 12, color: Romance.sub, marginTop: 3 },
    plazaGo: { fontSize: 13, fontWeight: '600', color: Romance.accent },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    placeCard: { overflow: 'hidden' },
    placeArt: { height: 100, backgroundColor: Romance.bg, alignItems: 'center', justifyContent: 'center' },
    placeEmoji: { fontSize: 40 },
    placeBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: Romance.card,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    placeBadgeText: { fontSize: 10, fontWeight: '600', color: Romance.accentStrong },
    placeName: { fontSize: 14, fontWeight: '600', color: Romance.ink, marginTop: 8, marginLeft: 4 },
    placeHook: { fontSize: 11, color: Romance.sub, marginTop: 2, marginLeft: 4 },
    modal: { flex: 1, backgroundColor: Romance.bg, paddingTop: 28, paddingHorizontal: Space.screen },
    modalClose: { position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 2 },
    modalTitle: { fontSize: 22, fontWeight: '600', color: Romance.ink, marginBottom: 18 },
    modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
    modalRowEmoji: { fontSize: 26 },
    modalRowBody: { flex: 1 },
    modalRowText: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    modalRowSub: { fontSize: 12, color: Romance.sub, marginTop: 2 },
  })
);

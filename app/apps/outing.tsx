/**
 * 外出（D-038/D-040）：把相处从手机屏幕里拿出来。
 * - 广场（大 banner）：直接偶遇陌生人——还没配对的角色（D-040）。
 * - 几个常见地点：点进去就是一场亲身互动（故事模式）。
 * - 约定：先和某个 TA 约好一个地点，进去 = 赴约（TA 已经在等你）；
 *   没有约定则是偶遇——通讯录里的人恰好也在。
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Romance, themed } from '@/constants/theme';
import { CHARACTERS } from '@/content/characters';
import { PLACES, placeById, type Place } from '@/content/places';
import { t } from '@/lib/i18n';
import { todayWeather, tempNow } from '@/lib/weather';
import { useAppStore } from '@/store/app-store';

export default function OutingScreen() {
  const router = useRouter();
  const bonds = useAppStore((s) => s.bonds);
  const customs = useAppStore((s) => s.customCharacters);
  const plans = useAppStore((s) => s.outingPlans);

  const [planOpen, setPlanOpen] = useState(false);
  const [planCharacterId, setPlanCharacterId] = useState<string | null>(null);

  const w = todayWeather();
  const plaza: Place | undefined = PLACES.find((p) => p.stranger);
  const spots = PLACES.filter((p) => !p.stranger);

  const colorOf = (characterId: string) =>
    [...customs, ...CHARACTERS].find((c) => c.id === characterId)?.color ?? Romance.accent;
  const bondOf = (characterId: string) => bonds.find((b) => b.characterId === characterId);

  const makePlan = (placeId: string) => {
    if (!planCharacterId) return;
    useAppStore.getState().addOutingPlan(planCharacterId, placeId);
    setPlanOpen(false);
    setPlanCharacterId(null);
  };

  return (
    <AppScreen
      title={t('外出')}
      right={
        bonds.length ? (
          <Pressable onPress={() => setPlanOpen(true)} hitSlop={8}>
            <Text style={styles.planAction}>{t('约 TA')}</Text>
          </Pressable>
        ) : undefined
      }>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.weatherStrip}>
          <Text style={styles.weatherEmoji}>{w.emoji}</Text>
          <Text style={styles.weatherText}>
            {t(w.label)} {tempNow(w)}° · {t(w.line)}
          </Text>
        </View>

        {/* 广场（D-040）：大 banner，直接偶遇陌生人 */}
        {plaza ? (
          <Pressable
            onPress={() => router.push({ pathname: '/outing/[placeId]', params: { placeId: plaza.id } })}>
            <LinearGradient
              colors={plaza.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.plazaBanner}>
              <Text style={styles.plazaEmoji}>{plaza.emoji}</Text>
              <View style={styles.plazaBody}>
                <Text style={styles.plazaTitle}>{t(plaza.name)}</Text>
                <Text style={styles.plazaSub}>{t('直接遇到陌生人')} · {t(plaza.hook)}</Text>
              </View>
              <Text style={styles.plazaGo}>{t('去逛逛 ›')}</Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        {plans.length > 0 && (
          <View style={styles.plans}>
            {plans.map((p) => {
              const place = placeById(p.placeId);
              const bond = bondOf(p.characterId);
              if (!place || !bond) return null;
              return (
                <View key={p.id} style={styles.planRow}>
                  <CharAvatar
                    name={bond.name}
                    color={colorOf(p.characterId)}
                    size={36}
                    characterId={p.characterId}
                  />
                  <Text style={styles.planText}>
                    {place.emoji} {t('和{name}约在{place}', { name: bond.name, place: t(place.name) })}
                  </Text>
                  <Pressable
                    style={styles.planGo}
                    onPress={() => router.push({ pathname: '/outing/[placeId]', params: { placeId: place.id } })}>
                    <Text style={styles.planGoText}>{t('赴约')}</Text>
                  </Pressable>
                  <Pressable onPress={() => useAppStore.getState().removeOutingPlan(p.id)} hitSlop={8}>
                    <MingCute name="close" size={16} color={Romance.faint} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.grid}>
          {spots.map((place) => {
            const plan = plans.find((p) => p.placeId === place.id);
            const planBond = plan ? bondOf(plan.characterId) : undefined;
            return (
              <Pressable
                key={place.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/outing/[placeId]', params: { placeId: place.id } })}>
                <LinearGradient colors={place.colors} style={styles.cardBg}>
                  <Text style={styles.cardEmoji}>{place.emoji}</Text>
                  {planBond ? (
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{t('和{name}有约', { name: planBond.name })}</Text>
                    </View>
                  ) : null}
                </LinearGradient>
                <Text style={styles.cardName}>{t(place.name)}</Text>
                <Text style={styles.cardHook} numberOfLines={1}>
                  {t(place.hook)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.footHint}>
          {bonds.length
            ? t('出门走走，说不定会遇到通讯录里的人；广场上则全是新面孔。')
            : t('还没有好友也没关系——去广场碰碰运气，或先在「交友」里滑一滑。')}
        </Text>
      </ScrollView>

      {/* 约 TA：选人 → 选地点 */}
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
            }}>
            <MingCute name="close" size={20} color={Romance.sub} />
          </Pressable>
          {!planCharacterId ? (
            <>
              <Text style={styles.modalTitle}>{t('约谁出来？')}</Text>
              {bonds.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.modalRow}
                  onPress={() => setPlanCharacterId(b.characterId)}>
                  <CharAvatar
                    name={b.name}
                    color={colorOf(b.characterId)}
                    size={44}
                    characterId={b.characterId}
                  />
                  <Text style={styles.modalRowText}>{b.name}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>{t('去哪儿见？')}</Text>
              {spots.map((place) => (
                <Pressable key={place.id} style={styles.modalRow} onPress={() => makePlan(place.id)}>
                  <Text style={styles.modalRowEmoji}>{place.emoji}</Text>
                  <View style={styles.modalRowBody}>
                    <Text style={styles.modalRowText}>{t(place.name)}</Text>
                    <Text style={styles.modalRowSub}>{t(place.hook)}</Text>
                  </View>
                </Pressable>
              ))}
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
    content: { padding: 16, paddingBottom: 40 },
    planAction: { fontSize: 14, fontWeight: '700', color: Romance.accent },
    weatherStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    weatherEmoji: { fontSize: 22 },
    weatherText: { fontSize: 13, color: Romance.sub, flex: 1 },
    plazaBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 20,
      marginBottom: 14,
    },
    plazaEmoji: { fontSize: 40 },
    plazaBody: { flex: 1 },
    plazaTitle: { fontSize: 22, fontWeight: '800', color: Romance.ink },
    plazaSub: { fontSize: 12, color: Romance.sub, marginTop: 3 },
    plazaGo: { fontSize: 13, fontWeight: '700', color: Romance.ink, opacity: 0.65 },
    plans: { gap: 8, marginBottom: 12 },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: Romance.accentSoft,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    planText: { flex: 1, fontSize: 13, color: Romance.ink, fontWeight: '500' },
    planGo: {
      backgroundColor: Romance.accent,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    planGoText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { width: '48.4%', marginBottom: 16 },
    cardBg: {
      height: 110,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardEmoji: { fontSize: 44 },
    cardBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    cardBadgeText: { fontSize: 10, fontWeight: '700', color: Romance.accent },
    cardName: { fontSize: 14, fontWeight: '600', color: Romance.ink, marginTop: 8, marginLeft: 4 },
    cardHook: { fontSize: 11, color: Romance.faint, marginTop: 2, marginLeft: 4 },
    footHint: { textAlign: 'center', fontSize: 11, color: Romance.faint, marginTop: 6 },
    modal: { flex: 1, backgroundColor: Romance.bg, paddingTop: 28, paddingHorizontal: 20 },
    modalClose: { position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 2 },
    modalTitle: { fontSize: 22, fontWeight: '700', color: Romance.ink, marginBottom: 18 },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 14,
      marginBottom: 10,
    },
    modalRowEmoji: { fontSize: 26 },
    modalRowBody: { flex: 1 },
    modalRowText: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    modalRowSub: { fontSize: 12, color: Romance.faint, marginTop: 2 },
  })
);

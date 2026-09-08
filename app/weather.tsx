/**
 * 天气详情（D-061/D-065 真实化；D-100 纸面）：桌面天气卡点开进来。
 * - 今日白卡居中：emoji、温度 Fredoka 54、标签 15/600、说明 12、城市 12 muted
 * - 位置：定位（expo-location + 反地理编码取名）或搜索地区（Open-Meteo 地理编码，点结果设定）
 * - 未来 7 天白卡：行内距 12、行间 1.5 分区线、日期缩写与温度 Fredoka；没设位置/离线回落世界天气
 * - 位置只存本机、只用于取天气
 */

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card, Divider } from '@/components/card';
import { Input } from '@/components/input';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import {
  refreshWeather,
  searchPlaces,
  setWeatherPlace,
  tempNow,
  todayWeather,
  weatherCity,
  weatherFor,
  weatherIsReal,
  type PlaceHit,
} from '@/lib/weather';

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function WeatherScreen() {
  const [city, setCity] = useState(weatherCity());
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  useEffect(() => {
    void refreshWeather(true).then(rerender);
  }, []);

  const w = todayWeather();

  const applyPlace = (name: string, lat: number, lon: number) => {
    setWeatherPlace(name, lat, lon);
    setCity(name);
    setQuery('');
    setHits([]);
    // 拉到真实数据后刷新界面
    setTimeout(rerender, 1200);
    setTimeout(rerender, 4000);
  };

  /** 定位取城市：权限被拒则引导用搜索 */
  const useMyLocation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('没拿到定位权限'), t('没关系——在下面直接搜索你的地区也一样。'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      let name = '';
      try {
        const places = await Location.reverseGeocodeAsync(pos.coords);
        const p = places[0];
        name = p?.city || p?.district || p?.subregion || p?.region || '';
      } catch {}
      applyPlace(name || t('当前位置'), pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      console.warn('[weather] 定位失败：', e);
      Alert.alert(t('定位失败'), t('在下面手动搜索你的地区吧。'));
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const results = await searchPlaces(q);
      if (!results.length) Alert.alert(t('没找到这个地方'), t('换个写法试试？'));
      setHits(results);
    } catch {
      Alert.alert(t('搜索失败'), t('检查一下网络。'));
    } finally {
      setBusy(false);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: d, w: weatherFor(d) };
  });

  return (
    <AppScreen title={t('天气')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 今日 */}
        <Card padded={false} style={styles.today}>
          <Text style={styles.todayEmoji}>{w.emoji}</Text>
          <Text style={styles.todayTemp}>{tempNow(w)}°</Text>
          <Text style={styles.todayLabel}>
            {t(w.label)} ·{' '}
            <Text style={styles.todayHiLo}>
              {w.hi}° / {w.lo}°
            </Text>
          </Text>
          <Text style={styles.todayLine}>{t(w.line)}</Text>
          <Text style={styles.todayCity}>
            {city ? `📍 ${city}` : t('未设置位置')}
            {city && !weatherIsReal() ? ` · ${t('数据获取中…')}` : ''}
          </Text>
        </Card>

        {/* 位置 */}
        <Text style={styles.sectionTitle}>{t('位置')}</Text>
        <Button
          variant="secondary"
          size="md"
          label={busy ? t('稍等…') : t('使用当前位置')}
          onPress={useMyLocation}
          disabled={busy}
        />
        <View style={styles.searchRow}>
          <Input
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('或搜索地区，如：上海 / 东京')}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          <Button label={t('搜索')} size="sm" onPress={doSearch} disabled={!query.trim() || busy} />
        </View>
        {hits.map((h, i) => (
          <Pressable key={i} style={styles.hitRow} onPress={() => applyPlace(h.name, h.lat, h.lon)}>
            <Text style={styles.hitName}>{h.name}</Text>
            <Text style={styles.hitDetail}>{h.detail}</Text>
          </Pressable>
        ))}

        {/* 未来 7 天 */}
        <Text style={styles.sectionTitle}>{t('未来 7 天')}</Text>
        <Card padded={false} style={styles.week}>
          {days.map(({ date, w: dw }, i) => (
            <View key={i}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.dayRow}>
                <Text style={styles.dayName}>{i === 0 ? t('今天') : t(WEEKDAY[date.getDay()])}</Text>
                <Text style={styles.dayEmoji}>{dw.emoji}</Text>
                <Text style={styles.dayLabel}>{t(dw.label)}</Text>
                <Text style={styles.dayTemp}>
                  {dw.hi}° / {dw.lo}°
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={styles.footnote}>{t('天气数据来自 Open-Meteo。位置只存在这台手机上，不会上传。')}</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { padding: Space.screen, paddingBottom: 40 },
    today: { alignItems: 'center', padding: 24 },
    todayEmoji: { fontSize: 52, lineHeight: 60 },
    todayTemp: { fontFamily: Fonts.labelBold, fontSize: 54, lineHeight: 58, color: Romance.ink, marginTop: 8 },
    todayLabel: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 6 },
    todayHiLo: { fontFamily: Fonts.labelBold, fontSize: 15, color: Romance.ink },
    todayLine: { fontSize: 12, color: Romance.sub, marginTop: 6 },
    todayCity: { fontSize: 12, color: Romance.sub, marginTop: 10 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: Romance.sub, marginTop: 18, marginBottom: 8 },
    searchRow: { flexDirection: 'row', gap: Space.inline, marginTop: 8 },
    searchInput: { flex: 1, backgroundColor: Romance.bg },
    hitRow: {
      backgroundColor: Romance.card,
      borderRadius: Shape.radius,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Space.inline,
    },
    hitName: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    hitDetail: { fontSize: 11, color: Romance.sub },
    week: { paddingHorizontal: 14 },
    dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: Space.inlineLoose },
    dayName: { width: 58, fontSize: 13, fontWeight: '600', color: Romance.ink },
    dayEmoji: { fontSize: 18 },
    dayLabel: { flex: 1, fontSize: 13, color: Romance.sub },
    dayTemp: { fontFamily: Fonts.label, fontSize: 13, color: Romance.ink },
    footnote: { textAlign: 'center', fontSize: 11, color: Romance.sub, marginTop: 22, lineHeight: 17 },
  })
);

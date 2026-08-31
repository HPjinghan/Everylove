/**
 * 天气详情（D-061/D-065 真实化）：桌面天气卡点开进来。
 * - 位置：定位（expo-location + 反地理编码取名）或搜索地区（Open-Meteo 地理编码，点结果设定）
 * - 今日实况 + 未来 7 天（Open-Meteo）；没设位置/离线回落世界天气
 * - 位置只存本机、只用于取天气
 */

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Romance, themed } from '@/constants/theme';
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
        <View style={styles.today}>
          <Text style={styles.todayEmoji}>{w.emoji}</Text>
          <Text style={styles.todayTemp}>{tempNow(w)}°</Text>
          <Text style={styles.todayLabel}>
            {t(w.label)} · {w.hi}° / {w.lo}°
          </Text>
          <Text style={styles.todayLine}>{t(w.line)}</Text>
          <Text style={styles.todayCity}>
            {city ? `📍 ${city}` : t('未设置位置')}
            {city && !weatherIsReal() ? ` · ${t('数据获取中…')}` : ''}
          </Text>
        </View>

        {/* 位置 */}
        <Text style={styles.sectionTitle}>{t('位置')}</Text>
        <Pressable style={styles.locBtn} onPress={useMyLocation} disabled={busy}>
          <Text style={styles.locBtnText}>{busy ? t('稍等…') : t('📍 使用当前位置')}</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('或搜索地区，如：上海 / 东京')}
            placeholderTextColor={Romance.faint}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          <Pressable
            style={[styles.searchBtn, (!query.trim() || busy) && { opacity: 0.4 }]}
            disabled={!query.trim() || busy}
            onPress={doSearch}>
            <Text style={styles.searchBtnText}>{t('搜索')}</Text>
          </Pressable>
        </View>
        {hits.map((h, i) => (
          <Pressable key={i} style={styles.hitRow} onPress={() => applyPlace(h.name, h.lat, h.lon)}>
            <Text style={styles.hitName}>{h.name}</Text>
            <Text style={styles.hitDetail}>{h.detail}</Text>
          </Pressable>
        ))}

        {/* 未来 7 天 */}
        <Text style={styles.sectionTitle}>{t('未来 7 天')}</Text>
        <View style={styles.week}>
          {days.map(({ date, w: dw }, i) => (
            <View key={i} style={[styles.dayRow, i < 6 && styles.dayRowLine]}>
              <Text style={styles.dayName}>{i === 0 ? t('今天') : t(WEEKDAY[date.getDay()])}</Text>
              <Text style={styles.dayEmoji}>{dw.emoji}</Text>
              <Text style={styles.dayLabel}>{t(dw.label)}</Text>
              <Text style={styles.dayTemp}>
                {dw.hi}° / {dw.lo}°
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          {t('天气数据来自 Open-Meteo。位置只存在这台手机上，不会上传。')}
          {'\n'}
          {t('没设位置时，显示的是这个世界自己生成的天气。')}
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    content: { padding: 18, paddingBottom: 40 },
    today: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 26,
      paddingVertical: 26,
    },
    todayEmoji: { fontSize: 56 },
    todayTemp: { fontSize: 54, fontWeight: '300', color: Romance.ink, marginTop: 4 },
    todayLabel: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 2 },
    todayLine: { fontSize: 12, color: Romance.sub, marginTop: 6 },
    todayCity: { fontSize: 12, color: Romance.faint, marginTop: 10 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: Romance.sub,
      marginTop: 20,
      marginBottom: 8,
    },
    locBtn: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 13,
      alignItems: 'center',
    },
    locBtnText: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    searchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    searchInput: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14,
      color: Romance.ink,
    },
    searchBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 18,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    searchBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    hitRow: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    hitName: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    hitDetail: { fontSize: 11, color: Romance.faint },
    week: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14 },
    dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    dayRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Romance.line },
    dayName: { width: 58, fontSize: 13, color: Romance.ink, fontWeight: '600' },
    dayEmoji: { fontSize: 18 },
    dayLabel: { flex: 1, fontSize: 13, color: Romance.sub },
    dayTemp: { fontSize: 13, color: Romance.ink },
    footnote: {
      textAlign: 'center',
      fontSize: 11,
      color: Romance.faint,
      marginTop: 22,
      lineHeight: 17,
    },
  })
);

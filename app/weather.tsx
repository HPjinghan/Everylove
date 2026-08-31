/**
 * 天气详情（D-061）：桌面天气卡点开进来。
 * - 位置：定位（expo-location 反地理编码取城市名）或手动搜索地区；只作天气种子与展示，不上传
 * - 今日大天气 + 未来 7 天（确定性生成）
 * - 试装天气由世界生成（正式版接真实气象，接口不变）
 */

import * as Location from 'expo-location';
import { useState } from 'react';
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
import { setWeatherCity, tempNow, todayWeather, weatherCity, weatherFor } from '@/lib/weather';

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function WeatherScreen() {
  const [city, setCity] = useState(weatherCity());
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const w = todayWeather();

  const applyCity = (name: string) => {
    setWeatherCity(name);
    setCity(name);
    setQuery('');
  };

  /** 定位取城市：权限被拒则引导用搜索 */
  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('没拿到定位权限', '没关系——在下面直接搜索你的地区也一样。');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      const places = await Location.reverseGeocodeAsync(pos.coords);
      const p = places[0];
      const name = p?.city || p?.district || p?.subregion || p?.region;
      if (name) applyCity(name);
      else Alert.alert('定位到了，但没认出城市名', '在下面手动搜索一下吧。');
    } catch (e) {
      console.warn('[weather] 定位失败：', e);
      Alert.alert('定位失败', '在下面手动搜索你的地区吧。');
    } finally {
      setLocating(false);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: d, w: weatherFor(d) };
  });

  return (
    <AppScreen title="天气">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* 今日 */}
        <View style={styles.today}>
          <Text style={styles.todayEmoji}>{w.emoji}</Text>
          <Text style={styles.todayTemp}>{tempNow(w)}°</Text>
          <Text style={styles.todayLabel}>
            {w.label} · {w.hi}° / {w.lo}°
          </Text>
          <Text style={styles.todayLine}>{w.line}</Text>
          <Text style={styles.todayCity}>{city ? `📍 ${city}` : '未设置位置'}</Text>
        </View>

        {/* 位置 */}
        <Text style={styles.sectionTitle}>位置</Text>
        <Pressable style={styles.locBtn} onPress={useMyLocation} disabled={locating}>
          <Text style={styles.locBtnText}>{locating ? '定位中…' : '📍 使用当前位置'}</Text>
        </Pressable>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="或搜索地区，如：上海 / 东京"
            placeholderTextColor={Romance.faint}
            onSubmitEditing={() => query.trim() && applyCity(query.trim())}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.searchBtn, !query.trim() && { opacity: 0.4 }]}
            disabled={!query.trim()}
            onPress={() => applyCity(query.trim())}>
            <Text style={styles.searchBtnText}>设定</Text>
          </Pressable>
        </View>

        {/* 未来 7 天 */}
        <Text style={styles.sectionTitle}>未来 7 天</Text>
        <View style={styles.week}>
          {days.map(({ date, w: dw }, i) => (
            <View key={i} style={[styles.dayRow, i < 6 && styles.dayRowLine]}>
              <Text style={styles.dayName}>{i === 0 ? '今天' : WEEKDAY[date.getDay()]}</Text>
              <Text style={styles.dayEmoji}>{dw.emoji}</Text>
              <Text style={styles.dayLabel}>{dw.label}</Text>
              <Text style={styles.dayTemp}>
                {dw.hi}° / {dw.lo}°
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          位置只用在这台手机上生成天气与显示，不会上传。{'\n'}试装的天气由世界生成，正式版接真实气象。
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
    week: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14 },
    dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    dayRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Romance.line },
    dayName: { width: 44, fontSize: 13, color: Romance.ink, fontWeight: '600' },
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

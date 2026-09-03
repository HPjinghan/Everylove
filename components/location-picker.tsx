/**
 * 发送位置（D-084）：真实世界的地图（react-native-maps，iOS 走 Apple 地图）。
 * 三种拿坐标的方式：定位（expo-location，拒绝也没关系）/ 在地图上点选或拖标 / 搜索一个地方（Nominatim，OSM 免费接口）。
 * 选定后反地理编码出一行名字 + 一行地址，连同经纬度交给调用方落成位置卡片。
 */

import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance, themed } from '@/constants/theme';
import { getLang, t } from '@/lib/i18n';

export interface PickedLocation {
  lat: number;
  lon: number;
  /** 一行名字（地点名 / 街道） */
  title: string;
  /** 一行地址 */
  subtitle?: string;
}

interface Hit {
  title: string;
  subtitle: string;
  lat: number;
  lon: number;
}

/** 没有任何线索时地图落在哪（目标市场：东京） */
const FALLBACK: Region = { latitude: 35.6812, longitude: 139.7671, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const CLOSE: Pick<Region, 'latitudeDelta' | 'longitudeDelta'> = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

async function searchPlaces(q: string): Promise<Hit[]> {
  const lang = getLang() === 'zh' ? 'zh-CN,zh' : getLang() === 'ja' ? 'ja,en' : 'en';
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'everylove-app/0.1 (prototype)', 'Accept-Language': lang } }
  );
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
  return data.map((r) => {
    const parts = r.display_name.split(',').map((s) => s.trim());
    return {
      title: r.name || parts[0],
      subtitle: parts.slice(1, 4).join(' · '),
      lat: Number(r.lat),
      lon: Number(r.lon),
    };
  });
}

async function describe(lat: number, lon: number): Promise<{ title: string; subtitle?: string }> {
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (g) {
      const title = g.name || g.street || g.district || g.city || t('地图上的一个点');
      const subtitle = [g.district, g.city, g.region].filter((s) => s && s !== title).join(' · ');
      return { title, subtitle: subtitle || undefined };
    }
  } catch {
    // 反地理编码失败就只给坐标
  }
  return { title: t('地图上的一个点'), subtitle: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
}

export function LocationPicker({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (loc: PickedLocation) => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(FALLBACK);
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [label, setLabel] = useState<{ title: string; subtitle?: string } | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState<'locate' | 'search' | null>(null);
  const [mapH, setMapH] = useState(0);

  // 打开时：已授权过定位就直接落到当前位置；没授权不打扰（她可以点定位按钮再要）
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted || !alive) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!alive) return;
      const r = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, ...CLOSE };
      setRegion(r);
      map.current?.animateToRegion(r, 400);
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  const choose = async (lat: number, lon: number, preset?: { title: string; subtitle?: string }) => {
    setPin({ lat, lon });
    setLabel(preset ?? null);
    map.current?.animateToRegion({ latitude: lat, longitude: lon, ...CLOSE }, 350);
    if (!preset) setLabel(await describe(lat, lon));
  };

  const locate = async () => {
    setBusy('locate');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await choose(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      console.warn('[location] 定位失败：', e);
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy('search');
    try {
      setHits(await searchPlaces(q));
    } catch (e) {
      console.warn('[location] 搜索失败：', e);
      setHits([]);
    } finally {
      setBusy(null);
    }
  };

  const send = () => {
    if (!pin || !label) return;
    onSend({ lat: pin.lat, lon: pin.lon, title: label.title, subtitle: label.subtitle });
    setPin(null);
    setLabel(null);
    setQuery('');
    setHits([]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onLayout={(e: LayoutChangeEvent) => setMapH(e.nativeEvent.layout.height)}
          onPress={(e) => void choose(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
          showsUserLocation
          showsMyLocationButton={false}>
          {pin ? (
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lon }}
              draggable
              onDragEnd={(e) => void choose(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
              pinColor={Romance.accent}
            />
          ) : null}
        </MapView>

        {/* 顶：搜索 */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.searchRow}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
              <IconSymbol name="xmark" size={18} color={Romance.ink} />
            </Pressable>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={t('搜索地点')}
              placeholderTextColor={Romance.faint}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <Pressable onPress={locate} hitSlop={10} style={styles.iconBtn}>
              {busy === 'locate' ? (
                <ActivityIndicator color={Romance.accent} />
              ) : (
                <IconSymbol name="location.fill" size={18} color={Romance.accent} />
              )}
            </Pressable>
          </View>
          {busy === 'search' ? (
            <View style={styles.hits}>
              <ActivityIndicator color={Romance.accent} />
            </View>
          ) : hits.length ? (
            <View style={styles.hits}>
              {hits.map((h, i) => (
                <Pressable
                  key={`${h.lat},${h.lon},${i}`}
                  style={styles.hit}
                  onPress={() => {
                    setHits([]);
                    void choose(h.lat, h.lon, { title: h.title, subtitle: h.subtitle || undefined });
                  }}>
                  <Text style={styles.hitTitle} numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text style={styles.hitSub} numberOfLines={1}>
                    {h.subtitle}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* 底：选中的地点 + 发送 */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
          {pin ? (
            <>
              <View style={styles.picked}>
                <Text style={styles.pickedTitle} numberOfLines={1}>
                  {label?.title ?? '…'}
                </Text>
                <Text style={styles.pickedSub} numberOfLines={1}>
                  {label?.subtitle ?? `${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`}
                </Text>
              </View>
              <Pressable style={[styles.sendBtn, !label && styles.btnDisabled]} disabled={!label} onPress={send}>
                <Text style={styles.sendText}>{t('发送位置')}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.hintText}>{mapH ? t('点地图上的一个地方') : ' '}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: Romance.bg },
    top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 8 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: Romance.stroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    search: {
      flex: 1,
      height: 40,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: Romance.stroke,
      paddingHorizontal: 12,
      fontSize: 15,
      color: Romance.ink,
    },
    hits: {
      backgroundColor: '#FFFFFF',
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: Romance.stroke,
      paddingVertical: 4,
    },
    hit: { paddingHorizontal: 12, paddingVertical: 9 },
    hitTitle: { fontSize: 14, fontWeight: '600', color: Romance.ink },
    hitSub: { fontSize: 11, color: Romance.sub, marginTop: 1 },
    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 12,
      gap: 10,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1.5,
      borderTopColor: Romance.stroke,
    },
    picked: { gap: 2 },
    pickedTitle: { fontSize: 16, fontWeight: '700', color: Romance.ink },
    pickedSub: { fontSize: 12, color: Romance.sub },
    sendBtn: {
      backgroundColor: Romance.accent,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: Romance.stroke,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sendText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    btnDisabled: { opacity: 0.4 },
    hintText: { textAlign: 'center', fontSize: 13, color: Romance.sub, paddingVertical: 6 },
  })
);

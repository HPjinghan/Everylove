/**
 * 卡片气泡的共用件（D-086）：各种卡片（features/*.tsx 注册的 render）用它画壳，
 * 会话组件对未注册的卡片种类也用它画一张只有标题的通用卡。
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Shape } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';

export function CardShell({
  emoji,
  kicker,
  title,
  subtitle,
  dark,
  top,
}: {
  emoji?: string;
  kicker: string;
  title: string;
  subtitle?: string;
  /** 气泡是深字（TA 的 / LINE 样式）还是白字（她的浅色气泡） */
  dark: boolean;
  /** 标题上方的内容（如一小块地图） */
  top?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      {top}
      <Text style={[styles.kicker, !dark && styles.kickerLight]}>
        {emoji ? `${emoji} ` : ''}
        {kicker}
      </Text>
      <Text style={[styles.title, !dark && styles.titleLight]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, !dark && styles.kickerLight]}>{subtitle}</Text> : null}
    </View>
  );
}

/** 位置卡片里那一小块不可交互的地图 */
export function CardMap({ lat, lon }: { lat: number; lon: number }) {
  return (
    <View style={styles.map} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}>
        <Marker coordinate={{ latitude: lat, longitude: lon }} />
      </MapView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { minWidth: 190, maxWidth: 240 },
    map: { height: 110, borderRadius: Shape.radiusInner, overflow: 'hidden', marginBottom: 8 },
    kicker: { fontSize: 10, color: 'rgba(0,0,0,0.45)', letterSpacing: 0.5 },
    kickerLight: { color: 'rgba(255,255,255,0.8)' },
    title: { fontSize: 16, fontWeight: '700', color: Romance.ink, marginTop: 4 },
    titleLight: { color: '#FFFFFF' },
    sub: { fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 3, lineHeight: 17 },
  })
);

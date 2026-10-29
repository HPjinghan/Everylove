/**
 * 小组件（D-263）：桌面上的小组件一个一个开关。
 * 每个一张卡：上面照桌面的样子画一块预览（铺她现在的壁纸），下面一行开关。关了的在桌面上让出位置（天气关了网格往上挪，外出关了让出那四格），
 * 再打开时外出回到第一页左上。
 */

import { ScrollView, StyleSheet, Switch, Text, useAnimatedValue, useWindowDimensions, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { Card, Divider } from '@/components/card';
import { OutingWidget } from '@/components/outing-widget';
import { Wallpaper, useWallpaperPhoto } from '@/components/wallpaper';
import { WeatherWidget } from '@/components/weather-widget';
import { DESKTOP_WIDGETS, type DesktopWidgetId } from '@/constants/apps';
import { Shape, Space, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

/** 页面左右留白（同设置页） */
const GUTTER = 18;
/** 外出小组件在桌面上的大小：网格左右留白 20、4 列、行高与图块边长同桌面（app/index.tsx） */
const DESKTOP_PAD = 20;

export default function WidgetsScreen() {
  const on = useAppStore((s) => s.desktopWidgets);
  const photo = useWallpaperPhoto();
  const { width } = useWindowDimensions();
  const still = useAnimatedValue(0.5);
  const cellW = (width - DESKTOP_PAD * 2) / Space.desktopCols;

  const preview = (id: DesktopWidgetId) =>
    id === 'weather' ? (
      <WeatherWidget interactive={false} />
    ) : (
      <OutingWidget width={cellW + Space.appTile} height={Space.desktopRow + Space.appTile} wiggle={still} onPhoto={!!photo.source} />
    );

  return (
    <AppScreen title={t('小组件')}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {DESKTOP_WIDGETS.map((w) => {
          const enabled = on[w.id] !== false;
          return (
            <View key={w.id} style={styles.group}>
              <Text style={styles.groupTitle}>{t(w.label)}</Text>
              <Card padded={false} style={styles.card}>
                <View style={[styles.preview, !enabled && styles.previewOff]} pointerEvents="none">
                  <Wallpaper source={photo.source} onError={photo.onError} />
                  {preview(w.id)}
                </View>
                <Divider soft />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{t('在桌面上显示')}</Text>
                  <Switch
                    value={enabled}
                    onValueChange={(v) => useAppStore.getState().setDesktopWidget(w.id, v)}
                    trackColor={{ true: Romance.accent, false: Romance.line }}
                  />
                </View>
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: GUTTER, paddingBottom: 40 },
    group: { marginTop: 16 },
    groupTitle: {
      fontSize: Type.scale.label.size,
      fontWeight: '600',
      color: Romance.sub,
      marginBottom: Space.inline,
    },
    card: { overflow: 'hidden', borderRadius: Shape.radius },
    // 一小块桌面：铺她现在的壁纸，小组件照原样放在中间
    preview: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Space.screen,
      overflow: 'hidden',
    },
    previewOff: { opacity: 0.4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inline,
      paddingVertical: 10,
      paddingHorizontal: Space.cardX,
    },
    rowLabel: { flex: 1, fontSize: Type.scale.body.size, color: Romance.ink },
  })
);

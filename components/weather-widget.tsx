/**
 * 桌面的天气小组件（D-036 / D-231）：一条晴空蓝的长条，白字——图标、现在的温度、天气、高低温、城市（没定位写一句天气）；点开天气页。
 * 桌面（app/index.tsx）与设置 → 小组件的预览（D-263）共用。
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MingCute, WEATHER_ICON } from '@/components/mingcute';
import { WIDGET_TINT } from '@/constants/apps';
import { CONTROL_FONT_SCALE, DISPLAY_FONT_SCALE, Elevation, Shape, Space, Type } from '@/constants/design';
import { Fonts, themed, withAlpha } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tempNow, todayWeather, weatherCity } from '@/lib/weather';

/** 天气卡的天气图标边长（D-229：单色图标替掉彩色 emoji） */
const WEATHER_ICON_SIZE = 40;
/** 天气卡里副行以外的宽：左右内边距 36 + 天气图标 + 温度约 70 + 两道间距 */
const WEATHER_FIXED_W = 36 + WEATHER_ICON_SIZE + 70 + Space.screen * 2;

/** interactive = false：设置里的预览，点了不跳 */
export function WeatherWidget({ interactive = true }: { interactive?: boolean }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const w = todayWeather();
  const city = weatherCity();
  // 副行能用的宽：屏宽 − 两侧留白 − 卡内边距 / 天气符号 / 温度 / 间距
  const lineMax = width - Space.screen * 2 - WEATHER_FIXED_W;
  return (
    <Pressable style={styles.weatherWrap} disabled={!interactive} onPress={() => router.push('/weather')}>
      <View style={styles.weather}>
        <MingCute name={WEATHER_ICON[w.id]} size={WEATHER_ICON_SIZE} color="#FFFFFF" />
        <Text style={styles.weatherTemp} maxFontSizeMultiplier={DISPLAY_FONT_SCALE}>
          {tempNow(w)}°
        </Text>
        <View style={styles.weatherInfo}>
          <Text style={styles.weatherLabel} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
            {t(w.label)}
          </Text>
          <Text style={styles.weatherRange} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
            {w.hi}° / {w.lo}°
          </Text>
          <Text style={[styles.weatherLine, { maxWidth: lineMax }]} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
            {city ? city : t(w.line)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // 天气小组件（D-231）：晴空蓝底、白字，圆角比图块大一号
    weatherWrap: { alignSelf: 'center' },
    weather: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.screen,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: Shape.radiusWidget,
      backgroundColor: WIDGET_TINT.weather,
      ...Elevation.low,
    },
    weatherTemp: {
      fontFamily: Fonts.labelBold,
      fontSize: 44,
      color: '#FFFFFF',
    },
    weatherInfo: {},
    weatherLabel: {
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    weatherRange: {
      fontFamily: Fonts.label,
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      color: withAlpha('#FFFFFF', 0.85),
    },
    weatherLine: {
      fontSize: Type.scale.label.size,
      lineHeight: 18,
      color: withAlpha('#FFFFFF', 0.85),
    },
  })
);

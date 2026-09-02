import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { applyThemeColors, Romance } from '@/constants/theme';
import { authConfigured } from '@/lib/auth';
import { setLang } from '@/lib/i18n';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import { deliverDuePosts } from '@/lib/posts';
import { initCloudSync } from '@/lib/sync';
import { initWeather, refreshWeather } from '@/lib/weather';
import '@/lib/notifications';
import { useAppStore, useHydrated } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const hydrated = useHydrated();
  // 主题（D-030）与语言（D-066）：水合即应用；切换时 key 重挂载全树让 themed()/t() 生效
  const themeId = useAppStore((s) => s.themeId);
  const language = useAppStore((s) => s.language);
  if (hydrated) {
    applyThemeColors(themeId);
    setLang(language);
  }
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Romance.bg,
      primary: Romance.accent,
      card: Romance.bg,
      text: Romance.ink,
    },
  };
  // 启动：种子帖、心跳与发帖补投（开门链路已下线，D-046；发帖调度 D-055）。
  // onboarding 门禁是声明式的（app/index.tsx 桌面），根布局不做任何命令式跳转——首帧跳转会崩在 assertIsReady。
  useEffect(() => {
    if (!hydrated) return;
    useAppStore.getState().ensureSeedPosts();
    void initWeather();
    deliverDueHeartbeats();
    void deliverDuePosts();
    SplashScreen.hideAsync();
  }, [hydrated]);

  // 云同步（D-054/D-057 云端为主）：标脏防抖上传、退后台冲刷、启动/登录/回线对账
  useEffect(() => {
    if (!hydrated || !authConfigured()) return;
    return initCloudSync();
  }, [hydrated]);

  // 回前台补投心跳与帖子
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        deliverDueHeartbeats();
        void deliverDuePosts();
        void refreshWeather();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider key={`${themeId}-${language}`} value={theme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Romance.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="chat/[characterId]" />
        <Stack.Screen name="adopt/[characterId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="bond/[bondId]" />
        <Stack.Screen name="outing/[placeId]" />
        <Stack.Screen
          name="call/[characterId]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
        />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { applyThemeColors, Romance } from '@/constants/theme';
import { deliverDueHeartbeats } from '@/lib/heartbeat';
import '@/lib/notifications';
import { useAppStore, useHydrated } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const hydrated = useHydrated();
  // 主题（D-030）：水合即应用；切换时导航主题按新 Romance 重建，key 重挂载全树让 themed() 样式生效
  const themeId = useAppStore((s) => s.themeId);
  if (hydrated) applyThemeColors(themeId);
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
  // 启动：种子帖、心跳补投（开门链路已下线，D-046）。onboarding 门禁是声明式的（app/index.tsx 桌面），
  // 根布局不做任何命令式跳转——首帧跳转会崩在 assertIsReady。
  useEffect(() => {
    if (!hydrated) return;
    useAppStore.getState().ensureSeedPosts();
    deliverDueHeartbeats();
    SplashScreen.hideAsync();
  }, [hydrated]);

  // 回前台补投心跳
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') deliverDueHeartbeats();
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider key={themeId} value={theme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Romance.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="chat/[characterId]" />
        <Stack.Screen name="adopt/[characterId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="bond/[bondId]" />
        <Stack.Screen name="outing/[placeId]" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { Romance } from '@/constants/theme';
import { deliverAndSyncArrivals } from '@/lib/arrivals';
import '@/lib/notifications';
import { useAppStore } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

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

export default function RootLayout() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(useAppStore.persist.hasHydrated());
  // 首帧时导航树还没挂载，此时 replace 会崩；等 key 出现才可跳转
  const navReady = Boolean(useRootNavigationState()?.key);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  // 启动：种子帖、开门投递、落格判定（新用户落广场，有领养默认落消息）
  useEffect(() => {
    if (!hydrated || !navReady) return;
    const state = useAppStore.getState();
    state.ensureSeedPosts();
    deliverAndSyncArrivals();
    if (!state.onboarded) {
      router.replace('/onboarding');
    } else if (state.bonds.length > 0) {
      router.replace('/(tabs)/messages');
    }
    SplashScreen.hideAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, navReady]);

  // 回前台补投开门
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') deliverAndSyncArrivals();
    });
    return () => sub.remove();
  }, []);

  // 点开「他来了」的通知 → 直达他的会话（同样等导航就绪，冷启动场景）
  useEffect(() => {
    if (!navReady) return;
    const open = async (bondId?: string) => {
      if (!bondId) return;
      await deliverAndSyncArrivals();
      router.push({ pathname: '/bond/[bondId]', params: { bondId } });
    };
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      open(resp?.notification.request.content.data?.bondId as string | undefined);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      open(resp.notification.request.content.data?.bondId as string | undefined);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navReady]);

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Romance.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="chat/[characterId]" />
        <Stack.Screen name="adopt/[characterId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="bond/[bondId]" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

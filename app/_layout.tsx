import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

// 底座启动（D-086）：把所有玩法装进 core/ 的插槽——必须在任何回合 / 任务之前
import '@/features';

import { ToastHost } from '@/components/toast';
import { applyThemeColors, Romance } from '@/constants/theme';
import { runJobs } from '@/core/jobs';
import { authConfigured } from '@/lib/auth';
import { setLang } from '@/lib/i18n';
import { initCloudSync } from '@/lib/sync';
import '@/lib/notifications';
import { useAppStore, useHydrated } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const hydrated = useHydrated();
  // 设计系统字体（D-084）：Fredoka 管数字与标签；加载失败也放行（回落系统字体）
  const [fontsReady, fontError] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold });
  const ready = hydrated && (fontsReady || !!fontError);
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
  // 启动：后台任务（种子帖 / 天气 / 心跳 / 发帖 / 爽约 / TA 的记事本……全在 features/schedulers.ts 登记）。
  // onboarding 门禁是声明式的（app/index.tsx 桌面），根布局不做任何命令式跳转——首帧跳转会崩在 assertIsReady。
  useEffect(() => {
    if (!ready) return;
    void runJobs('launch');
    SplashScreen.hideAsync();
  }, [ready]);

  // 云同步（D-054/D-057 云端为主）：标脏防抖上传、退后台冲刷、启动/登录/回线对账
  useEffect(() => {
    if (!hydrated || !authConfigured()) return;
    return initCloudSync();
  }, [hydrated]);

  // 回前台：同一批后台任务按各自的钟补投
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runJobs('foreground');
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
      <ToastHost />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

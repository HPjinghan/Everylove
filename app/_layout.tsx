import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Stack } from 'expo-router';
// SDK 56 起 expo-router 不再兼容 @react-navigation/*：主题从它自带的入口拿（D-102）
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

// 底座启动（D-086）：把所有玩法装进 core/ 的插槽——必须在任何回合 / 任务之前
import '@/features';

import { ToastHost } from '@/components/toast';
import { wallpaperTint } from '@/constants/apps';
import { applyPaperTint, Romance } from '@/constants/theme';
import { runJobs } from '@/core/jobs';
import { currentChatProvider } from '@/core/providers';
import { authConfigured, ensureGuestSession } from '@/lib/auth';
import { loadEnginePreference } from '@/lib/engine';
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
  // 主题 = 壁纸（D-110）与语言（D-066）：水合即应用；切换时 key 重挂载全树让 themed()/t() 生效
  const wallpaper = useAppStore((s) => s.wallpaper);
  const language = useAppStore((s) => s.language);
  if (hydrated) {
    applyPaperTint(wallpaperTint(wallpaper));
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
  // 引擎偏好（D-106）：设置 → 开发者点选的供应商，存本机，启动读回
  useEffect(() => {
    void loadEnginePreference();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void runJobs('launch');
    SplashScreen.hideAsync();
  }, [ready]);

  // 云同步（D-054/D-057 云端为主）：标脏防抖上传、退后台冲刷、启动/登录/回线对账
  useEffect(() => {
    if (!hydrated || !authConfigured()) return;
    // 分发包没有本地 key：先把游客身份备好，第一句话不用等匿名登录（D-088）
    if (!currentChatProvider().localKey()) void ensureGuestSession();
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
    <ThemeProvider key={`${wallpaper}-${language}`} value={theme}>
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

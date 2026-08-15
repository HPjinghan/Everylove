import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance } from '@/constants/theme';
import { useAppStore, useHydrated } from '@/store/app-store';

export default function TabLayout() {
  const hydrated = useHydrated();
  const onboarded = useAppStore((s) => s.onboarded);
  const hasBonds = useAppStore((s) => s.bonds.length > 0);
  const unread = useAppStore((s) => s.bonds.reduce((n, b) => n + b.unread, 0));

  // 声明式门禁：水合前不渲染（Splash 还盖着），未 onboard 重定向。
  // 不在根布局做命令式跳转——首帧 router.replace 会崩在 assertIsReady。
  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      // 只在挂载时读一次：新用户落广场，有领养默认落消息
      initialRouteName={hasBonds ? 'messages' : 'index'}
      screenOptions={{
        tabBarActiveTintColor: Romance.accent,
        tabBarInactiveTintColor: Romance.faint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { backgroundColor: '#FFFFFF' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '广场',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: '动态',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="heart.text.square.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '捏＋',
          tabBarIcon: ({ color }) => <IconSymbol size={30} name="plus.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '消息',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: Romance.accent, color: '#fff' },
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.crop.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance } from '@/constants/theme';

/**
 * 手机壳内 App 的通用外框（D-021）：顶部返回桌面 + App 名。
 * 桌面制导航深度 +1，返回必须处处可达。
 */
export function AppScreen({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.back}>
          <IconSymbol name="chevron.left" size={20} color={Romance.ink} />
          <Text style={styles.backText}>桌面</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>{right}</View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Romance.line,
  },
  back: { flexDirection: 'row', alignItems: 'center', width: 76 },
  backText: { fontSize: 14, color: Romance.ink },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: Romance.ink },
  right: { width: 76, alignItems: 'flex-end' },
  body: { flex: 1 },
});

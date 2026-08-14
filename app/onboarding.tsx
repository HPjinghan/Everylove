/**
 * Onboarding 第一问：「你想被谁爱？」
 * 既是全性向声明，也是广场口味过滤（架构全性向，火力女频先行）。
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Romance } from '@/constants/theme';
import type { LovePref } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const OPTIONS: { key: LovePref; label: string; sub: string }[] = [
  { key: 'male', label: '男生', sub: '他会先来找你' },
  { key: 'female', label: '女生', sub: '她会先来找你' },
  { key: 'any', label: '都可以', sub: '心动没有条件' },
  { key: 'nonhuman', label: '非人类', sub: '有什么正朝你走来' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const choose = (pref: LovePref) => {
    completeOnboarding(pref);
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 80, paddingBottom: insets.bottom }]}>
      <Text style={styles.question}>你想被谁爱？</Text>
      <Text style={styles.hint}>不用你主动。选好之后，等他来。</Text>
      <View style={styles.options}>
        {OPTIONS.map((o) => (
          <Pressable key={o.key} style={styles.option} onPress={() => choose(o.key)}>
            <Text style={styles.optionLabel}>{o.label}</Text>
            <Text style={styles.optionSub}>{o.sub}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footnote}>广场会记住你的口味 · 随时可以换着看</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Romance.bg, paddingHorizontal: 28 },
  question: { fontSize: 32, fontWeight: '700', color: Romance.ink },
  hint: { fontSize: 14, color: Romance.sub, marginTop: 10 },
  options: { marginTop: 40, gap: 12 },
  option: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: { fontSize: 18, fontWeight: '600', color: Romance.ink },
  optionSub: { fontSize: 12, color: Romance.faint },
  footnote: {
    marginTop: 'auto',
    marginBottom: 24,
    fontSize: 11,
    color: Romance.faint,
    textAlign: 'center',
  },
});

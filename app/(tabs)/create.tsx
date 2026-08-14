/**
 * 捏＋：快捏（原型 → 外观 → 称呼，3 分钟）。
 * 审核最小拦截：挡真人明星与 IP 角色（红线 #1/#4，完整流程见 OPEN_QUESTIONS #7）。
 * 工坊（捏树）不在试装范围。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { ARCHETYPE_LABEL, BLOCKED_NAME_PATTERN } from '@/content/characters';
import { Romance } from '@/constants/theme';
import { uid } from '@/lib/format';
import type { ArchetypeId } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const PALETTES = [
  { color: '#3E5C6B', colorSoft: '#EAF3F7' },
  { color: '#C96F3B', colorSoft: '#FDF0E6' },
  { color: '#23252E', colorSoft: '#EFEDF3' },
  { color: '#7A4E8C', colorSoft: '#F5EDF9' },
  { color: '#3E6B4F', colorSoft: '#EAF5EE' },
  { color: '#A8354D', colorSoft: '#FBEAEE' },
];

const DEFAULT_HOOK: Record<Exclude<ArchetypeId, 'nonhuman'>, string> = {
  gentle: 'TA 记得你随口说过的每一句话。',
  sharp: 'TA 嘴上嫌你烦，却一直留着你的位置。',
  ceo: 'TA 什么都能安排，除了见你时的心跳。',
};

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [archetype, setArchetype] = useState<Exclude<ArchetypeId, 'nonhuman'> | null>(null);
  const [loveTag, setLoveTag] = useState<'male' | 'female'>('male');
  const [look, setLook] = useState('');
  const [palette, setPalette] = useState(0);
  const [name, setName] = useState('');
  const [hook, setHook] = useState('');

  const submit = () => {
    if (!archetype || !name.trim()) return;
    const combined = `${name} ${look} ${hook}`;
    if (BLOCKED_NAME_PATTERN.test(combined)) {
      Alert.alert(
        '这个他不能被捏出来',
        '不能捏真人明星或已有 IP 的角色。\n用文字描述「神似」是可以的。'
      );
      return;
    }
    useAppStore.getState().addCustomCharacter({
      id: uid('c'),
      name: name.trim(),
      archetype,
      loveTag,
      identity: look.trim() ? look.trim().slice(0, 18) : '你亲手捏出来的 TA',
      hook: hook.trim() || DEFAULT_HOOK[archetype],
      intro: '……你捏出来的 TA，正在看你。',
      tags: ['自创', ARCHETYPE_LABEL[archetype]],
      adoptedCount: 0,
      ...PALETTES[palette],
      custom: true,
    });
    setArchetype(null);
    setLook('');
    setName('');
    setHook('');
    Alert.alert('他醒过来了', '去广场看看他。', [
      { text: '去广场', onPress: () => router.push('/(tabs)') },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>捏＋</Text>
        <Text style={styles.subtitle}>三分钟，捏一个只属于你的 TA</Text>

        <Text style={styles.step}>① TA 怎么爱你（原型与性别）</Text>
        <View style={styles.archRow}>
          {(Object.keys(DEFAULT_HOOK) as (keyof typeof DEFAULT_HOOK)[]).map((a) => (
            <Pressable
              key={a}
              style={[styles.archCard, archetype === a && styles.archCardActive]}
              onPress={() => setArchetype(a)}>
              <Text style={[styles.archLabel, archetype === a && styles.archLabelActive]}>
                {ARCHETYPE_LABEL[a]}
              </Text>
            </Pressable>
          ))}
          <View style={[styles.archCard, styles.archCardDisabled]}>
            <Text style={styles.archLabelDisabled}>非人类 · 暂不开放自捏</Text>
          </View>
        </View>
        <View style={styles.genderRow}>
          {(['male', 'female'] as const).map((g) => (
            <Pressable
              key={g}
              style={[styles.genderChip, loveTag === g && styles.genderChipActive]}
              onPress={() => setLoveTag(g)}>
              <Text style={[styles.genderText, loveTag === g && styles.genderTextActive]}>
                {g === 'male' ? '男生' : '女生'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.step}>② TA 长什么样（文字描述）</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={look}
          onChangeText={setLook}
          placeholder="银灰色头发，眼下有一颗泪痣，笑起来很凶……"
          placeholderTextColor={Romance.faint}
          multiline
          maxLength={60}
        />
        <View style={styles.paletteRow}>
          {PALETTES.map((p, i) => (
            <Pressable
              key={i}
              onPress={() => setPalette(i)}
              style={[
                styles.swatch,
                { backgroundColor: p.color },
                palette === i && styles.swatchActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.step}>③ TA 叫什么</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="给 TA 一个名字"
          placeholderTextColor={Romance.faint}
          maxLength={12}
        />
        <TextInput
          style={styles.input}
          value={hook}
          onChangeText={setHook}
          placeholder="一句话钩子（可选，广场卡片上会显示）"
          placeholderTextColor={Romance.faint}
          maxLength={30}
        />

        {name.trim() && archetype ? (
          <View style={styles.previewCard}>
            <CharAvatar name={name.trim()} color={PALETTES[palette].color} size={44} />
            <View style={styles.previewText}>
              <Text style={styles.previewName}>{name.trim()}</Text>
              <Text style={styles.previewHook}>「{hook.trim() || DEFAULT_HOOK[archetype]}」</Text>
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryBtn, (!archetype || !name.trim()) && styles.btnDisabled]}
          disabled={!archetype || !name.trim()}
          onPress={submit}>
          <Text style={styles.primaryBtnText}>让 TA 醒来</Text>
        </Pressable>
        <Text style={styles.footnote}>不能捏真人与 IP 角色 · 发布即默认同意创作规范</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Romance.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Romance.ink },
  subtitle: { fontSize: 13, color: Romance.sub, marginTop: 2 },
  step: { fontSize: 15, fontWeight: '600', color: Romance.ink, marginTop: 24, marginBottom: 10 },
  archRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  archCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  archCardActive: { backgroundColor: Romance.accent },
  archCardDisabled: { opacity: 0.5 },
  archLabel: { fontSize: 14, color: Romance.ink, fontWeight: '500' },
  archLabelActive: { color: '#fff' },
  archLabelDisabled: { fontSize: 14, color: Romance.faint },
  genderRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  genderChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  genderChipActive: { backgroundColor: Romance.ink },
  genderText: { fontSize: 13, color: Romance.sub },
  genderTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Romance.ink,
    marginBottom: 10,
  },
  inputMultiline: { minHeight: 68, textAlignVertical: 'top' },
  paletteRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchActive: { borderWidth: 3, borderColor: Romance.accent },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  previewText: { flex: 1 },
  previewName: { fontSize: 16, fontWeight: '700', color: Romance.ink },
  previewHook: { fontSize: 12, color: Romance.sub, marginTop: 3, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: Romance.accent,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 11, color: Romance.faint, textAlign: 'center', marginTop: 12 },
});

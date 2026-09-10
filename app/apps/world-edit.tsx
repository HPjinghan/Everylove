/**
 * 世界书 · 编辑页（D-110；纸面）：新建 / 编辑一个世界——名字、一句话、设定（一行一条：时代 / 地理 / 规则 / 常识……）。
 * 保存即入库；编辑态可收藏 / 取消收藏、删除（住在里面的 TA 回到现实世界）。字段 Field + Input、按钮 Button。
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen, HeaderAction } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Field, Input } from '@/components/input';
import { Space } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { WORLD_RULES_PLACEHOLDER } from '@/content/worlds';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useAppStore } from '@/store/app-store';

export default function WorldEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const existing = useAppStore((s) => (id ? s.worldBooks.find((w) => w.id === id) : undefined));
  const fav = useAppStore((s) => (id ? s.worldFavorites.includes(id) : false));
  const [name, setName] = useState(existing?.name ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [rules, setRules] = useState(existing?.rules ?? '');

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const now = Date.now();
    if (existing) {
      useAppStore.getState().updateWorldBook({ ...existing, name: n, summary: summary.trim(), rules: rules.trim() || undefined, updatedAt: now });
    } else {
      const w = { id: uid('w'), name: n, summary: summary.trim(), rules: rules.trim() || undefined, createdAt: now, updatedAt: now };
      useAppStore.getState().addWorldBook(w);
      // 新建即收藏：建出来就是为了给角色用
      useAppStore.getState().toggleWorldFavorite(w.id);
    }
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('删除这个世界'), t('「{name}」会消失，住在里面的 TA 回到现实世界。', { name: existing.name }), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('删除'),
        style: 'destructive',
        onPress: () => {
          useAppStore.getState().removeWorldBook(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <AppScreen
      title={existing ? t('编辑世界') : t('新的世界')}
      right={<HeaderAction label={t('保存')} onPress={save} disabled={!name.trim()} />}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label={t('这个世界叫什么')}>
            <Input value={name} onChangeText={setName} placeholder={t('如：云海之上')} maxLength={20} />
          </Field>
          <Field label={t('一句话')}>
            <Input value={summary} onChangeText={setSummary} placeholder={t('这是个什么样的世界')} maxLength={80} />
          </Field>
          <Field label={t('设定')} hint={t('TA 对一切的认知都来自这里：这里有什么、没有什么。')}>
            <Input
              value={rules}
              onChangeText={setRules}
              placeholder={WORLD_RULES_PLACEHOLDER}
              multiline
              style={styles.rules}
              maxLength={1500}
            />
          </Field>
          {existing ? (
            <View style={styles.actions}>
              <Button
                label={fav ? t('取消收藏') : t('收藏')}
                variant="paper"
                size="md"
                onPress={() => useAppStore.getState().toggleWorldFavorite(existing.id)}
              />
              <Button label={t('删除')} variant="outline" size="md" onPress={remove} />
            </View>
          ) : null}
          <Text style={styles.note}>{t('收藏的世界才会出现在创造角色的选项里。')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: 18, paddingVertical: Space.screen, paddingBottom: 60, gap: 4 },
    rules: { minHeight: 160, textAlignVertical: 'top' },
    actions: { flexDirection: 'row', gap: Space.inlineLoose, marginTop: 8 },
    note: { textAlign: 'center', color: Romance.faint, fontSize: 11, marginTop: 16 },
  })
);

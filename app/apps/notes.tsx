/**
 * 记事本（D-085）：她自己的本子，随时写。私密——只有她让 TA「看我的手机」时 TA 才看得到（§7 素材：可选日记）。
 * 列表（最近改动在前）+ 全屏编辑；长按删除。界面按设计系统 token（Card / Space / Fonts）。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { timeAgo, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Note } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notes = useAppStore((s) => s.notes);
  const [editing, setEditing] = useState<Note | null>(null);
  const [draft, setDraft] = useState('');

  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  const open = (n: Note | null) => {
    setEditing(n ?? { id: uid('n'), text: '', at: Date.now(), updatedAt: Date.now() });
    setDraft(n?.text ?? '');
  };

  const done = () => {
    if (!editing) return;
    const text = draft.trim();
    const store = useAppStore.getState();
    const exists = notes.some((n) => n.id === editing.id);
    if (!text) {
      if (exists) store.removeNote(editing.id);
    } else if (exists) {
      store.updateNote(editing.id, text);
    } else {
      store.addNote({ ...editing, text, updatedAt: Date.now() });
    }
    setEditing(null);
    setDraft('');
  };

  const remove = (n: Note) => {
    Alert.alert(t('删掉这条？'), n.text.slice(0, 40), [
      { text: t('取消'), style: 'cancel' },
      { text: t('删除'), style: 'destructive', onPress: () => useAppStore.getState().removeNote(n.id) },
    ]);
  };

  return (
    <AppScreen
      title={t('记事本')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      right={
        <Pressable onPress={() => open(null)} hitSlop={10}>
          <IconSymbol name="square.and.pencil" size={22} color={Romance.accent} />
        </Pressable>
      }>
      <ScrollView contentContainerStyle={styles.list}>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>{t('还是空的。')}</Text>
        ) : (
          sorted.map((n) => {
            const [first, ...rest] = n.text.split('\n');
            return (
              <Pressable key={n.id} onPress={() => open(n)} onLongPress={() => remove(n)} delayLongPress={350}>
                <Card>
                  <Text style={styles.title} numberOfLines={1}>
                    {first}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.time}>{timeAgo(n.updatedAt)}</Text>
                    {rest.join(' ').trim() ? (
                      <Text style={styles.preview} numberOfLines={1}>
                        {rest.join(' ').trim()}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={done}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editor, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.editorBar}>
              <Text style={styles.editorTime}>{editing ? timeAgo(editing.updatedAt) : ''}</Text>
              <Pressable onPress={done} hitSlop={10}>
                <Text style={styles.doneText}>{t('完成')}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('写点什么…')}
              placeholderTextColor={Romance.faint}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: Space.screen, gap: Space.inlineLoose, paddingBottom: 40 },
    empty: { textAlign: 'center', color: Romance.sub, fontSize: 13, marginTop: 40 },
    title: { fontSize: 15, fontWeight: '600', color: Romance.ink },
    metaRow: { flexDirection: 'row', gap: Space.inline, marginTop: 4, alignItems: 'center' },
    time: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    preview: { flex: 1, fontSize: 12, color: Romance.sub },
    editor: { flex: 1, backgroundColor: Romance.card, paddingHorizontal: Space.screen },
    editorBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    editorTime: { fontFamily: Fonts.label, fontSize: 12, color: Romance.sub },
    doneText: { fontFamily: Fonts.labelBold, fontSize: 16, color: Romance.accent },
    input: { flex: 1, fontSize: 16, lineHeight: 24, color: Romance.ink, paddingTop: 14 },
  })
);

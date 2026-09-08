/**
 * 记事本（D-085；D-100 纸面）：她自己的本子，随时写。私密——只有她让 TA「看我的手机」时 TA 才看得到（§7 素材：可选日记）。
 * 列表（最近改动在前；Card：标题 15/600 · 时间 Fredoka 11 · 预览 12 单行）+ 全屏编辑（标题 / 正文两栏——本子只存一段 text，
 * 第一行就是标题；保存 / 删除用 Button，返回也保存、不丢字）；列表长按删除。
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '@/components/app-screen';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space } from '@/constants/design';
import { Fonts, Romance, themed } from '@/constants/theme';
import { timeAgo, uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Note } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 本子只有一段 text：第一行是标题，其余是正文（列表与 TA 翻手机时都这么读） */
function splitNote(text: string): { title: string; body: string } {
  const [first = '', ...rest] = text.split('\n');
  return { title: first, body: rest.join('\n') };
}

function joinNote(title: string, body: string): string {
  const head = title.trim();
  const tail = body.trim();
  if (!head) return tail;
  return tail ? `${head}\n${tail}` : head;
}

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notes = useAppStore((s) => s.notes);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  const exists = !!editing && notes.some((n) => n.id === editing.id);

  const open = (n: Note | null) => {
    const parts = splitNote(n?.text ?? '');
    setEditing(n ?? { id: uid('n'), text: '', at: Date.now(), updatedAt: Date.now() });
    setTitle(parts.title);
    setBody(parts.body);
  };

  const close = () => {
    setEditing(null);
    setTitle('');
    setBody('');
  };

  const save = () => {
    if (!editing) return;
    const text = joinNote(title, body);
    const store = useAppStore.getState();
    if (!text) {
      if (exists) store.removeNote(editing.id);
    } else if (exists) {
      store.updateNote(editing.id, text);
    } else {
      store.addNote({ ...editing, text, updatedAt: Date.now() });
    }
    close();
  };

  const remove = (n: Note, after?: () => void) => {
    Alert.alert(t('删掉这条？'), splitNote(n.text).title.slice(0, 40), [
      { text: t('取消'), style: 'cancel' },
      {
        text: t('删除'),
        style: 'destructive',
        onPress: () => {
          useAppStore.getState().removeNote(n.id);
          after?.();
        },
      },
    ]);
  };

  return (
    <AppScreen
      title={t('记事本')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      right={
        <Pressable onPress={() => open(null)} hitSlop={10}>
          <MingCute name="pencil" size={22} color={Romance.accent} />
        </Pressable>
      }>
      <ScrollView contentContainerStyle={styles.list}>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>{t('还是空的。')}</Text>
        ) : (
          sorted.map((n) => {
            const parts = splitNote(n.text);
            const preview = parts.body.replace(/\s*\n\s*/g, ' ').trim();
            return (
              <Pressable key={n.id} onPress={() => open(n)} onLongPress={() => remove(n)} delayLongPress={350}>
                <Card>
                  <Text style={styles.title} numberOfLines={1}>
                    {parts.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.time}>{timeAgo(n.updatedAt)}</Text>
                    {preview ? (
                      <Text style={styles.preview} numberOfLines={1}>
                        {preview}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={save}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editor, { paddingTop: insets.top }]}>
            <View style={styles.editorBar}>
              <Pressable onPress={save} hitSlop={10} style={styles.editorBack}>
                <IconSymbol name="chevron.left" size={16} color={Romance.ink} />
                <Text style={styles.editorBackText}>{t('记事本')}</Text>
              </Pressable>
              <Text style={styles.editorTime}>{editing ? timeAgo(editing.updatedAt) : ''}</Text>
              <View style={styles.editorSlot} />
            </View>
            <View style={styles.editorBody}>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={t('标题')}
                style={styles.titleInput}
                returnKeyType="next"
                autoFocus={!exists}
              />
              <Input
                value={body}
                onChangeText={setBody}
                placeholder={t('写点什么…')}
                style={styles.bodyInput}
                multiline
              />
            </View>
            <View style={[styles.editorActions, { paddingBottom: insets.bottom + Space.screen }]}>
              {editing && exists ? (
                <Button
                  label={t('删除')}
                  variant="paper"
                  size="md"
                  style={styles.flex}
                  onPress={() => remove(editing, close)}
                />
              ) : null}
              <Button label={t('保存')} variant="primary" size="md" style={styles.flex} onPress={save} />
            </View>
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
    editor: { flex: 1, backgroundColor: Romance.bg },
    editorBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Space.screen,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: Shape.stroke,
      borderBottomColor: Romance.stroke,
    },
    editorBack: { flexDirection: 'row', alignItems: 'center', width: Space.topBarSlot, gap: 2 },
    editorBackText: { fontSize: 14, fontWeight: '500', color: Romance.ink },
    editorTime: { flex: 1, textAlign: 'center', fontFamily: Fonts.label, fontSize: 11, color: Romance.sub },
    editorSlot: { width: Space.topBarSlot },
    editorBody: { flex: 1, padding: Space.screen, gap: Space.inlineLoose },
    titleInput: { fontSize: 17, fontWeight: '600' },
    bodyInput: { flex: 1 },
    editorActions: { flexDirection: 'row', gap: Space.inlineLoose, paddingHorizontal: Space.screen },
  })
);

/**
 * 记事本（D-085；D-100 纸面）：她自己的本子，随时写。私密——只有她让 TA「看我的手机」时 TA 才看得到（§7 素材：可选日记），
 * 或者她单独挑一页给某位 TA 看（D-253，features/note-share.tsx）。
 * 列表（最近改动在前；Card：标题 · 时间 · 天气 · 预览单行；上了锁的带锁；TA 看过的写「谁 看过」）+ 全屏编辑
 * （标题 / 正文两栏——本子只存一段 text，第一行就是标题）。D-253 像真手机的备忘录：自动保存、没有保存键；
 * 顶栏右边三个：上锁（看手机时不给看）/ 给 TA 看这一页 / 删除。每页写下时记一笔当天的天气。列表长按也能删。
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, showAlert } from '@/components/action-sheet';
import { AppScreen } from '@/components/app-screen';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { MingCute } from '@/components/mingcute';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Shape, Space, Type } from '@/constants/design';
import { Romance, themed } from '@/constants/theme';
import { showNote } from '@/features/note-share';
import { timeAgo, uid } from '@/lib/format';
import { getLang, localeOf, t } from '@/lib/i18n';
import type { Note } from '@/lib/types';
import { todayWeather } from '@/lib/weather';
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

/** 编辑页顶栏的日期：10月27日 / October 27 */
function dayLabel(at: number): string {
  try {
    return new Date(at).toLocaleDateString(localeOf(getLang()), { month: 'long', day: 'numeric' });
  } catch {
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

/** 自动保存：有字就存（新的落库、旧的有改动才更新），空了就删；返回存下的这页 */
function commitNote(editing: Note, text: string): Note | undefined {
  const store = useAppStore.getState();
  const current = store.notes.find((n) => n.id === editing.id);
  if (!text) {
    if (current) store.removeNote(editing.id);
    return undefined;
  }
  if (!current) {
    const fresh = { ...editing, text, updatedAt: Date.now() };
    store.addNote(fresh);
    return fresh;
  }
  if (current.text !== text) store.updateNote(editing.id, text);
  return useAppStore.getState().notes.find((n) => n.id === editing.id);
}

/** 新的一页：记下写下时的天气 */
function blankNote(): Note {
  const now = Date.now();
  return { id: uid('n'), text: '', at: now, updatedAt: now, weather: todayWeather(new Date(now)).label };
}

/** 最近看过这一页的那位（多位只写最近一位） */
function lastReader(n: Note): { name: string; at: number } | undefined {
  return [...(n.readBy ?? [])].sort((a, b) => b.at - a.at)[0];
}

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notes = useAppStore((s) => s.notes);
  const bonds = useAppStore((s) => s.bonds);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picking, setPicking] = useState(false);

  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  // 编辑中的这页在 store 里的样子（锁、谁看过随时变）
  const stored = editing ? notes.find((n) => n.id === editing.id) : undefined;
  const text = joinNote(title, body);

  const open = (n: Note | null) => {
    const parts = splitNote(n?.text ?? '');
    setEditing(n ?? blankNote());
    setTitle(parts.title);
    setBody(parts.body);
  };

  const commit = () => (editing ? commitNote(editing, text) : undefined);

  const close = () => {
    commit();
    setEditing(null);
    setTitle('');
    setBody('');
  };

  const remove = (n: Note, after?: () => void) => {
    showAlert(t('删掉这条？'), splitNote(n.text).title.slice(0, 40), [
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

  const toggleLock = () => {
    const saved = commit();
    if (saved) useAppStore.getState().setNoteLocked(saved.id, !saved.locked);
  };

  // 给 TA 看这一页：先存，再挑一位；送出后去你们的会话看 TA 怎么回
  const share = (bondId: string) => {
    setPicking(false);
    const saved = commit();
    if (!saved) return;
    setEditing(null);
    void showNote(saved.id, bondId);
    router.push(`/bond/${bondId}` as never);
  };

  return (
    <AppScreen
      title={t('记事本')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      right={
        <Pressable onPress={() => open(null)} hitSlop={10} accessibilityLabel={t('写点什么…')}>
          <MingCute name="pencil" size={22} color={Romance.accentStrong} />
        </Pressable>
      }>
      <ScrollView contentContainerStyle={styles.list}>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>{t('还是空的。')}</Text>
        ) : (
          sorted.map((n) => {
            const parts = splitNote(n.text);
            const preview = parts.body.replace(/\s*\n\s*/g, ' ').trim();
            const reader = lastReader(n);
            return (
              <Pressable key={n.id} onPress={() => open(n)} onLongPress={() => remove(n)} delayLongPress={350}>
                <Card>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {parts.title}
                    </Text>
                    {n.locked ? <MingCute name="lock" size={14} color={Romance.sub} /> : null}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.time}>
                      {timeAgo(n.updatedAt)}
                      {n.weather ? ` · ${t(n.weather)}` : ''}
                    </Text>
                    {preview ? (
                      <Text style={styles.preview} numberOfLines={1}>
                        {preview}
                      </Text>
                    ) : null}
                  </View>
                  {reader ? (
                    <Text style={styles.readBy}>{t('{name} 看过 · {ago}', { name: reader.name, ago: timeAgo(reader.at) })}</Text>
                  ) : null}
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editor, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.editorBar}>
              <Pressable onPress={close} hitSlop={10} style={styles.editorBack}>
                <IconSymbol name="chevron.left" size={16} color={Romance.ink} />
                <Text style={styles.editorBackText}>{t('记事本')}</Text>
              </Pressable>
              <Text style={styles.editorStamp} numberOfLines={1}>
                {editing ? dayLabel(editing.at) : ''}
                {editing?.weather ? ` · ${t(editing.weather)}` : ''}
              </Text>
              <View style={styles.editorTools}>
                <Pressable onPress={toggleLock} hitSlop={8} disabled={!text} accessibilityLabel={stored?.locked ? t('解锁') : t('上锁')}>
                  <IconSymbol name={stored?.locked ? 'lock' : 'lock.open'} size={19} color={text ? (stored?.locked ? Romance.accentStrong : Romance.ink) : Romance.faint} />
                </Pressable>
                {bonds.length ? (
                  <Pressable onPress={() => setPicking(true)} hitSlop={8} disabled={!text} accessibilityLabel={t('给 TA 看')}>
                    <IconSymbol name="paperplane" size={19} color={text ? Romance.ink : Romance.faint} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => stored && remove(stored, () => setEditing(null))}
                  hitSlop={8}
                  disabled={!stored}
                  accessibilityLabel={t('删除')}>
                  <IconSymbol name="trash" size={19} color={stored ? Romance.ink : Romance.faint} />
                </Pressable>
              </View>
            </View>
            <View style={styles.editorBody}>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={t('标题')}
                style={styles.titleInput}
                returnKeyType="next"
                autoFocus={!stored}
              />
              <Input value={body} onChangeText={setBody} placeholder={t('写点什么…')} style={styles.bodyInput} multiline />
              {stored && lastReader(stored) ? (
                <Text style={styles.readBy}>
                  {t('{name} 看过 · {ago}', { name: lastReader(stored)!.name, ago: timeAgo(lastReader(stored)!.at) })}
                </Text>
              ) : null}
            </View>
          </View>
          <ActionSheet
            visible={picking}
            title={t('给 TA 看')}
            actions={bonds.map((b) => ({ label: b.name, onPress: () => share(b.id) }))}
            onClose={() => setPicking(false)}
          />
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}


const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: Space.screen, gap: Space.inlineLoose, paddingBottom: 40 },
    empty: { textAlign: 'center', color: Romance.sub, fontSize: Type.scale.label.size, marginTop: 40 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.inline },
    title: { flexShrink: 1, fontSize: Type.scale.body.size, fontWeight: '600', color: Romance.ink },
    metaRow: { flexDirection: 'row', gap: Space.inline, marginTop: 4, alignItems: 'center' },
    time: { fontSize: Type.scale.timestamp.size, color: Romance.sub },
    preview: { flex: 1, fontSize: Type.scale.caption.size, color: Romance.sub },
    readBy: { fontSize: Type.scale.timestamp.size, color: Romance.accentStrong, marginTop: 6 },
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
    editorBackText: { fontSize: Type.scale.sub.size, fontWeight: '500', color: Romance.ink },
    editorStamp: { flex: 1, textAlign: 'center', fontSize: Type.scale.timestamp.size, color: Romance.sub },
    editorTools: { width: Space.topBarSlot, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
    editorBody: { flex: 1, padding: Space.screen, gap: Space.inlineLoose },
    titleInput: { fontSize: Type.scale.screenTitle.size, fontWeight: '600' },
    bodyInput: { flex: 1 },
  })
);

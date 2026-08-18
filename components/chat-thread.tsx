/**
 * 共用聊天线程：广场试聊与羁绊会话都用它。
 * 倒置列表；语音气泡为占位形态（点开看文字），供应商未定见 OPEN_QUESTIONS #6。
 */

import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharAvatar } from '@/components/char-avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance } from '@/constants/theme';
import { voiceDuration } from '@/lib/format';
import type { ChatMessage } from '@/lib/types';

function VoiceBubble({ text, color }: { text: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)}>
      <View style={styles.voiceRow}>
        <IconSymbol name="play.fill" size={14} color={color} />
        {[10, 16, 8, 14, 6, 12, 9].map((h, i) => (
          <View key={i} style={[styles.voiceBar, { height: h, backgroundColor: color }]} />
        ))}
        <Text style={[styles.voiceDuration, { color }]}>{voiceDuration(text)}</Text>
      </View>
      {open ? (
        <Text style={styles.voiceTranscript}>{text}</Text>
      ) : (
        <Text style={styles.voiceHint}>轻点查看文字 · 语音占位</Text>
      )}
    </Pressable>
  );
}

function Bubble({
  msg,
  color,
  name,
  characterId,
}: {
  msg: ChatMessage;
  color: string;
  name: string;
  characterId?: string;
}) {
  if (msg.from === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.text}</Text>
      </View>
    );
  }
  const mine = msg.from === 'me';
  return (
    <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowHim]}>
      {!mine && (
        <CharAvatar name={name} color={color} size={32} style={styles.msgAvatar} characterId={characterId} />
      )}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: Romance.bubbleMe, borderBottomRightRadius: 4 }
            : { backgroundColor: Romance.bubbleHim, borderBottomLeftRadius: 4 },
        ]}>
        {msg.kind === 'voice' ? (
          <VoiceBubble text={msg.text} color={color} />
        ) : msg.kind === 'image' && msg.imageUri ? (
          <View>
            <Image source={{ uri: msg.imageUri }} style={styles.comicImage} contentFit="cover" />
            {msg.text ? <Text style={styles.comicCaption}>{msg.text}</Text> : null}
          </View>
        ) : (
          <Text style={[styles.bubbleText, mine && { color: '#FFFFFF' }]}>{msg.text}</Text>
        )}
      </View>
    </View>
  );
}

export function ChatThread({
  messages,
  color,
  name,
  typing,
  typingLabel = '正在输入…',
  onSend,
  banner,
  cta,
  inputDisabled,
  placeholder = '说点什么…',
  characterId,
}: {
  messages: ChatMessage[];
  color: string;
  name: string;
  typing?: boolean;
  typingLabel?: string;
  onSend: (text: string) => void;
  banner?: ReactNode;
  cta?: ReactNode;
  inputDisabled?: boolean;
  placeholder?: string;
  /** 有立绘时头像显示立绘（D-019） */
  characterId?: string;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const data = [...messages].reverse();

  const send = () => {
    const text = draft.trim();
    if (!text || inputDisabled) return;
    setDraft('');
    onSend(text);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        inverted
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Bubble msg={item} color={color} name={name} characterId={characterId} />
        )}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={banner ? <View style={styles.bannerWrap}>{banner}</View> : null}
        ListHeaderComponent={
          typing ? (
            <View style={[styles.msgRow, styles.msgRowHim]}>
              <CharAvatar
                name={name}
                color={color}
                size={32}
                style={styles.msgAvatar}
                characterId={characterId}
              />
              <View style={[styles.bubble, { backgroundColor: Romance.bubbleHim }]}>
                <Text style={styles.typingText}>{typingLabel}</Text>
              </View>
            </View>
          ) : null
        }
        keyboardDismissMode="interactive"
      />
      {cta}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={[styles.input, inputDisabled && { opacity: 0.5 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={Romance.faint}
          editable={!inputDisabled}
          onSubmitEditing={send}
          returnKeyType="send"
          submitBehavior="submit"
        />
        <Pressable onPress={send} hitSlop={8} disabled={inputDisabled}>
          <IconSymbol
            name="arrow.up.circle.fill"
            size={34}
            color={draft.trim() && !inputDisabled ? Romance.accent : Romance.faint}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  bannerWrap: { marginBottom: 10 },
  msgRow: { flexDirection: 'row', marginVertical: 5, alignItems: 'flex-end' },
  msgRowHim: { justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: { marginRight: 8 },
  bubble: {
    maxWidth: '74%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#3B2126',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleText: { fontSize: 16, lineHeight: 23, color: Romance.ink },
  typingText: { fontSize: 14, color: Romance.sub },
  systemRow: { alignItems: 'center', marginVertical: 10 },
  systemText: {
    fontSize: 12,
    color: Romance.sub,
    backgroundColor: Romance.line,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  comicImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: Romance.line },
  comicCaption: { fontSize: 13, color: Romance.sub, marginTop: 8, lineHeight: 19 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  voiceBar: { width: 3, borderRadius: 2, opacity: 0.75 },
  voiceDuration: { fontSize: 13, marginLeft: 6, fontWeight: '500' },
  voiceHint: { fontSize: 11, color: Romance.faint, marginTop: 4 },
  voiceTranscript: { fontSize: 14, color: Romance.sub, marginTop: 6, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: Romance.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Romance.line,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: Romance.ink,
  },
});

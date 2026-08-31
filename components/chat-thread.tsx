/**
 * 共用聊天线程：广场试聊与羁绊会话都用它。
 * variant='line'（D-027）：羁绊会话模拟 LINE 样式——蓝灰聊天背景、白色收信气泡、
 * 浅绿发信气泡（深色文字）、气泡旁小字时间与「已读」、深色半透明系统胶囊、绿色发送键。
 *
 * LINE 对齐的消息能力（D-030）：
 * - 文本 / 图片（相册选图）/ 语音（录音发送、点按播放）/ 表情（快捷面板）
 * - 引用：长按 → 引用，气泡上方带被引摘要
 * - 撤回：长按自己的消息（24h 内）→ 双方可见「你撤回了一条消息」占位，内容清空
 * - 删除：长按任意消息 → 仅本地移除、无占位（LINE 的「删除只对自己生效」）
 * TA 的语音仍为占位形态（点开看文字），供应商未定见 OPEN_QUESTIONS #6。
 */

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { MingCute } from '@/components/mingcute';
import { PhotoViewer, Polaroid, type ViewerShot } from '@/components/polaroid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Romance, themed } from '@/constants/theme';
import { clockTime, voiceDuration } from '@/lib/format';
import { t } from '@/lib/i18n';
import { synthesizeVoice, ttsReady } from '@/lib/tts';
import type { ChatMessage } from '@/lib/types';
import { findCharacter } from '@/store/app-store';

/** LINE 拟真配色（variant='line'） */
const LINE = {
  bg: '#8CABD9',
  me: '#9CE769',
  him: '#FFFFFF',
  brand: '#06C755',
};

export type ChatVariant = 'default' | 'line';
export type ReplyRef = { from: ChatMessage['from']; text: string };

/** 撤回时限（LINE：24 小时内可撤回） */
export const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

const EMOJIS = [
  '😊', '😂', '🥰', '😳', '🥺', '😤', '😭', '🤔',
  '😴', '🙃', '😮', '🤭', '💕', '💖', '💔', '✨',
  '🌙', '🌸', '🍓', '🐱', '🐶', '👍', '👋', '🎉',
];

/**
 * TA 的语音（D-048）：点按走千帆 TTS 真实发声（按句缓存）；
 * 没配 key 或合成失败时回落原来的占位形态（点开看文字）。
 */
function VoiceBubble({
  text,
  color,
  characterId,
}: {
  text: string;
  color: string;
  characterId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [playing, setPlaying] = useState(false);
  const player = useAudioPlayer(null);
  const character = characterId ? findCharacter(characterId) : undefined;
  const canSpeak = Boolean(character) && ttsReady();

  const onPress = async () => {
    if (!canSpeak || status === 'failed') {
      setOpen((v) => !v);
      return;
    }
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    if (status !== 'ready') {
      setStatus('loading');
      const uri = await synthesizeVoice(text, character!);
      if (!uri) {
        setStatus('failed');
        setOpen(true);
        return;
      }
      player.replace({ uri });
      setStatus('ready');
    }
    player.seekTo(0);
    player.play();
    setPlaying(true);
    const secs = Math.min(59, Math.max(2, Math.round(text.length / 4)));
    setTimeout(() => setPlaying(false), secs * 1000 + 500);
  };

  return (
    <Pressable onPress={onPress}>
      <View style={styles.voiceRow}>
        {status === 'loading' ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <IconSymbol name={playing ? 'pause.fill' : 'play.fill'} size={14} color={color} />
        )}
        {[10, 16, 8, 14, 6, 12, 9].map((h, i) => (
          <View key={i} style={[styles.voiceBar, { height: h, backgroundColor: color }]} />
        ))}
        <Text style={[styles.voiceDuration, { color }]}>{voiceDuration(text)}</Text>
      </View>
      {open ? (
        <Text style={styles.voiceTranscript}>{text}</Text>
      ) : (
        <Pressable onPress={() => setOpen(true)} hitSlop={6}>
          <Text style={styles.voiceHint}>
            {status === 'failed'
              ? t('语音暂时没接通 · 点这里看文字')
              : canSpeak
                ? status === 'loading'
                  ? t('TA 在开嗓…')
                  : t('看文字')
                : t('轻点查看文字 · 语音占位')}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/** 我的语音：真实音频，点按播放/暂停 */
function AudioVoiceBubble({ uri, durationMs, tint }: { uri: string; durationMs?: number; tint: string }) {
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.seekTo(0);
      player.play();
      setPlaying(true);
      const secs = (durationMs ?? 3000) / 1000;
      setTimeout(() => setPlaying(false), secs * 1000 + 300);
    }
  };
  const secs = Math.max(1, Math.round((durationMs ?? 0) / 1000));
  return (
    <Pressable onPress={toggle} style={styles.voiceRow}>
      <IconSymbol name={playing ? 'pause.fill' : 'play.fill'} size={14} color={tint} />
      {[10, 16, 8, 14, 6, 12, 9].map((h, i) => (
        <View key={i} style={[styles.voiceBar, { height: h, backgroundColor: tint }]} />
      ))}
      <Text style={[styles.voiceDuration, { color: tint }]}>
        0:{secs.toString().padStart(2, '0')}
      </Text>
    </Pressable>
  );
}

function Bubble({
  msg,
  color,
  name,
  characterId,
  variant = 'default',
  read,
  onLongPress,
  onOpenPhoto,
}: {
  msg: ChatMessage;
  color: string;
  name: string;
  characterId?: string;
  variant?: ChatVariant;
  /** LINE 模式：我的消息是否显示「已读」（TA 回过话即视为已读） */
  read?: boolean;
  onLongPress?: (msg: ChatMessage) => void;
  /** 拍立得点开看大图（D-056） */
  onOpenPhoto?: (shot: ViewerShot) => void;
}) {
  const line = variant === 'line';
  // 拍立得（D-056）：生成的照片居中呈现——照片不是谁「说」的话，是你们的东西
  if (msg.kind === 'image' && msg.imageUri && msg.polaroid) {
    return (
      <View style={styles.polaroidRow}>
        <Polaroid
          uri={msg.imageUri}
          caption={msg.text || undefined}
          tiltKey={msg.id}
          onPress={() => onOpenPhoto?.({ uri: msg.imageUri!, caption: msg.text || undefined })}
          onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        />
      </View>
    );
  }
  if (msg.from === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, line && styles.systemTextLine]}>{msg.text}</Text>
      </View>
    );
  }
  const mine = msg.from === 'me';
  // 撤回占位（LINE：居中灰字，无内容）
  if (msg.recalled) {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.recalledText, line && styles.recalledTextLine]}>
          {mine ? t('你撤回了一条消息') : t('{name} 撤回了一条消息', { name })}
        </Text>
      </View>
    );
  }
  const meta = line ? (
    <View style={[styles.metaCol, mine ? styles.metaColMe : styles.metaColHim]}>
      {mine && read ? <Text style={styles.metaText}>{t('已读')}</Text> : null}
      <Text style={styles.metaText}>{clockTime(msg.at)}</Text>
    </View>
  ) : null;
  const bubbleBg = mine
    ? { backgroundColor: line ? LINE.me : Romance.bubbleMe, borderBottomRightRadius: 4 }
    : { backgroundColor: line ? LINE.him : Romance.bubbleHim, borderBottomLeftRadius: 4 };
  const textDark = !mine || line;
  return (
    <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowHim]}>
      {!mine && (
        <CharAvatar name={name} color={color} size={32} style={styles.msgAvatar} characterId={characterId} />
      )}
      {mine ? meta : null}
      <Pressable
        onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        delayLongPress={350}
        style={[styles.bubble, line && styles.bubbleLine, bubbleBg]}>
        {msg.replyTo ? (
          <View style={styles.quote}>
            <Text style={styles.quoteName}>{msg.replyTo.from === 'me' ? t('你') : name}</Text>
            <Text style={styles.quoteText} numberOfLines={1}>
              {msg.replyTo.text}
            </Text>
          </View>
        ) : null}
        {msg.kind === 'voice' && msg.audioUri ? (
          <AudioVoiceBubble
            uri={msg.audioUri}
            durationMs={msg.durationMs}
            tint={textDark ? Romance.ink : '#FFFFFF'}
          />
        ) : msg.kind === 'voice' ? (
          <VoiceBubble text={msg.text} color={color} characterId={characterId} />
        ) : msg.kind === 'image' && msg.imageUri ? (
          <View>
            <Image source={{ uri: msg.imageUri }} style={styles.comicImage} contentFit="cover" />
            {msg.text ? <Text style={styles.comicCaption}>{msg.text}</Text> : null}
          </View>
        ) : (
          <Text style={[styles.bubbleText, !textDark && { color: '#FFFFFF' }]}>{msg.text}</Text>
        )}
      </Pressable>
      {!mine ? meta : null}
    </View>
  );
}

export function ChatThread({
  messages,
  color,
  name,
  typing,
  typingLabel,
  onSend,
  onSendImage,
  onSendVoice,
  onRecall,
  onDelete,
  banner,
  cta,
  inputDisabled,
  placeholder,
  characterId,
  variant = 'default',
}: {
  messages: ChatMessage[];
  color: string;
  name: string;
  typing?: boolean;
  typingLabel?: string;
  onSend: (text: string, replyTo?: ReplyRef) => void;
  /** 相册选图发送（不传则隐藏图片按钮） */
  onSendImage?: (uri: string) => void;
  /** 录音发送（不传则隐藏麦克风按钮） */
  onSendVoice?: (uri: string, durationMs: number) => void;
  /** 撤回（不传则长按菜单不出现撤回项） */
  onRecall?: (msg: ChatMessage) => void;
  /** 删除（本地移除） */
  onDelete?: (msg: ChatMessage) => void;
  banner?: ReactNode;
  cta?: ReactNode;
  inputDisabled?: boolean;
  placeholder?: string;
  /** 有立绘时头像显示立绘（D-019） */
  characterId?: string;
  /** 'line'：羁绊会话的 LINE 拟真样式（D-027） */
  variant?: ChatVariant;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [viewingShot, setViewingShot] = useState<ViewerShot | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartAt = useRef(0);

  const data = [...messages].reverse();
  const line = variant === 'line';

  useEffect(
    () => () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    },
    []
  );

  // LINE「已读」：我的消息之后 TA 说过话，就算已读
  let lastHimAt = -1;
  messages.forEach((m, i) => {
    if (m.from === 'him') lastHimAt = i;
  });
  const readIds = new Set(
    messages.filter((m, i) => m.from === 'me' && i < lastHimAt).map((m) => m.id)
  );

  const send = () => {
    const text = draft.trim();
    if (!text || inputDisabled) return;
    setDraft('');
    const ref = replyTo ?? undefined;
    setReplyTo(null);
    setEmojiOpen(false);
    onSend(text, ref);
  };

  /** 长按菜单：引用 / 撤回（自己的、24h 内）/ 删除（LINE 规则） */
  const openActions = (msg: ChatMessage) => {
    const excerpt =
      msg.kind === 'image' ? t('[照片]') : msg.kind === 'voice' ? t('[语音]') : msg.text.slice(0, 24);
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (msg.kind === 'text' && msg.text) {
      buttons.push({
        text: t('引用'),
        onPress: () => setReplyTo({ from: msg.from, text: msg.text }),
      });
    }
    if (onRecall && msg.from === 'me' && Date.now() - msg.at <= RECALL_WINDOW_MS) {
      buttons.push({ text: t('撤回'), onPress: () => onRecall(msg) });
    }
    if (onDelete) {
      buttons.push({
        text: t('删除'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('删除这条消息？'), t('只从你的手机上删除，不会留下痕迹。'), [
            { text: t('取消'), style: 'cancel' },
            { text: t('删除'), style: 'destructive', onPress: () => onDelete(msg) },
          ]),
      });
    }
    if (!buttons.length) return;
    buttons.push({ text: t('取消'), style: 'cancel' });
    Alert.alert(excerpt, undefined, buttons);
  };

  const pickImage = async () => {
    if (!onSendImage || inputDisabled) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onSendImage(result.assets[0].uri);
    }
  };

  const toggleRecord = async () => {
    if (!onSendVoice || inputDisabled) return;
    if (!recording) {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('需要麦克风权限'), t('在系统设置里允许录音后再试。'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordStartAt.current = Date.now();
      setRecordSecs(0);
      setRecording(true);
      recordTimer.current = setInterval(
        () => setRecordSecs(Math.floor((Date.now() - recordStartAt.current) / 1000)),
        500
      );
    } else {
      if (recordTimer.current) clearInterval(recordTimer.current);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecording(false);
      const ms = Date.now() - recordStartAt.current;
      const uri = recorder.uri;
      if (uri && ms >= 600) onSendVoice(uri, ms);
    }
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
          <Bubble
            msg={item}
            color={color}
            name={name}
            characterId={characterId}
            variant={variant}
            read={readIds.has(item.id)}
            onLongPress={openActions}
            onOpenPhoto={setViewingShot}
          />
        )}
        style={line ? { backgroundColor: LINE.bg } : undefined}
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
              <View
                style={[
                  styles.bubble,
                  line && styles.bubbleLine,
                  { backgroundColor: line ? LINE.him : Romance.bubbleHim },
                ]}>
                <Text style={styles.typingText}>{typingLabel ?? t('正在输入…')}</Text>
              </View>
            </View>
          ) : null
        }
        keyboardDismissMode="interactive"
      />
      <PhotoViewer shot={viewingShot} onClose={() => setViewingShot(null)} />
      {cta}

      {/* 引用预览条 */}
      {replyTo ? (
        <View style={[styles.replyBar, line && styles.replyBarLine]}>
          <View style={styles.replyBody}>
            <Text style={styles.replyName}>{t('回复')} {replyTo.from === 'me' ? t('自己') : name}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyTo.text}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <MingCute name="close" size={18} color={Romance.faint} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          line && styles.inputBarLine,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}>
        {onSendImage ? (
          <Pressable onPress={pickImage} hitSlop={6} disabled={inputDisabled}>
            <MingCute name="pic" size={24} color={line ? '#8E97A3' : Romance.sub} />
          </Pressable>
        ) : null}
        {onSendVoice ? (
          <Pressable onPress={toggleRecord} hitSlop={6} disabled={inputDisabled}>
            <MingCute name="mic" size={24} color={recording ? '#E0433C' : line ? '#8E97A3' : Romance.sub} />
          </Pressable>
        ) : null}
        {recording ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {t('录音中')} 0:{recordSecs.toString().padStart(2, '0')} · {t('再点一下发送')}
            </Text>
          </View>
        ) : (
          <TextInput
            style={[styles.input, line && styles.inputLine, inputDisabled && { opacity: 0.5 }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder ?? t('说点什么…')}
            placeholderTextColor={Romance.faint}
            editable={!inputDisabled}
            onSubmitEditing={send}
            returnKeyType="send"
            submitBehavior="submit"
          />
        )}
        <Pressable onPress={() => setEmojiOpen((v) => !v)} hitSlop={6} disabled={inputDisabled}>
          <MingCute
            name="emoji"
            size={24}
            color={emojiOpen ? (line ? LINE.brand : Romance.accent) : line ? '#8E97A3' : Romance.sub}
          />
        </Pressable>
        <Pressable onPress={send} hitSlop={8} disabled={inputDisabled}>
          <IconSymbol
            name="arrow.up.circle.fill"
            size={34}
            color={
              draft.trim() && !inputDisabled ? (line ? LINE.brand : Romance.accent) : Romance.faint
            }
          />
        </Pressable>
      </View>

      {/* 表情快捷面板 */}
      {emojiOpen ? (
        <View style={[styles.emojiPanel, line && styles.inputBarLine, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => setDraft((d) => d + e)} style={styles.emojiCell}>
              <Text style={styles.emojiChar}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
    bannerWrap: { marginBottom: 10 },
    msgRow: { flexDirection: 'row', marginVertical: 5, alignItems: 'flex-end' },
    msgRowHim: { justifyContent: 'flex-start' },
    msgRowMe: { justifyContent: 'flex-end' },
    msgAvatar: { marginRight: 8 },
    bubble: {
      maxWidth: '74%',
      borderRadius: 22,
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
    polaroidRow: { alignItems: 'center', marginVertical: 12 },
    systemTextLine: { backgroundColor: 'rgba(20,30,50,0.35)', color: '#FFFFFF' },
    recalledText: { fontSize: 12, color: Romance.faint },
    recalledTextLine: { color: 'rgba(255,255,255,0.85)' },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: 'rgba(0,0,0,0.18)',
      backgroundColor: 'rgba(0,0,0,0.06)',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 6,
    },
    quoteName: { fontSize: 11, fontWeight: '700', color: 'rgba(0,0,0,0.55)' },
    quoteText: { fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 1 },
    metaCol: { justifyContent: 'flex-end', paddingBottom: 2 },
    metaColMe: { alignItems: 'flex-end', marginRight: 6 },
    metaColHim: { alignItems: 'flex-start', marginLeft: 6 },
    metaText: { fontSize: 10, color: 'rgba(255,255,255,0.95)', lineHeight: 13 },
    bubbleLine: { borderRadius: 18, shadowOpacity: 0.08 },
    inputBarLine: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E9F0' },
    inputLine: { backgroundColor: '#F1F3F6' },
    systemText: {
      fontSize: 12,
      color: Romance.sub,
      backgroundColor: Romance.line,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      overflow: 'hidden',
    },
    comicImage: { width: 220, height: 220, borderRadius: 16, backgroundColor: Romance.line },
    comicCaption: { fontSize: 13, color: Romance.sub, marginTop: 8, lineHeight: 19 },
    voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
    voiceBar: { width: 3, borderRadius: 2, opacity: 0.75 },
    voiceDuration: { fontSize: 13, marginLeft: 6, fontWeight: '500' },
    voiceHint: { fontSize: 11, color: Romance.faint, marginTop: 4 },
    voiceTranscript: { fontSize: 14, color: Romance.sub, marginTop: 6, lineHeight: 20 },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: Romance.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Romance.line,
    },
    replyBarLine: { backgroundColor: '#F7F9FC', borderTopColor: '#E5E9F0' },
    replyBody: { flex: 1 },
    replyName: { fontSize: 11, fontWeight: '700', color: Romance.accent },
    replyText: { fontSize: 12, color: Romance.sub, marginTop: 1 },
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
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 16,
      fontSize: 16,
      color: Romance.ink,
    },
    recordingPill: {
      flex: 1,
      height: 40,
      borderRadius: 24,
      backgroundColor: '#FDEBEA',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0433C' },
    recordingText: { fontSize: 13, color: '#C43A34', fontWeight: '600' },
    emojiPanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 10,
      paddingTop: 6,
      backgroundColor: Romance.bg,
    },
    emojiCell: { width: '12.5%', alignItems: 'center', paddingVertical: 8 },
    emojiChar: { fontSize: 26 },
  })
);

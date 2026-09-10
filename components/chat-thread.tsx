/**
 * 共用聊天线程（D-100 纸面）：试聊、羁绊会话、外出场景都用它。
 * 纸面规格：聊天流底 accentSoft + 120px 涂鸦壁纸（components/paper-bg）；TA 的气泡白 r6/6/6/2、我的气泡 primary 白字 r6/6/2/6，
 * 内距 9×13、最大宽 72%、正文 15/22；时间戳 Fredoka 11 muted（我的消息之后 TA 说过话即「已读」）；
 * 系统条 ink 底白字 12 r6，tone='hint' 的系统消息是白底 accent 字；输入栏白底 1.5px 上沿：+ / mic / paper 色输入框 38 高 / 相册（有字时换成发送）。
 *
 * 消息能力（D-030 / D-073 / D-081 / D-091）：
 * - 文本 / 图片（相册选图）/ 语音（录音发送、点按播放）/「+」面板（调用方给项目——外出邀请 / 查手机 / 红包 / 位置）
 * - 卡片消息（kind 'card'）：怎么画由 core/cards 的注册表决定
 * - 引用：长按 → 引用，气泡上方带被引摘要；撤回：长按自己的消息（24h 内）→ 双方可见占位；删除：仅本地移除
 */

import {
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
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

import { CardShell } from '@/components/card-bubble';
import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { ChatWallpaper } from '@/components/paper-bg';
import { PhotoViewer, Polaroid, type ViewerShot } from '@/components/polaroid';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { Shape, Space } from '@/constants/design';
import { cardKinds } from '@/core/cards';
import { Fonts, Romance, themed } from '@/constants/theme';
import { clockTime, voiceDuration } from '@/lib/format';
import { t } from '@/lib/i18n';
import { ASR_MAX_SECONDS, ASR_RECORDING } from '@/lib/media';
import { synthesizeVoice, ttsReady } from '@/lib/tts';
import type { ChatMessage } from '@/lib/types';
import { findCharacter } from '@/store/app-store';

export type ReplyRef = { from: ChatMessage['from']; text: string };
/** 「+」面板的一项（D-081）：调用方决定有哪些 */
export type ChatExtra = {
  key: string;
  label: string;
  icon: ComponentProps<typeof IconSymbol>['name'];
  onPress: () => void;
};

/** 撤回时限（24 小时内可撤回） */
export const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 卡片气泡（D-081）：怎么画由卡片种类注册表决定（core/cards，各玩法注册；D-086）；没注册的画一张只有标题的通用卡 */
function CardBody({ msg, dark }: { msg: ChatMessage; dark: boolean }) {
  const card = msg.card!;
  const kind = cardKinds.get(card.type);
  return <>{kind?.render?.(card, dark) ?? <CardShell kicker="" title={card.title} subtitle={card.subtitle} dark={dark} />}</>;
}

/**
 * TA 的语音（D-048 / D-074）：点按走 TTS 真实发声（按句缓存）；
 * 没配 key 或合成失败时回落占位形态（点开看文字）。
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
              : canSpeak && status === 'loading'
                ? t('TA 在开嗓…')
                : t('看文字')}
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
  read,
  onLongPress,
  onOpenPhoto,
  onAvatarPress,
}: {
  msg: ChatMessage;
  color: string;
  name: string;
  characterId?: string;
  /** 点 TA 的头像（D-110：打开资料页） */
  onAvatarPress?: () => void;
  /** 我的消息是否显示「已读」（TA 回过话即视为已读） */
  read?: boolean;
  onLongPress?: (msg: ChatMessage) => void;
  /** 拍立得点开看大图（D-056） */
  onOpenPhoto?: (shot: ViewerShot) => void;
}) {
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
        <Text style={msg.tone === 'hint' ? styles.hintText : styles.systemText}>{msg.text}</Text>
      </View>
    );
  }
  const mine = msg.from === 'me';
  // 撤回占位：居中小字，无内容
  if (msg.recalled) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.recalledText}>
          {mine ? t('你撤回了一条消息') : t('{name} 撤回了一条消息', { name })}
        </Text>
      </View>
    );
  }
  const meta = (
    <View style={[styles.metaCol, mine ? styles.metaColMe : styles.metaColHim]}>
      {mine && read ? <Text style={styles.metaText}>{t('已读')}</Text> : null}
      <Text style={styles.metaText}>{clockTime(msg.at)}</Text>
    </View>
  );
  const textDark = !mine;
  const tint = textDark ? Romance.ink : '#FFFFFF';
  const bubbleTint = msg.kind === 'card' && msg.card ? cardKinds.get(msg.card.type)?.bubbleColor : undefined;
  return (
    <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowHim]}>
      {!mine && (
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} hitSlop={6}>
          <CharAvatar name={name} color={color} size={Space.avatar.bubble} characterId={characterId} />
        </Pressable>
      )}
      {mine ? meta : null}
      <Pressable
        onLongPress={onLongPress ? () => onLongPress(msg) : undefined}
        delayLongPress={350}
        style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleHim, bubbleTint ? { backgroundColor: bubbleTint } : null]}>
        {msg.replyTo ? (
          <View style={[styles.quote, !textDark && styles.quoteLight]}>
            <Text style={[styles.quoteName, !textDark && styles.quoteTextLight]}>
              {msg.replyTo.from === 'me' ? t('你') : name}
            </Text>
            <Text style={[styles.quoteText, !textDark && styles.quoteTextLight]} numberOfLines={1}>
              {msg.replyTo.text}
            </Text>
          </View>
        ) : null}
        {msg.kind === 'voice' && msg.audioUri ? (
          <View>
            <AudioVoiceBubble uri={msg.audioUri} durationMs={msg.durationMs} tint={tint} />
            {/* 她的语音识别结果（D-073）：小字回显；识别中 / 没听清给提示 */}
            {msg.mediaStatus === 'pending' ? (
              <Text style={[styles.mediaHint, !textDark && styles.mediaHintLight]}>{t('识别中…')}</Text>
            ) : msg.mediaStatus === 'failed' ? (
              <Text style={[styles.mediaHint, !textDark && styles.mediaHintLight]}>{t('没听清')}</Text>
            ) : msg.transcript ? (
              <Text style={[styles.mediaTranscript, !textDark && styles.mediaHintLight]}>
                {msg.transcript}
              </Text>
            ) : null}
          </View>
        ) : msg.kind === 'voice' ? (
          <VoiceBubble text={msg.text} color={color} characterId={characterId} />
        ) : msg.kind === 'image' && msg.imageUri ? (
          <View>
            <Image source={{ uri: msg.imageUri }} style={styles.photo} contentFit="cover" />
            {msg.text ? <Text style={[styles.photoCaption, !textDark && styles.mediaHintLight]}>{msg.text}</Text> : null}
            {/* 她的照片（D-073）：TA 看图中 / 没看清给提示；描述本身不上屏 */}
            {msg.mediaStatus === 'pending' ? (
              <Text style={[styles.mediaHint, !textDark && styles.mediaHintLight]}>{t('TA 在看…')}</Text>
            ) : msg.mediaStatus === 'failed' ? (
              <Text style={[styles.mediaHint, !textDark && styles.mediaHintLight]}>{t('TA 没看清这张')}</Text>
            ) : null}
          </View>
        ) : msg.kind === 'card' && msg.card ? (
          <CardBody msg={msg} dark={textDark} />
        ) : (
          <Text style={[styles.bubbleText, !textDark && styles.bubbleTextMe]}>{msg.text}</Text>
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
  extras,
  onAvatarPress,
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
  /** 聊天流最顶端（最早消息之前）的一块内容 */
  banner?: ReactNode;
  /** 输入栏上方的一块内容（试聊的 offer 卡、外出的拍照按钮） */
  cta?: ReactNode;
  inputDisabled?: boolean;
  placeholder?: string;
  /** 有立绘时头像显示立绘（D-019） */
  characterId?: string;
  /** 「+」面板的项目（D-081）；不传则没有「+」 */
  extras?: ChatExtra[];
  /** 点 TA 的头像（D-110：资料页） */
  onAvatarPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [viewingShot, setViewingShot] = useState<ViewerShot | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  // 录音格式按百度 ASR 要求：16k 单声道 wav（D-073）
  const recorder = useAudioRecorder(ASR_RECORDING);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartAt = useRef(0);

  const data = [...messages].reverse();

  useEffect(
    () => () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    },
    []
  );

  // 「已读」：我的消息之后 TA 说过话，就算已读
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
    setExtrasOpen(false);
    onSend(text, ref);
  };

  /** 长按菜单：引用 / 撤回（自己的、24h 内）/ 删除 */
  const openActions = (msg: ChatMessage) => {
    const excerpt =
      msg.kind === 'image'
        ? t('[照片]')
        : msg.kind === 'voice'
          ? t('[语音]')
          : msg.kind === 'card'
            ? (msg.card?.title ?? '')
            : msg.text.slice(0, 24);
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

  /** 停止录音并发送（用户再点一下，或到 ASR 时长上限自动停） */
  const stopRecord = async () => {
    if (!recordTimer.current) return; // 已停过（自动停与手点可能同时到）
    clearInterval(recordTimer.current);
    recordTimer.current = null;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setRecording(false);
    const ms = Date.now() - recordStartAt.current;
    const uri = recorder.uri;
    if (uri && ms >= 600) onSendVoice?.(uri, ms);
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
      recordTimer.current = setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartAt.current) / 1000);
        setRecordSecs(secs);
        // 百度 ASR 最长 60 秒：到点自动停止并发送（D-073）
        if (secs >= ASR_MAX_SECONDS) void stopRecord();
      }, 500);
    } else {
      await stopRecord();
    }
  };

  const hasDraft = draft.trim().length > 0 && !inputDisabled;
  const iconColor = inputDisabled ? Romance.faint : Romance.ink;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.listWrap}>
        <ChatWallpaper />
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
              read={readIds.has(item.id)}
              onLongPress={openActions}
              onOpenPhoto={setViewingShot}
              onAvatarPress={onAvatarPress}
            />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={banner ? <View style={styles.bannerWrap}>{banner}</View> : null}
          ListHeaderComponent={
            typing ? (
              <View style={[styles.msgRow, styles.msgRowHim]}>
                <CharAvatar name={name} color={color} size={Space.avatar.bubble} characterId={characterId} />
                <View style={[styles.bubble, styles.bubbleHim]}>
                  <Text style={styles.typingText}>{typingLabel ?? t('正在输入…')}</Text>
                </View>
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
        />
      </View>
      <PhotoViewer shot={viewingShot} onClose={() => setViewingShot(null)} />
      {cta}

      {/* 引用预览条 */}
      {replyTo ? (
        <View style={styles.replyBar}>
          <View style={styles.replyBody}>
            <Text style={styles.replyName}>{t('回复')} {replyTo.from === 'me' ? t('自己') : name}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyTo.text}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <MingCute name="close" size={18} color={Romance.sub} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {recording ? (
          <>
            {/* 录音中（D-091）：整行让给录音条——「+」与相册先收起来；麦克风变 accent、右侧发送键都是「停止并发送」 */}
            <Pressable onPress={() => void stopRecord()} hitSlop={6}>
              <MingCute name="mic" size={Space.iconBar} color={Romance.accentStrong} />
            </Pressable>
            <View style={styles.recordingPill}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>0:{recordSecs.toString().padStart(2, '0')}</Text>
              <Text style={styles.recordingText} numberOfLines={1} ellipsizeMode="tail">
                {t('再点一下发送')}
              </Text>
            </View>
            <Pressable onPress={() => void stopRecord()} hitSlop={8} style={styles.sendBtn}>
              <IconSymbol name="arrow.up" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : (
          <>
            {extras?.length ? (
              <Pressable onPress={() => setExtrasOpen((v) => !v)} hitSlop={6} disabled={inputDisabled}>
                <MingCute name={extrasOpen ? 'close' : 'plus'} size={Space.iconBar} color={extrasOpen ? Romance.accent : iconColor} />
              </Pressable>
            ) : null}
            {onSendVoice ? (
              <Pressable onPress={toggleRecord} hitSlop={6} disabled={inputDisabled}>
                <MingCute name="mic" size={Space.iconBar} color={iconColor} />
              </Pressable>
            ) : null}
            <TextInput
              style={[styles.input, inputDisabled && styles.inputDisabled]}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder ?? t('说点什么…')}
              placeholderTextColor={Romance.sub}
              editable={!inputDisabled}
              onSubmitEditing={send}
              returnKeyType="send"
              submitBehavior="submit"
            />
            {hasDraft ? (
              <Pressable onPress={send} hitSlop={8} style={styles.sendBtn}>
                <IconSymbol name="arrow.up" size={18} color="#FFFFFF" />
              </Pressable>
            ) : onSendImage ? (
              <Pressable onPress={pickImage} hitSlop={6} disabled={inputDisabled}>
                <MingCute name="pic" size={Space.iconBar} color={iconColor} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {/* 「+」面板（D-081） */}
      {extrasOpen && extras?.length ? (
        <View style={[styles.extrasPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {extras.map((x) => (
            <Pressable
              key={x.key}
              style={styles.extraTile}
              onPress={() => {
                setExtrasOpen(false);
                x.onPress();
              }}>
              <View style={styles.extraIcon}>
                <IconSymbol name={x.icon} size={26} color={Romance.ink} />
              </View>
              <Text style={styles.extraLabel} numberOfLines={1}>
                {x.label}
              </Text>
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
    listWrap: { flex: 1, backgroundColor: Romance.accentSoft },
    list: { backgroundColor: 'transparent' },
    listContent: { paddingHorizontal: Space.screen, paddingTop: 12, paddingBottom: 8 },
    bannerWrap: { marginBottom: 10 },
    msgRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end', gap: Space.inline },
    msgRowHim: { justifyContent: 'flex-start' },
    msgRowMe: { justifyContent: 'flex-end' },
    // 设计系统气泡（D-084 / D-100）：r6 / 尾角 2、内距 9×13、最大宽 72%、无描边无阴影
    bubble: {
      maxWidth: Space.bubbleMaxWidth,
      borderRadius: Shape.radius,
      paddingHorizontal: Space.bubbleX,
      paddingVertical: Space.bubbleY,
    },
    bubbleHim: { backgroundColor: Romance.bubbleHim, borderBottomLeftRadius: Shape.radiusTail },
    bubbleMe: { backgroundColor: Romance.bubbleMe, borderBottomRightRadius: Shape.radiusTail },
    bubbleText: { fontSize: 15, lineHeight: 22, color: Romance.ink },
    bubbleTextMe: { color: '#FFFFFF' },
    typingText: { fontSize: 14, color: Romance.sub },
    systemRow: { alignItems: 'center', marginVertical: 8 },
    polaroidRow: { alignItems: 'center', marginVertical: 12 },
    // 系统条：ink 底白字 r6；hint：白底 accent 字
    systemText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#FFFFFF',
      backgroundColor: Romance.ink,
      paddingHorizontal: 12,
      paddingVertical: 3,
      borderRadius: Shape.radius,
      overflow: 'hidden',
      textAlign: 'center',
    },
    hintText: {
      fontSize: 12,
      color: Romance.accentStrong,
      backgroundColor: Romance.card,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Shape.radius,
      overflow: 'hidden',
      textAlign: 'center',
    },
    recalledText: { fontSize: 12, color: Romance.sub },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: Romance.line,
      backgroundColor: Romance.accentSoft,
      borderRadius: Shape.radiusInner,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 6,
    },
    quoteLight: { borderLeftColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.18)' },
    quoteName: { fontSize: 11, fontWeight: '600', color: Romance.sub },
    quoteText: { fontSize: 12, color: Romance.sub, marginTop: 1 },
    quoteTextLight: { color: 'rgba(255,255,255,0.85)' },
    metaCol: { justifyContent: 'flex-end', paddingBottom: 2 },
    metaColMe: { alignItems: 'flex-end' },
    metaColHim: { alignItems: 'flex-start' },
    metaText: { fontFamily: Fonts.label, fontSize: 11, color: Romance.sub, lineHeight: 14 },
    photo: { width: 220, height: 220, borderRadius: Shape.radiusInner, backgroundColor: Romance.line },
    photoCaption: { fontSize: 13, color: Romance.sub, marginTop: 8, lineHeight: 19 },
    voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
    voiceBar: { width: 3, borderRadius: 2, opacity: 0.75 },
    voiceDuration: { fontFamily: Fonts.label, fontSize: 13, marginLeft: 6 },
    voiceHint: { fontSize: 11, color: Romance.sub, marginTop: 4 },
    voiceTranscript: { fontSize: 14, color: Romance.sub, marginTop: 6, lineHeight: 20 },
    mediaHint: { fontSize: 11, color: Romance.sub, marginTop: 4 },
    mediaHintLight: { color: 'rgba(255,255,255,0.82)' },
    mediaTranscript: { fontSize: 13, color: Romance.sub, marginTop: 5, lineHeight: 18 },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Space.screen,
      paddingVertical: 8,
      backgroundColor: Romance.bg,
      borderTopWidth: 1,
      borderTopColor: Romance.line,
    },
    replyBody: { flex: 1 },
    replyName: { fontSize: 11, fontWeight: '600', color: Romance.accent },
    replyText: { fontSize: 12, color: Romance.sub, marginTop: 1 },
    // 输入栏：白底、一条 1.5px 上沿
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.inlineLoose,
      paddingHorizontal: Space.screen,
      paddingTop: 10,
      backgroundColor: Romance.card,
      borderTopWidth: Shape.stroke,
      borderTopColor: Romance.stroke,
    },
    input: {
      flex: 1,
      height: Space.inputHeight,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      paddingHorizontal: 14,
      fontSize: 14,
      color: Romance.ink,
    },
    inputDisabled: { opacity: 0.5 },
    sendBtn: {
      width: Space.inputHeight,
      height: Space.inputHeight,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 录音条（D-091）：占满输入栏中段；计时用 Fredoka，提示语放不下就尾部省略，绝不撑破
    recordingPill: {
      flex: 1,
      minWidth: 0,
      height: Space.inputHeight,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      overflow: 'hidden',
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Romance.accentStrong },
    recordingTime: { fontFamily: Fonts.labelBold, fontSize: 14, color: Romance.accentStrong },
    recordingText: { fontSize: 13, color: Romance.accentStrong, flexShrink: 1 },
    extrasPanel: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Space.screen,
      paddingTop: 12,
      backgroundColor: Romance.card,
    },
    extraTile: { width: '25%', alignItems: 'center', paddingVertical: 8 },
    extraIcon: {
      width: 58,
      height: 58,
      borderRadius: Shape.radius,
      backgroundColor: Romance.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    extraLabel: { fontSize: 11, color: Romance.sub, marginTop: 6 },
  })
);

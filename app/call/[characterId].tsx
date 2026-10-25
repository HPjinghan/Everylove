/**
 * 通话页（D-077；D-100 纸面）：全屏，像真的在打电话。深底是设计稿指定的唯一 palette 外常量；
 * 头像 132 r6、侧键 72 r6 白 12%、挂断 80 r6 accent 底（不再用红）图标转 135°；时长数字 Fredoka。
 * 流程：拨号 → TA 接起先开口（引擎通话模式 + 合成播放）→ 自动开始听她说（音量计断句）→ 识别 → TA 回 → 播放 → 再听……
 * 她的话与 TA 的话都进羁绊会话（viaCall）；挂断记「📞 m:ss」并触发记忆提取。
 * 免提 = 播放走扬声器（iOS 类别 .playback）；听筒 = 录音类别 .playAndRecord，iOS 默认从听筒出声。
 * 切换（D-091）：TA 正在说话就立刻重设音频类别（播放中切类别会当场改出声口），否则下一句开口时生效；
 * 用 ref 记当前选择，免得 speak 闭包拿到旧值。
 * 按分钟计（D-210）：接通后每 10 秒扣一次她的语音时长（features/call-meter）；剩不到一分钟 TA 自己收尾，用完了 TA 说完这句就挂。
 * 实时（D-232，有原生模块的包）：本机边听边认（她说的字当场出在字幕里，停顿 0.75 秒算说完）→ TA 回（不思考）→ 边合成边播；
 * TA 说话时也在听，她插话（字面上不是 TA 那句的回声）或点 TA 的头像就打断。识别这门语言不行时这通电话退回管线式。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { showAlert } from '@/components/action-sheet';
import { CharAvatar } from '@/components/char-avatar';
import { alertNoVoice } from '@/components/voice-gate';
import { MingCute } from '@/components/mingcute';
import { Shape, Type } from '@/constants/design';
import { Fonts, Romance, themed, withAlpha } from '@/constants/theme';
import { VAD, callPickupLine, callReply, formatCallDuration, isBargeIn, LIVE, logCall, speakableText, takeSentences, utteranceDone } from '@/lib/call';
import { callSecondsLeft, chargeCall, endCallMeter, startCallMeter } from '@/features/call-meter';
import { describeAiError } from '@/lib/chat';
import { getLang, t } from '@/lib/i18n';
import { createEar, createMouth, liveVoiceReady, requestLivePermissions, setLiveRoute, type LiveEar, type LiveMouth, type SayResult, type Utterance } from '@/lib/live-voice';
import { ASR_RECORDING, transcribeVoice } from '@/lib/media';
import { synthesizeVoice } from '@/lib/tts';
import { findCharacter, useAppStore } from '@/store/app-store';
import { audioSession } from '@/lib/audio-session';

type Phase = 'dialing' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'ended';

const RECORDING = { ...ASR_RECORDING, isMeteringEnabled: true };
/** 通话时长每隔多久扣一次 */
const CHARGE_EVERY_MS = 10_000;

/** 设计稿指定的通话深底（D-100）：全 App 唯一允许的 palette 外常量 */
const CALL_BG = '#1C1A1E';

export default function CallScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bond = useAppStore((s) => s.bonds.find((b) => b.characterId === characterId));
  const character = characterId ? findCharacter(characterId) : undefined;

  const [phase, setPhase] = useState<Phase>('dialing');
  const [speaker, setSpeaker] = useState(true);
  const speakerRef = useRef(true);
  const [himLine, setHimLine] = useState('');
  const [herLine, setHerLine] = useState('');
  const [note, setNote] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const recorder = useAudioRecorder(RECORDING);
  const rec = useAudioRecorderState(recorder, 150);
  const player = useAudioPlayer(null);
  const ps = useAudioPlayerStatus(player);

  const alive = useRef(true);
  const connectedAt = useRef(0);
  /** 扣到哪一刻了 / 时长用完了（TA 说完这句就挂） */
  const chargedAt = useRef(0);
  const outOfTime = useRef(false);
  const speechStarted = useRef(false);
  // 渲染只读 state：这两个是 connectedAt / speechStarted 的镜像，写 ref 的地方同步写它们（管线逻辑仍看 ref）
  const [connected, setConnected] = useState(false);
  const [heard, setHeard] = useState(false);
  const lastLoudAt = useRef(0);
  const turnBusy = useRef(false);
  /** 实时通道（D-232）：开着就用耳朵 + 嘴，识别不行时这通电话退回管线式 */
  const [liveMode, setLiveMode] = useState(() => liveVoiceReady());
  const liveOn = useRef(liveMode);
  const live = useRef<{ ear: LiveEar; mouth: LiveMouth } | null>(null);
  const heardText = useRef('');
  const lastTextAt = useRef(0);
  /** TA 正在说的这句（滤回声用） */
  const saying = useRef('');
  /** 正在说的那段；被打断后旧回合的字不再往里送 */
  const activeUtt = useRef<Utterance | null>(null);
  const phaseRef = useRef<Phase>('dialing');
  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    if (alive.current) setPhase(p);
  };

  /** 把上次扣到现在的时长扣掉；返回还剩几秒 */
  const charge = useCallback(() => {
    if (!bond || !chargedAt.current) return callSecondsLeft();
    const now = Date.now();
    const left = chargeCall(bond.characterId, (now - chargedAt.current) / 1000);
    chargedAt.current = now;
    if (left <= 0) outOfTime.current = true;
    return left;
  }, [bond]);

  /* ── 计时 + 分段扣时长 ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (!connectedAt.current) return;
      setElapsed(Date.now() - connectedAt.current);
      if (chargedAt.current && Date.now() - chargedAt.current >= CHARGE_EVERY_MS) charge();
    }, 1000);
    return () => clearInterval(id);
  }, [charge]);

  /* ── 开始听她说 ── */
  const listen = useCallback(async () => {
    if (!alive.current) return;
    await audioSession.record();
    await recorder.prepareToRecordAsync();
    recorder.record();
    speechStarted.current = false;
    setHeard(false);
    lastLoudAt.current = Date.now();
    setNote('');
    setPhaseSafe('listening');
  }, [recorder]);

  /* ── 播放 TA 的话（合成失败就只显示字幕，停 2.5 秒再听） ── */
  const speak = useCallback(
    async (text: string) => {
      if (!alive.current || !character) return;
      setHimLine(text);
      setPhaseSafe('speaking');
      const uri = await synthesizeVoice(text, character, 'included');
      if (!alive.current) return;
      if (!uri) {
        setNote(t('语音没接通，TA 的话在字幕里'));
        await new Promise((r) => setTimeout(r, 2500));
        if (alive.current) void listen();
        return;
      }
      await audioSession.call(speakerRef.current);
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character, listen]
  );

  /* ── 实时：开始听她说（每次都是新的一段识别） ── */
  const listenLive = useCallback(async () => {
    const l = live.current;
    if (!alive.current || !l) return;
    await l.ear.stop();
    if (!alive.current) return;
    heardText.current = '';
    lastTextAt.current = Date.now();
    lastLoudAt.current = Date.now();
    setHeard(false);
    setNote('');
    setPhaseSafe('listening');
    await l.ear.start(speakerRef.current);
  }, []);

  /* ── 实时：TA 开口了——字幕跟上，同时听着她插不插话 ── */
  const enterSpeaking = useCallback(async (text: string) => {
    const l = live.current;
    setHimLine(text);
    saying.current = text;
    if (!l || phaseRef.current === 'speaking') return;
    heardText.current = '';
    setPhaseSafe('speaking');
    await l.ear.stop();
    await l.ear.start(speakerRef.current);
  }, []);

  /* ── 实时：TA 这段说完了（被打断的由 stopTA 接着听，这里不管） ── */
  const afterSpeech = useCallback(
    async (r: SayResult) => {
      saying.current = '';
      if (!alive.current || r === 'stopped') return;
      if (r === 'failed') {
        setNote(t('语音没接通，TA 的话在字幕里'));
        await new Promise((res) => setTimeout(res, 2500));
        if (!alive.current) return;
      }
      if (outOfTime.current) hangUp();
      else void listenLive();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listenLive]
  );

  /* ── 实时：TA 说一整句（接起电话那句） ── */
  const speakLive = useCallback(
    async (text: string) => {
      const l = live.current;
      if (!alive.current || !l) return;
      const u = l.mouth.begin();
      activeUtt.current = u;
      await enterSpeaking(text);
      u.push(text);
      u.end();
      await afterSpeech(await u.result);
    },
    [enterSpeaking, afterSpeech]
  );

  /* ── 实时：她说完了 → TA 边想边说（模型每吐出一整句就送去合成，D-232） ── */
  const endTurnLive = useCallback(async () => {
    const l = live.current;
    const text = heardText.current.trim();
    if (turnBusy.current || phaseRef.current !== 'listening' || !l || !bond || !text) return;
    turnBusy.current = true;
    setPhaseSafe('thinking');
    setHerLine(text);
    const u = l.mouth.begin();
    activeUtt.current = u;
    let raw = '';
    let spoken = 0;
    const onPartial = (soFar: string) => {
      if (activeUtt.current !== u) return;
      raw = soFar;
      const say = speakableText(soFar);
      const { sentences, next } = takeSentences(say, spoken);
      spoken = next;
      sentences.forEach((x) => u.push(x));
      if (u.pushed) void enterSpeaking(say.trim());
    };
    try {
      await l.ear.stop();
      const reply = await callReply(bond.id, text, onPartial);
      if (activeUtt.current !== u) return;
      turnBusy.current = false;
      const tail = speakableText(raw).slice(spoken).trim();
      if (tail) u.push(tail);
      if (!u.pushed) u.push(reply);
      u.end();
      await enterSpeaking(reply);
      await afterSpeech(await u.result);
    } catch (e) {
      if (activeUtt.current !== u) return;
      turnBusy.current = false;
      activeUtt.current = null;
      l.mouth.stop();
      setNote(__DEV__ ? `${t('TA 这条没回上')} · ${describeAiError(e)}` : t('TA 这条没回上'));
      if (alive.current) void listenLive();
    }
  }, [bond, listenLive, enterSpeaking, afterSpeech]);

  /** 实时：打断 TA（她插话 / 点头像）——掐掉这段，当场接着听 */
  const stopTA = useCallback(() => {
    const l = live.current;
    if (!l || (phaseRef.current !== 'speaking' && phaseRef.current !== 'thinking')) return;
    activeUtt.current = null;
    turnBusy.current = false;
    saying.current = '';
    l.mouth.stop();
    void listenLive();
  }, [listenLive]);

  /* ── 她说完了：停录 → 识别 → TA 回 → 播放 ── */
  const endTurn = useCallback(async () => {
    if (liveOn.current) return endTurnLive();
    if (turnBusy.current || phaseRef.current !== 'listening' || !character || !bond) return;
    turnBusy.current = true;
    setPhaseSafe('thinking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !speechStarted.current) {
        turnBusy.current = false;
        void listen();
        return;
      }
      let text: string;
      try {
        text = await transcribeVoice(uri, 'included');
      } catch {
        setNote(t('没听清，再说一遍？'));
        turnBusy.current = false;
        void listen();
        return;
      }
      if (!alive.current) return;
      setHerLine(text);
      const reply = await callReply(bond.id, text);
      turnBusy.current = false;
      await speak(reply);
    } catch (e) {
      turnBusy.current = false;
      // 原因只在开发构建露出（文案纪律 #6）
      setNote(__DEV__ ? `${t('TA 这条没回上')} · ${describeAiError(e)}` : t('TA 这条没回上'));
      if (alive.current) void listen();
    }
  }, [bond, character, listen, recorder, speak, endTurnLive]);

  /* ── 实时断句：字不再变、也没声音满 0.75 秒 ── */
  useEffect(() => {
    if (!liveMode || phase !== 'listening') return;
    const id = setInterval(() => {
      if (utteranceDone({ text: heardText.current, lastTextAt: lastTextAt.current, lastLoudAt: lastLoudAt.current, now: Date.now() })) void endTurnLive();
    }, 100);
    return () => clearInterval(id);
  }, [liveMode, phase, endTurnLive]);

  /* ── 音量计断句 ── */
  useEffect(() => {
    if (liveMode || phase !== 'listening' || !rec.isRecording) return;
    const now = Date.now();
    const db = rec.metering ?? -160;
    if (db > VAD.speechDb) {
      speechStarted.current = true;
      // 镜像写在 effect 之后的微任务里（规则不许 effect 体内同步 setState）；ref 仍当场置位，断句逻辑不受影响
      queueMicrotask(() => setHeard(true));
      lastLoudAt.current = now;
    }
    if (speechStarted.current && now - lastLoudAt.current > VAD.hangMs) void endTurn();
    else if (speechStarted.current && rec.durationMillis > VAD.maxTurnMs) void endTurn();
    else if (!speechStarted.current && rec.durationMillis > VAD.idleRestartMs) {
      // 一直没开口：重开录音，免得文件无限长
      void (async () => {
        await recorder.stop();
        if (alive.current && phaseRef.current === 'listening') void listen();
      })();
    }
  }, [rec.metering, rec.durationMillis, rec.isRecording, phase, endTurn, listen, recorder, liveMode]);

  /* ── TA 说完 → 听她；时长用完了就挂 ── */
  useEffect(() => {
    if (liveMode || phase !== 'speaking' || !ps.didJustFinish) return;
    if (outOfTime.current) hangUp();
    else void listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ps.didJustFinish, phase, listen, liveMode]);

  /* ── 拨号 → 接起 ── */
  useEffect(() => {
    alive.current = true;
    if (!character || !bond) return;
    let cancelled = false;
    (async () => {
      // 没有通话时长就不拨（D-210）
      if (callSecondsLeft() <= 0) {
        router.back();
        alertNoVoice();
        return;
      }
      const granted = liveOn.current ? await requestLivePermissions() : (await AudioModule.requestRecordingPermissionsAsync()).granted;
      if (!granted) {
        showAlert(t('需要麦克风权限'), t('在系统设置里允许录音后再试。'));
        router.back();
        return;
      }
      if (liveOn.current) startLive();
      await new Promise((r) => setTimeout(r, 1600));
      if (cancelled) return;
      setPhaseSafe('connecting');
      try {
        await startCallMeter();
        const line = await callPickupLine(bond.id);
        if (cancelled) return;
        connectedAt.current = Date.now();
        chargedAt.current = connectedAt.current;
        setConnected(true);
        await (liveOn.current ? speakLive(line) : speak(line));
      } catch (e) {
        if (cancelled) return;
        showAlert(t('没打通'), __DEV__ ? describeAiError(e) : undefined);
        router.back();
      }
    })();
    return () => {
      cancelled = true;
      alive.current = false;
      // 划走也算挂断：剩下的时长扣掉
      if (bond && chargedAt.current) chargeCall(bond.characterId, (Date.now() - chargedAt.current) / 1000);
      chargedAt.current = 0;
      endCallMeter();
      try {
        player.pause();
      } catch {}
      void recorder.stop().catch(() => {});
      live.current?.mouth.dispose();
      live.current?.ear.dispose();
      live.current = null;
      void audioSession.playback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  /** 免提 / 听筒（D-091）：TA 正在说话时立刻重设音频类别，不然要等下一句 */
  const toggleSpeaker = () => {
    const next = !speakerRef.current;
    speakerRef.current = next;
    setSpeaker(next);
    if (liveOn.current) setLiveRoute(next);
    else if (phaseRef.current === 'speaking') {
      void audioSession.call(next);
    }
  };

  /** 实时通道接上耳朵和嘴（D-232）；识别出了这门语言不行之类的错，这通电话退回管线式 */
  function startLive() {
    if (!character || !bond) return;
    setLiveRoute(speakerRef.current);
    const mouth = createMouth(character, 'included');
    const ear = createEar(getLang(), [bond.name, character.name], {
      text(tr) {
        if (phaseRef.current === 'speaking') {
          // 她插话了：TA 停下，这一段重新听
          if (isBargeIn(tr, saying.current, getLang())) stopTA();
          return;
        }
        if (phaseRef.current !== 'listening' || tr === heardText.current) return;
        heardText.current = tr;
        lastTextAt.current = Date.now();
        setHerLine(tr);
      },
      level(v) {
        if (phaseRef.current !== 'listening' || v <= LIVE.loud) return;
        lastLoudAt.current = Date.now();
        setHeard(true);
      },
      error(code) {
        if (!alive.current) return;
        if (code === 'not-allowed') {
          showAlert(t('需要麦克风权限'), t('在系统设置里允许录音后再试。'));
          hangUp();
          return;
        }
        if (code === 'language-not-supported' || code === 'service-not-allowed') {
          // 这台手机认不了这门语言：这通电话退回管线式
          liveOn.current = false;
          setLiveMode(false);
          mouth.stop();
          ear.dispose();
          mouth.dispose();
          live.current = null;
          if (phaseRef.current === 'listening' || phaseRef.current === 'speaking') void listen();
          return;
        }
        setNote(t('没听清，再说一遍？'));
      },
      ended() {
        // 识别自己停了（到时长上限 / 出错之后）：听着的时候接着听，已经有字就当她说完了
        if (!alive.current || phaseRef.current !== 'listening') return;
        if (heardText.current.trim()) void endTurnLive();
        else void listenLive();
      },
    });
    live.current = { ear, mouth };
  }

  /** 点 TA 的头像 = 打断 TA（实时通道） */
  const interrupt = () => {
    if (liveOn.current && phaseRef.current === 'speaking') stopTA();
  };

  function hangUp() {
    if (!bond || phaseRef.current === 'ended') return;
    charge();
    chargedAt.current = 0;
    endCallMeter();
    setPhaseSafe('ended');
    if (connectedAt.current) {
      logCall(bond.id, Date.now() - connectedAt.current);
    }
    // 「通话结束」停一下再走（D-197），别像被挂断
    setTimeout(() => router.back(), 1200);
  }

  if (!bond || !character) return <Redirect href="/apps/phone" />;

  const statusText =
    phase === 'dialing'
      ? t('拨号中…')
      : phase === 'connecting'
        ? t('TA 接起来了')
        : phase === 'speaking'
          ? t('TA 在说…')
          : phase === 'listening'
            ? t('TA 在听')
            : phase === 'thinking'
              ? t('TA 在想…')
              : t('通话结束');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.top}>
        <Pressable onPress={interrupt} disabled={!liveMode || phase !== 'speaking'} accessibilityRole="button" accessibilityLabel={bond.name}>
          <CharAvatar name={bond.name} color={character.color} size={132} characterId={character.id} />
        </Pressable>
        <Text style={styles.name}>{bond.name}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.status}>{statusText}</Text>
          {connected ? (
            <>
              <Text style={styles.status}> · </Text>
              <Text style={styles.statusTime}>{formatCallDuration(elapsed)}</Text>
            </>
          ) : null}
        </View>
        {phase === 'thinking' || phase === 'connecting' ? (
          <ActivityIndicator color="#FFFFFF" style={styles.spinner} />
        ) : null}
      </View>

      <View style={styles.captions}>
        {himLine ? <Text style={styles.himLine}>{himLine}</Text> : null}
        {herLine ? <Text style={styles.herLine}>{herLine}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {phase === 'listening' ? (
          <View style={styles.meter}>
            <View style={[styles.meterDot, heard && styles.meterDotOn]} />
            <Text style={styles.meterText}>{heard ? t('听到了') : t('说话吧')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable style={[styles.sideBtn, speaker && styles.sideBtnOn]} onPress={toggleSpeaker} accessibilityState={{ selected: speaker }}>
          {/* 开关只有一个名字：亮 = 免提开着，暗 = 听筒 */}
          <Text style={[styles.sideBtnText, speaker && styles.sideBtnTextOn]}>{t('免提')}</Text>
        </Pressable>
        <Pressable style={styles.hangBtn} onPress={hangUp}>
          <View style={styles.hangIcon}>
            <MingCute name="phoneSimple" size={30} color="#FFFFFF" />
          </View>
        </Pressable>
        <Pressable
          style={[styles.sideBtn, phase !== 'listening' && styles.sideBtnDisabled]}
          disabled={phase !== 'listening'}
          onPress={() => {
            speechStarted.current = true;
            setHeard(true);
            void endTurn();
          }}>
          <Text style={styles.sideBtnText}>{t('说完了')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: CALL_BG, paddingHorizontal: 24, justifyContent: 'space-between' },
    top: { alignItems: 'center', gap: 10, marginTop: 24 },
    name: { fontSize: Type.scale.h1.size, fontWeight: '600', color: '#FFFFFF', marginTop: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'baseline' },
    status: { fontSize: Type.scale.sub.size, color: withAlpha('#FFFFFF', 0.65) },
    statusTime: { fontFamily: Fonts.label, fontSize: Type.scale.sub.size, color: withAlpha('#FFFFFF', 0.65) },
    spinner: { marginTop: 8 },
    captions: { flex: 1, justifyContent: 'flex-end', gap: 10, paddingVertical: 24 },
    himLine: { fontSize: Type.scale.screenTitle.size, lineHeight: 26, color: '#FFFFFF' },
    herLine: { fontSize: Type.scale.sub.size, lineHeight: 20, color: withAlpha('#FFFFFF', 0.55) },
    note: { fontSize: Type.scale.caption.size, color: Romance.accent },
    meter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    meterDot: { width: 10, height: 10, borderRadius: Shape.radiusInner, backgroundColor: withAlpha('#FFFFFF', 0.25) },
    meterDotOn: { backgroundColor: Romance.accent },
    meterText: { fontSize: Type.scale.caption.size, color: withAlpha('#FFFFFF', 0.5) },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    // 侧键：72 r6 白 12%；挂断：80 r6 accent 底，只转图标不转方块
    sideBtn: {
      width: 72,
      height: 72,
      borderRadius: Shape.radius,
      backgroundColor: withAlpha('#FFFFFF', 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideBtnDisabled: { opacity: 0.35 },
    sideBtnText: { color: '#FFFFFF', fontSize: Type.scale.label.size },
    // 免提开着：像系统通话页一样反白
    sideBtnOn: { backgroundColor: '#FFFFFF' },
    sideBtnTextOn: { color: CALL_BG, fontWeight: '600' },
    hangBtn: {
      width: 80,
      height: 80,
      borderRadius: Shape.radius,
      backgroundColor: Romance.accentStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hangIcon: { transform: [{ rotate: '135deg' }] },
  })
);

/**
 * 通话页（D-077）：全屏，像真的在打电话。
 * 流程：拨号 → TA 接起先开口（引擎通话模式 + 合成播放）→ 自动开始听她说（音量计断句）→ 识别 → TA 回 → 播放 → 再听……
 * 她的话与 TA 的话都进羁绊会话（viaCall）；挂断记「📞 m:ss」并触发记忆提取。
 * 免提 = 播放走扬声器（allowsRecording:false）；听筒 = 保持录音会话，iOS 会从听筒出声。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { CharAvatar } from '@/components/char-avatar';
import { MingCute } from '@/components/mingcute';
import { Romance, themed } from '@/constants/theme';
import { VAD, callPickupLine, callReply, formatCallDuration, logCall } from '@/lib/call';
import { describeAiError } from '@/lib/engine';
import { t } from '@/lib/i18n';
import { ASR_RECORDING, transcribeVoice } from '@/lib/media';
import { updateBondMemory } from '@/lib/memory';
import { synthesizeVoice } from '@/lib/tts';
import { findCharacter, useAppStore } from '@/store/app-store';

type Phase = 'dialing' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'ended';

const RECORDING = { ...ASR_RECORDING, isMeteringEnabled: true };

export default function CallScreen() {
  const { characterId } = useLocalSearchParams<{ characterId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bond = useAppStore((s) => s.bonds.find((b) => b.characterId === characterId));
  const character = characterId ? findCharacter(characterId) : undefined;

  const [phase, setPhase] = useState<Phase>('dialing');
  const [speaker, setSpeaker] = useState(true);
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
  const speechStarted = useRef(false);
  const lastLoudAt = useRef(0);
  const turnBusy = useRef(false);
  const phaseRef = useRef<Phase>('dialing');
  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    if (alive.current) setPhase(p);
  };

  /* ── 计时 ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (connectedAt.current) setElapsed(Date.now() - connectedAt.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── 播放 TA 的话（合成失败就只显示字幕，停 2.5 秒再听） ── */
  const speak = useCallback(
    async (text: string) => {
      if (!alive.current || !character) return;
      setHimLine(text);
      setPhaseSafe('speaking');
      const uri = await synthesizeVoice(text, character);
      if (!alive.current) return;
      if (!uri) {
        setNote(t('语音没接通，TA 的话在字幕里'));
        await new Promise((r) => setTimeout(r, 2500));
        if (alive.current) void listen();
        return;
      }
      await setAudioModeAsync({ allowsRecording: !speaker, playsInSilentMode: true });
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [character, speaker]
  );

  /* ── 开始听她说 ── */
  const listen = useCallback(async () => {
    if (!alive.current) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    speechStarted.current = false;
    lastLoudAt.current = Date.now();
    setNote('');
    setPhaseSafe('listening');
  }, [recorder]);

  /* ── 她说完了：停录 → 识别 → TA 回 → 播放 ── */
  const endTurn = useCallback(async () => {
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
        text = await transcribeVoice(uri);
      } catch {
        setNote(t('没听清，再说一遍？'));
        turnBusy.current = false;
        void listen();
        return;
      }
      if (!alive.current) return;
      setHerLine(text);
      const reply = await callReply(character, bond.id, text);
      turnBusy.current = false;
      await speak(reply);
    } catch (e) {
      turnBusy.current = false;
      setNote(t('模型没接上：{reason}', { reason: describeAiError(e) }));
      if (alive.current) void listen();
    }
  }, [bond, character, listen, recorder, speak]);

  /* ── 音量计断句 ── */
  useEffect(() => {
    if (phase !== 'listening' || !rec.isRecording) return;
    const now = Date.now();
    const db = rec.metering ?? -160;
    if (db > VAD.speechDb) {
      speechStarted.current = true;
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
  }, [rec.metering, rec.durationMillis, rec.isRecording, phase, endTurn, listen, recorder]);

  /* ── TA 说完 → 听她 ── */
  useEffect(() => {
    if (phase === 'speaking' && ps.didJustFinish) void listen();
  }, [ps.didJustFinish, phase, listen]);

  /* ── 拨号 → 接起 ── */
  useEffect(() => {
    alive.current = true;
    if (!character || !bond) return;
    let cancelled = false;
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('需要麦克风权限'), t('在系统设置里允许录音后再试。'));
        router.back();
        return;
      }
      await new Promise((r) => setTimeout(r, 1600));
      if (cancelled) return;
      setPhaseSafe('connecting');
      try {
        const line = await callPickupLine(character, bond.id);
        if (cancelled) return;
        connectedAt.current = Date.now();
        await speak(line);
      } catch (e) {
        if (cancelled) return;
        Alert.alert(t('没打通'), describeAiError(e));
        router.back();
      }
    })();
    return () => {
      cancelled = true;
      alive.current = false;
      try {
        player.pause();
      } catch {}
      void recorder.stop().catch(() => {});
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const hangUp = () => {
    if (!bond) return;
    setPhaseSafe('ended');
    if (connectedAt.current) {
      logCall(bond.id, Date.now() - connectedAt.current);
      void updateBondMemory(bond.id);
    }
    router.back();
  };

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
        <CharAvatar name={bond.name} color={character.color} size={132} characterId={character.id} />
        <Text style={styles.name}>{bond.name}</Text>
        <Text style={styles.status}>
          {statusText}
          {connectedAt.current ? ` · ${formatCallDuration(elapsed)}` : ''}
        </Text>
        {phase === 'thinking' || phase === 'connecting' ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} />
        ) : null}
      </View>

      <View style={styles.captions}>
        {himLine ? <Text style={styles.himLine}>{himLine}</Text> : null}
        {herLine ? <Text style={styles.herLine}>{herLine}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {phase === 'listening' ? (
          <View style={styles.meter}>
            <View style={[styles.meterDot, speechStarted.current && styles.meterDotOn]} />
            <Text style={styles.meterText}>
              {speechStarted.current ? t('听到了，停一下就发出去') : t('说话吧')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.sideBtn} onPress={() => setSpeaker((v) => !v)}>
          <Text style={[styles.sideBtnText, speaker && styles.sideBtnTextOn]}>{speaker ? t('免提') : t('听筒')}</Text>
        </Pressable>
        <Pressable style={styles.hangBtn} onPress={hangUp}>
          <MingCute name="phone" size={30} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.sideBtn, phase !== 'listening' && styles.sideBtnDisabled]}
          disabled={phase !== 'listening'}
          onPress={() => {
            speechStarted.current = true;
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
    screen: { flex: 1, backgroundColor: '#1C1A1E', paddingHorizontal: 24, justifyContent: 'space-between' },
    top: { alignItems: 'center', gap: 10, marginTop: 24 },
    name: { fontSize: 26, fontWeight: '600', color: '#FFFFFF', marginTop: 8 },
    status: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },
    captions: { flex: 1, justifyContent: 'flex-end', gap: 10, paddingVertical: 24 },
    himLine: { fontSize: 17, lineHeight: 26, color: '#FFFFFF' },
    herLine: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.55)' },
    note: { fontSize: 12, color: Romance.accent },
    meter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    meterDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)' },
    meterDotOn: { backgroundColor: '#3EB489' },
    meterText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
    sideBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideBtnDisabled: { opacity: 0.35 },
    sideBtnText: { color: '#FFFFFF', fontSize: 13 },
    sideBtnTextOn: { fontWeight: '700' },
    hangBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#E5484D',
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '135deg' }],
    },
  })
);

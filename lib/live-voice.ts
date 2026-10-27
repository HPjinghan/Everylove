/**
 * 实时通话的耳朵与嘴（D-232）：
 *   耳朵 = iOS 本机语音识别：边说边出字，她一停顿就有整句，不再录整段上传识别；
 *   嘴   = ElevenLabs 的 PCM 流（代理 eleven.tts.stream / 本地 key 直连，D-241）边到边播，不等整段合成完。
 * 两条通道，按包里有什么原生模块选：
 * - 通话通道（D-238，modules/live-call）：一台引擎开着系统通话处理（回声消除），识别与播放都在里面——
 *   TA 说话时也一直在听，她开口就能打断（liveDuplex() 为真）；
 * - 老包（0.3.0 的第一批）：识别用 expo-speech-recognition、播放用 react-native-audio-api，两台引擎同时跑会互相触发重启，
 *   所以半双工（D-237）：TA 说话时不听，她说话时播放器挂起，音频会话只归识别模块管。
 * Expo Go / 网页 / 更老的包 liveVoiceReady() 为假，通话页走管线式（lib/call VAD）。
 */

import { NativeModule, requireOptionalNativeModule } from 'expo';
import { fetch as streamingFetch } from 'expo/fetch';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { ExpoSpeechRecognitionModule as SpeechModuleValue, ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import type { AudioBufferQueueSourceNode, AudioContext } from 'react-native-audio-api';

import { CONFIG } from '@/core/config';
import { estimateSpeechSeconds, generationBlocked, reportUsage, type Billing } from '@/core/usage';
import { getLang, type Lang } from '@/lib/i18n';
import { proxyStream } from '@/lib/proxy';
import { ELEVEN_TTS_URL, elevenBody, elevenConfigured, voiceFor } from '@/lib/tts';
import type { Character } from '@/lib/types';

type SpeechModule = typeof SpeechModuleValue;
type AudioApi = typeof import('react-native-audio-api');

type ChannelEvents = {
  onText(e: { text: string; final: boolean }): void;
  onLevel(e: { value: number }): void;
  onError(e: { code: string; message: string }): void;
  onEnd(): void;
  onPlayed(e: { generation: number }): void;
};

/** modules/live-call 的 JS 面（D-238） */
declare class CallChannel extends NativeModule<ChannelEvents> {
  open(speaker: boolean): Promise<void>;
  listen(options: { locale: string; hints: string[] }): Promise<void>;
  stopListening(): Promise<void>;
  close(): Promise<void>;
  enqueue(pcmBase64: string): number;
  stopPlayback(): number;
  setSpeaker(on: boolean): void;
}

/** PCM 采样率：与代理 eleven.tts.stream 一致（24 kHz 16 bit 单声道） */
const RATE = 24000;
/** 攒够这么多再开播（秒）：网络抖一下也不断音 */
const PREROLL_SEC = 0.25;
/** 每块缓冲至少这么长（秒）：块太碎事件太多 */
const CHUNK_SEC = 0.1;
const LOCALE: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };

function channel(): CallChannel | null {
  if (Platform.OS !== 'ios') return null;
  return requireOptionalNativeModule<CallChannel>('LiveCall');
}

/** 这个包有通话通道：全双工、能说话打断 TA */
export function liveDuplex(): boolean {
  return Boolean(channel());
}

/** 这个包能实时通话（通话通道，或老包的两个原生模块） */
export function liveVoiceReady(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (channel()) return true;
  return Boolean(requireOptionalNativeModule('ExpoSpeechRecognition')) && Boolean(TurboModuleRegistry.get('AudioAPIModule'));
}

// 原生模块用到时才加载：Expo Go 里没有它们，顶层 import 会在启动时就崩
let speechMod: SpeechModule | null = null;
function speech(): SpeechModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speechMod ??= (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: SpeechModule }).ExpoSpeechRecognitionModule;
  return speechMod;
}
let audioMod: AudioApi | null = null;
function audioApi(): AudioApi {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  audioMod ??= require('react-native-audio-api') as AudioApi;
  return audioMod;
}

/** 麦克风 + 语音识别两项权限 */
export async function requestLivePermissions(): Promise<boolean> {
  try {
    return (await speech().requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** 接通：开音频通道（通话通道开引擎；老包只切会话类别）。开不了就抛错，调用方退回管线式 */
export async function openLive(speaker: boolean): Promise<void> {
  const ch = channel();
  if (ch) await ch.open(speaker);
  else setLiveRoute(speaker);
}

/** 挂断：关通话通道，把音频会话还回去 */
export async function closeLive(): Promise<void> {
  try {
    await channel()?.close();
  } catch {}
}

/** 免提 / 听筒；通话中切换立即生效 */
export function setLiveRoute(speaker: boolean): void {
  try {
    const ch = channel();
    if (ch) {
      ch.setSpeaker(speaker);
      return;
    }
    speech().setCategoryIOS(liveCategory(speaker));
    speech().setAudioSessionActiveIOS(true);
  } catch (e) {
    console.warn('[live-voice] 切音频会话失败：', e);
  }
}

function liveCategory(speaker: boolean): NonNullable<ExpoSpeechRecognitionOptions['iosCategory']> {
  return { category: 'playAndRecord', categoryOptions: speaker ? ['defaultToSpeaker', 'allowBluetooth'] : ['allowBluetooth'], mode: 'default' };
}

/* ── 耳朵 ── */

export interface EarEvents {
  /** 这一段到现在听到的全部字（部分结果，会被后面的修正） */
  text(transcript: string): void;
  /** 音量 -2～10，0 以下算没声 */
  level(value: number): void;
  /** 识别出错（权限 / 这门语言不支持 / 网络）；no-speech 与主动停不算 */
  error(code: string, message: string): void;
  /** 识别自己停了（不是我们叫停的）：调用方决定要不要重开 */
  ended(): void;
}

export interface LiveEar {
  start(speaker: boolean): Promise<void>;
  /** 停下并等它真的停了（再 start 不会撞上「忙」） */
  stop(): Promise<void>;
  dispose(): void;
}

export function createEar(lang: Lang, hints: string[], on: EarEvents): LiveEar {
  const ch = channel();
  return ch ? channelEar(ch, lang, hints, on) : speechEar(lang, hints, on);
}

/** 通话通道的耳朵：引擎一直开着，每段话一个识别任务 */
function channelEar(ch: CallChannel, lang: Lang, hints: string[], on: EarEvents): LiveEar {
  let running = false;
  let failed = false;
  const subs = [
    ch.addListener('onText', (e) => running && on.text(e.text)),
    ch.addListener('onLevel', (e) => running && on.level(e.value)),
    ch.addListener('onError', (e) => {
      if (!running) return;
      failed = true;
      on.error(e.code, e.message);
    }),
    ch.addListener('onEnd', () => {
      if (!running) return;
      running = false;
      // 出错收的尾：缓一秒再交给调用方重开，免得一直出错时原地空转
      if (failed) setTimeout(() => !running && on.ended(), 1000);
      else on.ended();
    }),
  ];
  return {
    async start() {
      if (running) return;
      running = true;
      failed = false;
      await ch.listen({ locale: LOCALE[lang], hints: hints.filter(Boolean) });
    },
    async stop() {
      if (!running) return;
      running = false;
      await ch.stopListening();
    },
    dispose() {
      subs.forEach((x) => x.remove());
      if (running) void ch.stopListening();
      running = false;
    },
  };
}

const onDeviceLocales = new Map<string, boolean>();

async function onDevice(locale: string): Promise<boolean> {
  const hit = onDeviceLocales.get(locale);
  if (hit !== undefined) return hit;
  let ok = false;
  try {
    const s = speech();
    if (s.supportsOnDeviceRecognition()) {
      const { installedLocales } = await s.getSupportedLocales({});
      ok = installedLocales.includes(locale);
    }
  } catch {}
  onDeviceLocales.set(locale, ok);
  return ok;
}

/** 老包的耳朵：expo-speech-recognition，每次 start 自己开一台引擎 */
function speechEar(lang: Lang, hints: string[], on: EarEvents): LiveEar {
  const s = speech();
  const locale = LOCALE[lang];
  let running = false;
  let stopping = false;
  let waiters: (() => void)[] = [];
  const subs = [
    s.addListener('result', (e) => on.text(e.results[0]?.transcript ?? '')),
    s.addListener('volumechange', (e) => on.level(e.value)),
    s.addListener('error', (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      on.error(e.error, e.message);
    }),
    s.addListener('end', () => {
      running = false;
      const wasStopping = stopping;
      stopping = false;
      const w = waiters;
      waiters = [];
      w.forEach((fn) => fn());
      if (!wasStopping) on.ended();
    }),
  ];
  return {
    async start(speaker) {
      if (running) return;
      running = true;
      const options: ExpoSpeechRecognitionOptions = {
        lang: locale,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        requiresOnDeviceRecognition: await onDevice(locale),
        contextualStrings: hints.filter(Boolean).slice(0, 20),
        // 与 setLiveRoute 同一套；免提时出扬声器
        iosCategory: liveCategory(speaker),
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      };
      s.start(options);
    },
    stop() {
      if (!running) return Promise.resolve();
      stopping = true;
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
        s.abort();
        // 万一 end 没来：最多等 800 ms
        setTimeout(() => {
          if (!waiters.includes(resolve)) return;
          waiters = waiters.filter((w) => w !== resolve);
          running = false;
          stopping = false;
          resolve();
        }, 800);
      });
    },
    dispose() {
      subs.forEach((x) => x.remove());
      if (running) s.abort();
    },
  };
}

/* ── 嘴 ── */

export type SayResult = 'done' | 'stopped' | 'failed';

/** 一段话：句子一句一句推进来（模型边出字边推），每句一进来就开始合成，按顺序接着播 */
export interface Utterance {
  push(sentence: string): void;
  /** 不会再有新句子了 */
  end(): void;
  /** 放完 / 被打断 / 一点声音都没出来时给 */
  result: Promise<SayResult>;
  /** 已经推进来过句子 */
  readonly pushed: boolean;
}

export interface LiveMouth {
  /** 开始一段话（会先停掉上一段） */
  begin(): Utterance;
  /** 说一整句：begin + push + end */
  say(text: string): Promise<SayResult>;
  /** 打断：掐掉合成、停播 */
  stop(): void;
  dispose(): void;
}

async function pcmReader(text: string, voiceId: string, billing: Billing, signal: AbortSignal): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  if (!voiceId) throw new Error('ElevenLabs TTS: no voice');
  if (elevenConfigured()) {
    const res = await streamingFetch(`${ELEVEN_TTS_URL}/${voiceId}/stream?output_format=pcm_${RATE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': CONFIG.eleven.apiKey },
      body: JSON.stringify(elevenBody(text)),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`ElevenLabs TTS ${res.status}`);
    return res.body.getReader();
  }
  return (await proxyStream('eleven.tts.stream', { text, voice_id: voiceId, language: getLang() }, { billing, signal })).reader;
}

/** 16 bit 小端 PCM → [-1, 1) 浮点 */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const n = Math.floor(bytes.length / 2);
  const out = new Float32Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** 放 PCM 的那一头：通话通道，或老包的 audio-api 缓冲队列 */
interface PcmSink {
  /** 开一段新的话：之前排着的作废；每播完一块调一次 onPlayed */
  open(onPlayed: () => void): void;
  /** 排一块 16 bit PCM（偶数字节） */
  play(pcm: Uint8Array): void;
  /** 攒够了，开播；开不了给 false */
  start(): boolean;
  /** 掐掉正在放的 */
  cut(): void;
  /** 这段话完了 */
  idle(): void;
  dispose(): void;
}

/** 通话通道：块一排进去就放，所以开播前先攒在这里 */
function channelSink(ch: CallChannel): PcmSink {
  let gen = -1;
  let held: Uint8Array[] | null = null;
  let onPlayed: (() => void) | null = null;
  const sub = ch.addListener('onPlayed', (e) => {
    if (e.generation === gen) onPlayed?.();
  });
  return {
    open(cb) {
      gen = ch.stopPlayback();
      held = [];
      onPlayed = cb;
    },
    play(pcm) {
      if (held) held.push(pcm);
      else ch.enqueue(toBase64(pcm));
    },
    start() {
      const h = held ?? [];
      held = null;
      h.forEach((pcm) => ch.enqueue(toBase64(pcm)));
      return true;
    },
    cut() {
      onPlayed = null;
      held = null;
      gen = ch.stopPlayback();
    },
    idle() {
      onPlayed = null;
    },
    dispose() {
      sub.remove();
    },
  };
}

/** 老包：react-native-audio-api；没在说的时候挂起（引擎停掉，让识别独占，D-237） */
function audioApiSink(): PcmSink {
  const api = audioApi();
  let ctx: AudioContext | null = null;
  let src: AudioBufferQueueSourceNode | null = null;
  let active = false;
  // 挂起 / 恢复排成一条队，后发的说了算
  let power: Promise<void> = Promise.resolve();
  const setPlaying = (on: boolean) => {
    power = power
      .then(() => {
        if (!ctx) return;
        if (on) return ctx.resume();
        if (!active) return ctx.suspend();
      })
      .catch(() => {});
  };
  const cut = () => {
    if (!src) return;
    try {
      src.stop();
    } catch {}
    src.onBufferEnded = null;
    src = null;
  };
  return {
    open(onPlayed) {
      cut();
      if (!ctx) {
        // 会话交给识别模块：audio-api 自己再设类别 / 激活会触发对方重启引擎
        api.AudioManager.disableSessionManagement();
        ctx = new api.AudioContext({ sampleRate: RATE });
      }
      active = true;
      setPlaying(true);
      src = ctx.createBufferQueueSource();
      src.connect(ctx.destination);
      src.onBufferEnded = onPlayed;
    },
    play(pcm) {
      if (!ctx || !src) return;
      const data = pcm16ToFloat(pcm);
      const buf = ctx.createBuffer(1, data.length, RATE);
      buf.copyToChannel(data, 0);
      src.enqueueBuffer(buf);
    },
    start() {
      // offset 必须显式给 0：库的默认值是 -1，又被它自己的参数检查拒掉（抛错 = 一声不出）
      try {
        src?.start(0, 0);
        return true;
      } catch (e) {
        console.warn('[live-voice] 开播失败：', e);
        return false;
      }
    },
    cut,
    idle() {
      if (src) src.onBufferEnded = null;
      active = false;
      setPlaying(false);
    },
    dispose() {
      cut();
      active = false;
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}

export function createMouth(character: Character, billing: Billing): LiveMouth {
  const ch = channel();
  const sink = ch ? channelSink(ch) : audioApiSink();
  let current: { abort: AbortController; settle: (r: SayResult) => void } | null = null;

  const stopCurrent = () => {
    const c = current;
    if (!c) return;
    current = null;
    c.abort.abort();
    sink.cut();
    c.settle('stopped');
  };

  const begin = (): Utterance => {
    stopCurrent();
    const abort = new AbortController();
    let settled = false;
    let resolveResult: (r: SayResult) => void = () => {};
    const result = new Promise<SayResult>((resolve) => (resolveResult = resolve));
    const me = {
      abort,
      settle: (r: SayResult) => {
        if (settled) return;
        settled = true;
        if (current === me) current = null;
        sink.idle();
        resolveResult(r);
      },
    };
    current = me;
    const alive = () => current === me;

    // 每句一段：合成回来的字节先攒在段里，按顺序灌进同一个播放队列
    const segments: { chunks: Uint8Array[]; bytes: number; done: boolean }[] = [];
    let cursor = 0;
    let queued = 0;
    let queuedSamples = 0;
    let started = false;
    let ended = false;
    let anyAudio = false;

    const finishIfDone = () => {
      if (ended && cursor >= segments.length && queued <= 0) me.settle(anyAudio ? 'done' : 'failed');
    };
    sink.open(() => {
      if (!alive()) return;
      queued--;
      finishIfDone();
    });
    // 一段里的块拼起来交出去；16 bit 采样不能劈开，奇数字节留在段里等下一块
    const flush = (seg: (typeof segments)[number]) => {
      const all = new Uint8Array(seg.bytes);
      let off = 0;
      for (const c of seg.chunks) {
        all.set(c, off);
        off += c.length;
      }
      const even = all.length - (all.length % 2);
      seg.chunks = even < all.length ? [all.subarray(even)] : [];
      seg.bytes = all.length - even;
      if (!even) return;
      sink.play(all.subarray(0, even));
      queued++;
      queuedSamples += even / 2;
      anyAudio = true;
    };
    const pump = () => {
      if (!alive()) return;
      while (cursor < segments.length) {
        const seg = segments[cursor];
        if (seg.bytes >= RATE * CHUNK_SEC * 2 || (seg.done && seg.bytes > 1)) flush(seg);
        if (!seg.done) break;
        cursor++;
      }
      // 攒够一点再开播；整段都到了就直接播
      if (!started && (queuedSamples >= RATE * PREROLL_SEC || (ended && cursor >= segments.length && queuedSamples > 0))) {
        started = true;
        if (!sink.start()) {
          me.settle('failed');
          return;
        }
      }
      finishIfDone();
    };

    return {
      get pushed() {
        return segments.length > 0;
      },
      result,
      push(sentence) {
        const tex = sentence.trim();
        if (!alive() || ended || !tex) return;
        const seg = { chunks: [] as Uint8Array[], bytes: 0, done: false };
        segments.push(seg);
        if (generationBlocked('tts', billing)) {
          seg.done = true;
          pump();
          return;
        }
        void (async () => {
          try {
            const reader = await pcmReader(tex, voiceFor(character, 'eleven'), billing, abort.signal);
            for (;;) {
              const { done, value } = await reader.read();
              if (done || !alive()) break;
              if (value?.length) {
                seg.chunks.push(value);
                seg.bytes += value.length;
                pump();
              }
            }
            reportUsage({ kind: 'tts', provider: elevenConfigured() ? 'eleven' : 'proxy', chars: tex.length, seconds: estimateSpeechSeconds(tex), billing, estimated: true, metered: !elevenConfigured() });
          } catch (e) {
            if (alive()) console.warn('[live-voice] 流式合成失败：', e);
          }
          seg.done = true;
          pump();
        })();
      },
      end() {
        if (ended) return;
        ended = true;
        pump();
      },
    };
  };

  return {
    begin,
    say(text) {
      const u = begin();
      u.push(text);
      u.end();
      return u.result;
    },
    stop: stopCurrent,
    dispose() {
      stopCurrent();
      sink.dispose();
    },
  };
}

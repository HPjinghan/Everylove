/**
 * 实时通话的两件原生能力（D-232）：
 *   耳朵 = iOS 本机语音识别（expo-speech-recognition）：边说边出字，她一停顿就有整句，不再录整段上传识别；
 *   嘴   = Fish 的 PCM 流（代理 fish.tts.stream / 本地 key 直连）→ react-native-audio-api 的缓冲队列边到边播，不等整段合成完。
 * 两个原生模块只在 0.3.0 起的包里有；Expo Go / 网页 / 老包 liveVoiceReady() 为假，通话页照旧走管线式（lib/call VAD）。
 * 音频会话由这里统一定：playAndRecord，免提 = defaultToSpeaker、听筒 = 不带；识别与播放同一套，免得两边互相改。
 * 不开系统回声消除（voice processing 会把 TA 的声音也压小），回声靠 lib/call 的 novelSpeech 按字面滤掉。
 */

import { requireOptionalNativeModule } from 'expo';
import { fetch as streamingFetch } from 'expo/fetch';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { ExpoSpeechRecognitionModule as SpeechModuleValue, ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import type { AudioBufferQueueSourceNode, AudioContext } from 'react-native-audio-api';

import { CONFIG } from '@/core/config';
import { estimateSpeechSeconds, generationBlocked, reportUsage, type Billing } from '@/core/usage';
import type { Lang } from '@/lib/i18n';
import { proxyStream } from '@/lib/proxy';
import { fishConfigured, voiceFor } from '@/lib/tts';
import type { Character } from '@/lib/types';

type SpeechModule = typeof SpeechModuleValue;
type AudioApi = typeof import('react-native-audio-api');

const FISH_TTS_URL = 'https://api.fish.audio/v1/tts';
/** PCM 采样率：与代理 fish.tts.stream 一致（24 kHz 16 bit 单声道） */
const RATE = 24000;
/** 攒够这么多再开播（秒）：网络抖一下也不断音 */
const PREROLL_SEC = 0.25;
/** 每块缓冲至少这么长（秒）：块太碎事件太多 */
const CHUNK_SEC = 0.1;
const LOCALE: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' };

/* ── 临时诊断（TestFlight 实时通话没声音）：查清后整段删掉 ── */
export const liveDiag = { bytes: 0, enq: 0, ended: 0, started: 0, settle: '', err: '', noEarWhileSpeaking: false };
let diagCtx: AudioContext | null = null;

/** 一行诊断：引擎时钟走没走、收到多少、播了几块、会话类别与出声口 */
export async function liveDiagnostics(): Promise<string> {
  const parts: string[] = [];
  try {
    const c = diagCtx;
    parts.push(c ? `ctx=${c.state} t=${c.currentTime.toFixed(1)} sr=${c.sampleRate}` : 'ctx=none');
  } catch (e) {
    parts.push(`ctx!${String(e).slice(0, 40)}`);
  }
  parts.push(`kb=${Math.round(liveDiag.bytes / 1024)} enq=${liveDiag.enq} end=${liveDiag.ended} st=${liveDiag.started} r=${liveDiag.settle || '-'}`);
  try {
    const sess = speech().getAudioSessionCategoryAndOptionsIOS();
    parts.push(`sess=${sess.category}/${sess.mode}/${sess.categoryOptions.join('+')}`);
  } catch (e) {
    parts.push(`sess!${String(e).slice(0, 40)}`);
  }
  try {
    const info = await audioApi().AudioManager.getDevicesInfo();
    parts.push(`out=${info.currentOutputs.map((d) => `${d.category}:${d.name}`).join('+') || '-'}`);
  } catch (e) {
    parts.push(`out!${String(e).slice(0, 40)}`);
  }
  parts.push(`ear=${liveDiag.noEarWhileSpeaking ? 'off-while-speaking' : 'on'}`);
  if (liveDiag.err) parts.push(`err=${liveDiag.err}`);
  return parts.join('\n');
}

/** 这个包里有实时通话要的两个原生模块 */
export function liveVoiceReady(): boolean {
  if (Platform.OS !== 'ios') return false;
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

/** 通话的音频会话：免提 / 听筒；通话中切换立即生效 */
export function setLiveRoute(speaker: boolean): void {
  audioApi().AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'default',
    iosOptions: speaker ? ['defaultToSpeaker', 'allowBluetoothHFP'] : ['allowBluetoothHFP'],
  });
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

export function createEar(lang: Lang, hints: string[], on: EarEvents): LiveEar {
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
        // mode 与 setLiveRoute 一致；免提时出扬声器
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: speaker ? ['defaultToSpeaker', 'allowBluetooth'] : ['allowBluetooth'],
          mode: 'default',
        },
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
  const body = { text, reference_id: voiceId || undefined, latency: 'balanced' };
  if (fishConfigured()) {
    const res = await streamingFetch(FISH_TTS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${CONFIG.fish.apiKey}`, model: CONFIG.fish.model },
      body: JSON.stringify({ ...body, format: 'pcm', sample_rate: RATE }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Fish TTS ${res.status}`);
    return res.body.getReader();
  }
  return (await proxyStream('fish.tts.stream', body, { billing, signal })).reader;
}

/** 16 bit 小端 PCM → [-1, 1) 浮点；奇数字节留到下一块 */
export function pcm16ToFloat(bytes: Uint8Array, carry: number[]): Float32Array {
  const all = carry.length ? Uint8Array.from([...carry, ...bytes]) : bytes;
  const n = Math.floor(all.length / 2);
  carry.length = 0;
  if (all.length % 2) carry.push(all[all.length - 1]);
  const out = new Float32Array(n);
  const view = new DataView(all.buffer, all.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

export function createMouth(character: Character, billing: Billing): LiveMouth {
  const api = audioApi();
  let ctx: AudioContext | null = null;
  let current: { abort: AbortController; src: AudioBufferQueueSourceNode; settle: (r: SayResult) => void } | null = null;

  const context = (): AudioContext => {
    ctx ??= new api.AudioContext({ sampleRate: RATE });
    diagCtx = ctx;
    return ctx;
  };

  const stopCurrent = () => {
    const c = current;
    if (!c) return;
    current = null;
    c.abort.abort();
    try {
      c.src.stop();
    } catch {}
    c.src.onBufferEnded = null;
    c.settle('stopped');
  };

  const begin = (): Utterance => {
    stopCurrent();
    const ac = context();
    void ac.resume().catch((e) => (liveDiag.err = `resume ${String(e).slice(0, 60)}`));
    const abort = new AbortController();
    const src = ac.createBufferQueueSource();
    src.connect(ac.destination);
    let settled = false;
    let resolveResult: (r: SayResult) => void = () => {};
    const result = new Promise<SayResult>((resolve) => (resolveResult = resolve));
    const me = {
      abort,
      src,
      settle: (r: SayResult) => {
        if (settled) return;
        settled = true;
        if (current === me) current = null;
        src.onBufferEnded = null;
        liveDiag.settle = r;
        resolveResult(r);
      },
    };
    current = me;
    const alive = () => current === me;

    // 每句一段：合成回来的块先攒在段里，按顺序灌进同一个播放队列
    const segments: { chunks: Float32Array[]; done: boolean }[] = [];
    let cursor = 0;
    let queued = 0;
    let queuedSamples = 0;
    let started = false;
    let ended = false;
    let anyAudio = false;

    const finishIfDone = () => {
      if (ended && cursor >= segments.length && queued <= 0) me.settle(anyAudio ? 'done' : 'failed');
    };
    src.onBufferEnded = () => {
      liveDiag.ended++;
      queued--;
      finishIfDone();
    };
    const enqueue = (chunks: Float32Array[]) => {
      const len = chunks.reduce((n, c) => n + c.length, 0);
      if (!len) return;
      const data = new Float32Array(len);
      let off = 0;
      for (const c of chunks) {
        data.set(c, off);
        off += c.length;
      }
      const buf = ac.createBuffer(1, len, RATE);
      buf.copyToChannel(data, 0);
      src.enqueueBuffer(buf);
      liveDiag.enq++;
      queued++;
      queuedSamples += len;
      anyAudio = true;
    };
    const pump = () => {
      if (!alive()) return;
      while (cursor < segments.length) {
        const seg = segments[cursor];
        const len = seg.chunks.reduce((n, c) => n + c.length, 0);
        if (len >= RATE * CHUNK_SEC || (seg.done && len)) {
          enqueue(seg.chunks);
          seg.chunks = [];
        }
        if (!seg.done) break;
        cursor++;
      }
      // 攒够一点再开播；整段都到了就直接播
      if (!started && (queuedSamples >= RATE * PREROLL_SEC || (ended && cursor >= segments.length && queuedSamples > 0))) {
        started = true;
        liveDiag.started++;
        try {
          src.start();
        } catch (e) {
          liveDiag.err = `start ${String(e).slice(0, 60)}`;
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
        const seg = { chunks: [] as Float32Array[], done: false };
        segments.push(seg);
        if (generationBlocked('tts', billing)) {
          seg.done = true;
          pump();
          return;
        }
        void (async () => {
          try {
            const reader = await pcmReader(tex, voiceFor(character, 'fish'), billing, abort.signal);
            const carry: number[] = [];
            for (;;) {
              const { done, value } = await reader.read();
              if (done || !alive()) break;
              if (value?.length) {
                liveDiag.bytes += value.length;
                seg.chunks.push(pcm16ToFloat(value, carry));
                pump();
              }
            }
            reportUsage({ kind: 'tts', provider: fishConfigured() ? 'fish' : 'proxy', chars: tex.length, seconds: estimateSpeechSeconds(tex), billing, estimated: true, metered: !fishConfigured() });
          } catch (e) {
            liveDiag.err = `tts ${String(e).slice(0, 60)}`;
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
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}

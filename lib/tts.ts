/**
 * 语音合成（D-048；D-073 改百度接口；D-074 加多语种通道 + TA 偶尔发语音）。
 * 通道（synthesizeVoice 自动选）：
 *   1. OpenAI 兼容语音服务（EXPO_PUBLIC_SPEECH_*，/audio/speech，中/英/日全语种；与语音识别共用同一组配置）——配了就优先；
 *   2. 百度短文本语音合成 `tsn.baidu.com/text2audio`（与千帆同一把 bce-v3 key；只会中/英混读）：
 *      音色（per）按人称 他→4193 度泽言 / 她→4194 度嫣然 / TA→4115 度小贤，EXPO_PUBLIC_BAIDU_TTS_PER 可覆盖；
 *   3. 走代理（分发包，无本地 key）：先试代理侧的 OpenAI 兼容通道（服务端配了 SPEECH_* 才有），没配回落百度。
 * ~~千帆 /v2/audio/speech + qwen-tts~~ 已下线（2026-09-02 实测所有模型/路径均 404）。
 * 返回 mp3，按（通道+音色+文本）缓存到本机，同一句话不重复扣费。
 * 失败返回 undefined——语音气泡显示「语音暂时没接通」并可看文字（Metro 有 [tts] 日志）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { pronounFor } from '@/content/prompts';
import { ENV_QIANFAN_KEY } from '@/lib/engine';
import { getLang, type Lang } from '@/lib/i18n';
import { SPEECH_API_KEY, SPEECH_BASE_URL, SPEECH_UNCONFIGURED, speechConfigured } from '@/lib/media';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import type { Character } from '@/lib/types';

const BAIDU_TTS_URL = 'https://tsn.baidu.com/text2audio';
const ENV_PER = process.env.EXPO_PUBLIC_BAIDU_TTS_PER || '';
const SPEECH_TTS_MODEL = process.env.EXPO_PUBLIC_SPEECH_TTS_MODEL || 'gpt-4o-mini-tts';
/** OpenAI 兼容通道的音色（按人称）：默认 OpenAI 音色名；硅基流动 / 百炼等换成各自的音色 id（见 .env.example） */
const SPEECH_VOICE = {
  he: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_HE || 'onyx',
  she: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_SHE || 'nova',
  ta: process.env.EXPO_PUBLIC_SPEECH_TTS_VOICE_TA || 'alloy',
};
/** 百度 tex 上限 1024 GBK 字节（约 500 汉字）；气泡本来就短，保守截断 */
const MAX_CHARS = 300;

type TtsProvider = 'speech' | 'baidu';

/** 可发声 = 配了 OpenAI 兼容语音服务，或本地有千帆 key（百度直连），或已登录（走服务端代理，D-057） */
export function ttsReady(): boolean {
  return speechConfigured() || Boolean(ENV_QIANFAN_KEY) || proxyReadySync();
}

/**
 * 当前 TTS 通道会不会说这门语言：百度只有中/英，日语要靠 OpenAI 兼容通道；
 * 走代理时以服务端配置为准（这里乐观放行）。
 */
export function ttsSpeaksLang(lang: Lang): boolean {
  if (speechConfigured()) return true;
  if (lang !== 'ja') return true;
  return !ENV_QIANFAN_KEY && proxyReadySync();
}

/** 音色：按人称给默认，env 可覆盖 */
export function voiceFor(character: Character, provider: TtsProvider): string {
  const p = pronounFor(character);
  if (provider === 'speech') {
    return p === '他' ? SPEECH_VOICE.he : p === '她' ? SPEECH_VOICE.she : SPEECH_VOICE.ta;
  }
  if (ENV_PER) return ENV_PER;
  return p === '他' ? '4193' : p === '她' ? '4194' : '4115';
}

/**
 * TA 偶尔发语音（D-074）：只在羁绊会话用（语音是付费层「他在」的一部分，CLAUDE.md §2）。
 * 概率随主动联系强度（高 30% / 中 18% / 低 10%），她刚发过语音时 +40%（回语音是自然的礼尚往来）；
 * 只发短句（2~80 字）；TTS 不可用或不会说当前语言时不发。
 */
export function shouldSendVoice(
  character: Character,
  text: string,
  opts: { herVoice: boolean }
): boolean {
  if (!ttsReady() || !ttsSpeaksLang(getLang())) return false;
  const len = text.trim().length;
  if (len < 2 || len > 80) return false;
  const base = character.initiative === 'high' ? 0.3 : character.initiative === 'low' ? 0.1 : 0.18;
  return Math.random() < Math.min(0.85, base + (opts.herVoice ? 0.4 : 0));
}

/** 简易稳定哈希：缓存文件名用 */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(36);
}

/** ArrayBuffer → base64（RN 没有 Buffer） */
function toBase64(buf: ArrayBuffer): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += CHARS[a >> 2];
    out += CHARS[((a & 3) << 4) | (b === undefined ? 0 : b >> 4)];
    out += b === undefined ? '=' : CHARS[((b & 15) << 2) | (c === undefined ? 0 : c >> 6)];
    out += c === undefined ? '=' : CHARS[c & 63];
  }
  return out;
}

/** application/x-www-form-urlencoded（不依赖 RN 的 URLSearchParams 实现） */
function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** 二进制音频响应 → base64；出错时（JSON / 非 2xx）抛错 */
async function audioBase64(res: Response, label: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || contentType.includes('application/json')) {
    const errText = await res.text();
    throw new Error(`${label} ${res.status}: ${errText.slice(0, 160)}`);
  }
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error(`${label}: empty audio`);
  return toBase64(buf);
}

/** 通道 1：OpenAI 兼容 /audio/speech 直连 */
async function speechDirect(input: string, voice: string): Promise<string> {
  const res = await fetch(`${SPEECH_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${SPEECH_API_KEY}` },
    body: JSON.stringify({ model: SPEECH_TTS_MODEL, input, voice, response_format: 'mp3' }),
  });
  return audioBase64(res, 'Speech TTS');
}

/** 通道 3a：代理侧的 OpenAI 兼容通道（服务端 SPEECH_* 没配会抛 speech not configured） */
async function speechProxy(input: string, voice: string): Promise<string> {
  const data = await proxyJson<{ audio_base64?: string; error?: string }>('speech.synthesize', {
    input,
    voice,
    response_format: 'mp3',
  });
  if (!data.audio_base64) throw new Error(`Speech TTS: ${data.error ?? 'no audio'}`);
  return data.audio_base64;
}

function baiduParams(tex: string, per: string): Record<string, string> {
  return { tex, cuid: 'everylove-app', ctp: '1', lan: 'zh', per, spd: '5', pit: '5', vol: '6', aue: '3' };
}

/** 通道 2：百度 text2audio 直连（本地千帆 key） */
async function baiduDirect(tex: string, per: string): Promise<string> {
  const res = await fetch(BAIDU_TTS_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Bearer ${ENV_QIANFAN_KEY}`,
    },
    body: formBody(baiduParams(tex, per)),
  });
  return audioBase64(res, 'Baidu TTS');
}

/** 通道 3b：百度走代理（代理把二进制包成 audio_base64） */
async function baiduProxy(tex: string, per: string): Promise<string> {
  const data = await proxyJson<{ audio_base64?: string; err_no?: number; err_msg?: string }>(
    'baidu.tts',
    baiduParams(tex, per)
  );
  if (!data.audio_base64) {
    throw new Error(`Baidu TTS ${data.err_no ?? '?'}: ${data.err_msg ?? 'no audio'}`);
  }
  return data.audio_base64;
}

const inflight = new Map<string, Promise<string | undefined>>();

/**
 * 合成一句语音，返回本机音频 URI；不可用 / 失败返回 undefined（调用方显示占位）。
 * 同一句话并发只打一次接口。
 */
export async function synthesizeVoice(
  text: string,
  character: Character
): Promise<string | undefined> {
  if (!ttsReady() || !text.trim()) return undefined;
  const tex = text.trim().slice(0, MAX_CHARS);
  const speechVoice = voiceFor(character, 'speech');
  const baiduVoice = voiceFor(character, 'baidu');
  const route = speechConfigured() ? 'speech' : ENV_QIANFAN_KEY ? 'baidu' : 'proxy';
  const cacheKey = hash(`${route}|${SPEECH_TTS_MODEL}|${speechVoice}|${baiduVoice}|${tex}`);
  const dir = `${FileSystem.documentDirectory}tts/`;
  const local = `${dir}${cacheKey}.mp3`;

  const cached = await FileSystem.getInfoAsync(local).catch(() => null);
  if (cached?.exists) return local;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const job = (async (): Promise<string | undefined> => {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      let b64: string;
      if (route === 'speech') {
        b64 = await speechDirect(tex, speechVoice);
      } else if (route === 'baidu') {
        b64 = await baiduDirect(tex, baiduVoice);
      } else {
        try {
          b64 = await speechProxy(tex, speechVoice);
        } catch (e) {
          if (!String(e).includes(SPEECH_UNCONFIGURED)) throw e;
          b64 = await baiduProxy(tex, baiduVoice);
        }
      }
      await FileSystem.writeAsStringAsync(local, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return local;
    } catch (e) {
      console.warn('[tts] 语音合成失败：', e);
      return undefined;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, job);
  return job;
}

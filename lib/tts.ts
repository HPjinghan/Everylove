/**
 * 语音合成（D-048；D-073 改百度接口；D-074 TA 偶尔发语音；D-139 换 Fish Audio + 角色音色）。
 * 通道（synthesizeVoice 自动选）：
 *   1. Fish Audio `POST api.fish.audio/v1/tts`（EXPO_PUBLIC_FISH_API_KEY；中 / 英 / 日 / 韩全语种；音色 = 角色的 voiceId，见 lib/speech defaultVoiceId）——配了就优先；
 *   2. 百度短文本语音合成 `tsn.baidu.com/text2audio`（与千帆同一把 bce-v3 key；只会中/英混读）：
 *      音色（per）按人称 他→4193 度泽言 / 她→4194 度嫣然 / TA→4115 度小贤，EXPO_PUBLIC_BAIDU_TTS_PER 可覆盖；
 *   3. 走代理（分发包，无本地 key）：先试代理侧的 Fish（服务端配了 FISH_API_KEY 才有），没配回落百度。
 * 返回 mp3，按（通道+模型+音色+文本）缓存到本机，同一句话不重复扣费。
 * 失败返回 undefined——语音气泡显示「语音暂时没接通」并可看文字（Metro 有 [tts] 日志）。
 */

import * as FileSystem from 'expo-file-system/legacy';
import { generationBlocked, reportUsage } from '@/core/usage';

import { pronounFor } from '@/content/prompts';
import { CONFIG } from '@/core/config';
import { getLang, type Lang } from '@/lib/i18n';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import { defaultVoiceId } from '@/lib/speech';
import type { Character } from '@/lib/types';

const BAIDU_TTS_URL = 'https://tsn.baidu.com/text2audio';
const FISH_TTS_URL = 'https://api.fish.audio/v1/tts';
const ENV_PER = CONFIG.baiduTtsPer;
const ENV_QIANFAN_KEY = CONFIG.qianfanKey;
const FISH_KEY = CONFIG.fish.apiKey;
const FISH_MODEL = CONFIG.fish.model;
/** 百度 tex 上限 1024 GBK 字节（约 500 汉字）；气泡本来就短，保守截断 */
const MAX_CHARS = 300;
/** 代理侧没配 FISH_API_KEY 时的固定回应（supabase/functions/ai），客户端据此回落百度 */
export const FISH_UNCONFIGURED = 'fish not configured';

type TtsProvider = 'fish' | 'baidu';

export function fishConfigured(): boolean {
  return Boolean(FISH_KEY);
}

/** 可发声 = 配了 Fish，或本地有千帆 key（百度直连），或已登录（走服务端代理，D-057） */
export function ttsReady(): boolean {
  return fishConfigured() || Boolean(ENV_QIANFAN_KEY) || proxyReadySync();
}

/**
 * 当前 TTS 通道会不会说这门语言：百度只有中/英，日语 / 韩语要靠 Fish；
 * 走代理时以服务端配置为准（这里乐观放行）。
 */
export function ttsSpeaksLang(lang: Lang): boolean {
  if (fishConfigured()) return true;
  if (lang !== 'ja' && lang !== 'ko') return true;
  return !ENV_QIANFAN_KEY && proxyReadySync();
}

/** 音色：Fish = 角色选的 / 默认（lib/speech）；百度 = 按人称给默认，env 可覆盖 */
export function voiceFor(character: Character, provider: TtsProvider): string {
  if (provider === 'fish') return character.voiceId || defaultVoiceId(character, getLang());
  if (ENV_PER) return ENV_PER;
  const p = pronounFor(character);
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

/** Fish 请求体：reference_id 空 = Fish 默认声；latency balanced 兼顾首包与自然度 */
function fishBody(text: string, voiceId: string): Record<string, unknown> {
  return { text, reference_id: voiceId || undefined, format: 'mp3', latency: 'balanced' };
}

/** 通道 1：Fish 直连 */
async function fishDirect(text: string, voiceId: string): Promise<string> {
  const res = await fetch(FISH_TTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${FISH_KEY}`, model: FISH_MODEL },
    body: JSON.stringify(fishBody(text, voiceId)),
  });
  return audioBase64(res, 'Fish TTS');
}

/** 通道 3a：Fish 走代理（服务端 FISH_API_KEY 没配会抛 fish not configured） */
async function fishProxy(text: string, voiceId: string): Promise<string> {
  const data = await proxyJson<{ audio_base64?: string; error?: string }>('fish.tts', fishBody(text, voiceId));
  if (!data.audio_base64) throw new Error(`Fish TTS: ${data.error ?? 'no audio'}`);
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
 * 合成核心：给定两条通道各自的音色，按取路合成并缓存。
 * 同一句话并发只打一次接口。
 */
async function synthesize(text: string, voices: { fish: string; baidu: string }): Promise<string | undefined> {
  if (!ttsReady() || !text.trim()) return undefined;
  const tex = text.trim().slice(0, MAX_CHARS);
  const route: 'fish' | 'baidu' | 'proxy' = fishConfigured() ? 'fish' : ENV_QIANFAN_KEY ? 'baidu' : 'proxy';
  const cacheKey = hash(`${route}|${FISH_MODEL}|${voices.fish}|${voices.baidu}|${tex}`);
  const dir = `${FileSystem.documentDirectory}tts/`;
  const local = `${dir}${cacheKey}.mp3`;

  const cached = await FileSystem.getInfoAsync(local).catch(() => null);
  if (cached?.exists) return local;
  // 生成闸门（D-133）：流量用完了不合成（缓存过的照放）
  if (generationBlocked('tts')) return undefined;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const job = (async (): Promise<string | undefined> => {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      let b64: string;
      if (route === 'fish') {
        b64 = await fishDirect(tex, voices.fish);
      } else if (route === 'baidu') {
        b64 = await baiduDirect(tex, voices.baidu);
      } else {
        try {
          b64 = await fishProxy(tex, voices.fish);
        } catch (e) {
          if (!String(e).includes(FISH_UNCONFIGURED)) throw e;
          b64 = await baiduProxy(tex, voices.baidu);
        }
      }
      await FileSystem.writeAsStringAsync(local, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      reportUsage({ kind: 'tts', provider: route, chars: tex.length });
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

/** 合成 TA 的一句话（音色按角色），返回本机音频 URI；不可用 / 失败返回 undefined（调用方显示占位） */
export function synthesizeVoice(text: string, character: Character): Promise<string | undefined> {
  return synthesize(text, { fish: voiceFor(character, 'fish'), baidu: voiceFor(character, 'baidu') });
}

/** 试听一把音色（创造 ⑧）：指定 Fish 音色 id 合成一句；没配 Fish 时按人称回落百度 */
export function previewVoice(text: string, voiceId: string, pronoun: '他' | '她' | 'TA'): Promise<string | undefined> {
  const baidu = ENV_PER || (pronoun === '他' ? '4193' : pronoun === '她' ? '4194' : '4115');
  return synthesize(text, { fish: voiceId, baidu });
}

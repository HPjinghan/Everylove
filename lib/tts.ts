/**
 * 语音合成（D-048）：走百度千帆 v2 的 OpenAI 兼容语音接口（与聊天/生图共用一把 key）。
 * 模型默认 qwen-tts（千帆挂载的通义语音，可用 EXPO_PUBLIC_QIANFAN_TTS_MODEL 换）；
 * 音色按角色人称选（他/她/TA），可用 EXPO_PUBLIC_QIANFAN_TTS_VOICE 全局覆盖。
 * 兼容两种返回：二进制音频流（OpenAI 惯例）与 JSON 带音频 URL/base64（部分模型）。
 * 合成结果按 (文本+音色) 缓存到本机，同一句话不重复扣费。失败静默——界面回落文字占位。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { pronounFor } from '@/content/prompts';
import { ENV_QIANFAN_KEY } from '@/lib/engine';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import type { Character } from '@/lib/types';

export const QIANFAN_TTS_MODEL = process.env.EXPO_PUBLIC_QIANFAN_TTS_MODEL || 'qwen-tts';
const ENV_VOICE = process.env.EXPO_PUBLIC_QIANFAN_TTS_VOICE || '';

/** 只读工程配置（开发者面板手填已下线，D-069） */
function ttsKey(): string {
  return ENV_QIANFAN_KEY;
}

/** 可发声 = 本地有千帆 key（直连），或已登录（走服务端代理，D-057） */
export function ttsReady(): boolean {
  return Boolean(ttsKey()) || proxyReadySync();
}

/** 音色：按人称给默认（qwen-tts 系列音色名），env 可全局覆盖 */
export function voiceFor(character: Character): string {
  if (ENV_VOICE) return ENV_VOICE;
  const p = pronounFor(character);
  return p === '他' ? 'Ethan' : p === '她' ? 'Cherry' : 'Serena';
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

const inflight = new Map<string, Promise<string | undefined>>();

/**
 * 合成一句语音，返回本机音频 URI；没 key / 失败返回 undefined（调用方回落文字）。
 * 同一句话并发只打一次接口。
 */
export async function synthesizeVoice(
  text: string,
  character: Character
): Promise<string | undefined> {
  const key = ttsKey();
  if ((!key && !proxyReadySync()) || !text.trim()) return undefined;
  const voice = voiceFor(character);
  const cacheKey = hash(`${voice}|${text}`);
  const dir = `${FileSystem.documentDirectory}tts/`;
  const local = `${dir}${cacheKey}.mp3`;

  const cached = await FileSystem.getInfoAsync(local).catch(() => null);
  if (cached?.exists) return local;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const job = (async (): Promise<string | undefined> => {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const body = { model: QIANFAN_TTS_MODEL, input: text, voice, response_format: 'mp3' };
      type TtsJson = {
        data?: { url?: string; audio?: string }[];
        audio?: { url?: string; data?: string };
        url?: string;
        /** 代理把二进制流包成 base64（supabase/functions/ai，D-057） */
        audio_base64?: string;
      };
      let data: TtsJson;
      if (key) {
        const res = await fetch('https://qianfan.baidubce.com/v2/audio/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Qianfan TTS ${res.status}`);
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          // 二进制流（OpenAI 惯例）
          const buf = await res.arrayBuffer();
          if (!buf.byteLength) throw new Error('empty audio');
          await FileSystem.writeAsStringAsync(local, toBase64(buf), {
            encoding: FileSystem.EncodingType.Base64,
          });
          return local;
        }
        data = await res.json();
      } else {
        data = await proxyJson<TtsJson>('qianfan.tts', body);
      }
      // JSON 形态：base64 或音频 URL
      const b64 = data.audio_base64 ?? data.audio?.data ?? data.data?.[0]?.audio;
      if (b64) {
        await FileSystem.writeAsStringAsync(local, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return local;
      }
      const url = data.audio?.url ?? data.data?.[0]?.url ?? data.url;
      if (url) {
        const dl = await FileSystem.downloadAsync(url.replace(/^http:/, 'https:'), local);
        return dl.uri;
      }
      throw new Error('no audio in JSON response');
    } catch (e) {
      console.warn('[tts] 语音合成失败，回落文字占位：', e);
      return undefined;
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, job);
  return job;
}

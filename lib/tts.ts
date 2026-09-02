/**
 * 语音合成（D-048；D-070 改接口）：百度短文本语音合成 `tsn.baidu.com/text2audio`，
 * 与千帆聊天/生图/语音识别共用同一把 bce-v3 key。
 * ~~千帆 /v2/audio/speech + qwen-tts~~ 已下线（2026-09-02 实测所有模型/路径均 404）。
 * 音色（per）按角色人称选：他→4193 度泽言 / 她→4194 度嫣然 / TA→4115 度小贤（大模型/臻品音色），
 * EXPO_PUBLIC_BAIDU_TTS_PER 可全局覆盖。返回 mp3 二进制，按（音色+文本）缓存到本机，同一句话不重复扣费。
 * 取路同 engine：本地 key 直连 > 登录走服务端代理（baidu.tts，代理把二进制包成 audio_base64）。
 * 失败返回 undefined——语音气泡显示「语音暂时没接通」并可看文字（Metro 有 [tts] 日志）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { pronounFor } from '@/content/prompts';
import { ENV_QIANFAN_KEY } from '@/lib/engine';
import { proxyJson, proxyReadySync } from '@/lib/proxy';
import type { Character } from '@/lib/types';

const TTS_URL = 'https://tsn.baidu.com/text2audio';
const ENV_PER = process.env.EXPO_PUBLIC_BAIDU_TTS_PER || '';
/** tex 上限 1024 GBK 字节（约 500 汉字）；气泡本来就短，保守截断 */
const MAX_CHARS = 300;

/** 可发声 = 本地有千帆 key（直连），或已登录（走服务端代理，D-057） */
export function ttsReady(): boolean {
  return Boolean(ENV_QIANFAN_KEY) || proxyReadySync();
}

/** 音色（per）：按人称给默认，env 可全局覆盖 */
export function voiceFor(character: Character): string {
  if (ENV_PER) return ENV_PER;
  const p = pronounFor(character);
  return p === '他' ? '4193' : p === '她' ? '4194' : '4115';
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

const inflight = new Map<string, Promise<string | undefined>>();

/**
 * 合成一句语音，返回本机音频 URI；不可用 / 失败返回 undefined（调用方显示占位）。
 * 同一句话并发只打一次接口。
 */
export async function synthesizeVoice(
  text: string,
  character: Character
): Promise<string | undefined> {
  const key = ENV_QIANFAN_KEY;
  if ((!key && !proxyReadySync()) || !text.trim()) return undefined;
  const per = voiceFor(character);
  const tex = text.trim().slice(0, MAX_CHARS);
  const cacheKey = hash(`baidu|${per}|${tex}`);
  const dir = `${FileSystem.documentDirectory}tts/`;
  const local = `${dir}${cacheKey}.mp3`;

  const cached = await FileSystem.getInfoAsync(local).catch(() => null);
  if (cached?.exists) return local;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const job = (async (): Promise<string | undefined> => {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const params = {
        tex,
        cuid: 'everylove-app',
        ctp: '1',
        lan: 'zh',
        per,
        spd: '5',
        pit: '5',
        vol: '6',
        aue: '3',
      };
      let b64: string;
      if (key) {
        const res = await fetch(TTS_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Bearer ${key}`,
          },
          body: formBody(params),
        });
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || contentType.includes('application/json')) {
          // 百度出错时返回 JSON（err_no / err_msg）
          const errText = await res.text();
          throw new Error(`Baidu TTS ${res.status}: ${errText.slice(0, 160)}`);
        }
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) throw new Error('empty audio');
        b64 = toBase64(buf);
      } else {
        const data = await proxyJson<{ audio_base64?: string; err_no?: number; err_msg?: string }>(
          'baidu.tts',
          params
        );
        if (!data.audio_base64) {
          throw new Error(`Baidu TTS ${data.err_no ?? '?'}: ${data.err_msg ?? 'no audio'}`);
        }
        b64 = data.audio_base64;
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

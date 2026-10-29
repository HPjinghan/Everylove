/**
 * 提前录好的试听（D-260）：恋爱类型的示例台词是固定的、声线也是固定的——
 * 「每句 × 每把声音 × 每种语言」由 scripts/gen-voice-samples.mjs 合成好放在云端（Supabase Storage 公开桶 voice-samples），
 * 捏人时「听听 TA」直接下载来放，不再现场合成、不花钱。
 * 路径 = <模型>/<语言>/<声线>/<句子的哈希>.mp3：换了模型、改了句子，旧的自然不命中。
 * 云端没有这一条（新加的句子还没跑脚本）就退回现场合成（试听不计，D-210）。下载下来的放进 tts 缓存目录，7 天后由 media-gc 清掉。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { CONFIG } from '@/core/config';
import type { Lang } from '@/lib/i18n';
import { previewVoice } from '@/lib/tts';

export const VOICE_SAMPLES_BUCKET = 'voice-samples';

/** FNV-1a，36 进制（脚本里同一个算法） */
export function sampleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(36);
}

/** 云端那一条的相对路径 */
export function samplePath(text: string, voiceId: string, lang: Lang, model = CONFIG.eleven.model): string {
  return `${model}/${lang}/${voiceId}/${sampleHash(text)}.mp3`;
}

export function sampleUrl(text: string, voiceId: string, lang: Lang): string | undefined {
  if (!CONFIG.supabaseUrl) return undefined;
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/${VOICE_SAMPLES_BUCKET}/${samplePath(text, voiceId, lang)}`;
}

/** 这句话用这把声音念出来的本机文件：先找缓存，再下云端的，都没有就现场合成；全失败给 undefined */
export async function sampleClip(text: string, voiceId: string, lang: Lang, pronoun: '他' | '她' | 'TA'): Promise<string | undefined> {
  const root = FileSystem.documentDirectory;
  const url = sampleUrl(text, voiceId, lang);
  if (root && url) {
    const dir = `${root}tts/`;
    const local = `${dir}sample-${sampleHash(`${CONFIG.eleven.model}|${lang}|${voiceId}|${text}`)}.mp3`;
    try {
      if ((await FileSystem.getInfoAsync(local)).exists) return local;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const res = await FileSystem.downloadAsync(url, local);
      if (res.status === 200) return local;
      await FileSystem.deleteAsync(local, { idempotent: true });
    } catch (e) {
      console.warn('[voice-samples] 云端试听没取到，现场合成：', e);
    }
  }
  return previewVoice(text, voiceId, pronoun);
}

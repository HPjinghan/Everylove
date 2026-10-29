/**
 * 捏人时的试听录音（D-260）：恋爱类型的示例台词与声线都是固定的，录音放在 Supabase 公开桶 voice-samples、全站共用。
 * 按需生成：先下桶里的；没有就请代理合成一次存进桶（eleven.sample，平台出），再下——同一条全站只合成一次，没人点过的永远不生成。
 * 路径与哈希的算法在 supabase/functions/_shared/voice-samples.ts（代理同一份）。
 * 下下来的放进 tts 缓存目录（7 天后 media-gc 清掉）；代理也不通（开发构建没登录）就退回本机直连合成（试听不计）。
 */

import * as FileSystem from 'expo-file-system/legacy';

import { CONFIG } from '@/core/config';
import type { Lang } from '@/lib/i18n';
import { proxyJson } from '@/lib/proxy';
import { previewVoice } from '@/lib/tts';
import { samplePath, SAMPLES_BUCKET, sampleHash } from '@/supabase/functions/_shared/voice-samples';

export { samplePath, sampleHash };

function publicUrl(path: string): string | undefined {
  return CONFIG.supabaseUrl ? `${CONFIG.supabaseUrl}/storage/v1/object/public/${SAMPLES_BUCKET}/${path}` : undefined;
}

/** 下到本机：200 才算数，别的删掉半截文件 */
async function download(url: string, local: string): Promise<boolean> {
  const res = await FileSystem.downloadAsync(url, local);
  if (res.status === 200) return true;
  await FileSystem.deleteAsync(local, { idempotent: true });
  return false;
}

/** 这句话用这把声音念出来的本机文件：本机缓存 → 桶里的 → 请代理合成一次存进桶再下 → 本机直连合成；全失败给 undefined */
export async function sampleClip(text: string, voiceId: string, lang: Lang, pronoun: '他' | '她' | 'TA'): Promise<string | undefined> {
  const root = FileSystem.documentDirectory;
  const path = samplePath(text, voiceId, lang, CONFIG.eleven.model);
  const url = publicUrl(path);
  if (root && url) {
    const dir = `${root}tts/`;
    const local = `${dir}sample-${sampleHash(path)}.mp3`;
    try {
      if ((await FileSystem.getInfoAsync(local)).exists) return local;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      if (await download(url, local)) return local;
      // 桶里还没有：这条第一次有人点，请服务器合成一次存进去（平台出）
      const made = await proxyJson<{ path?: string }>('eleven.sample', { text, voice_id: voiceId, language: lang }, { billing: 'house' });
      if (made.path && (await download(publicUrl(made.path)!, local))) return local;
    } catch (e) {
      console.warn('[voice-samples] 没取到试听录音，本机直连合成：', e);
    }
  }
  return previewVoice(text, voiceId, pronoun);
}

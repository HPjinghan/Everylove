/**
 * 捏人时的试听录音（D-260）：客户端（lib/voice-samples.ts）与代理（functions/ai 的 eleven.sample）同一份。
 * 按需生成：第一个点到「这句话 × 这把声音 × 这门语言」的人触发服务器合成一次、存进公开桶，之后所有人直接下载，不再花钱；
 * 没人点过的组合永远不生成。服务器只认清单里的句子与声线（voice-sample-lines.ts，由 npm run voice-samples 从源码导出），
 * 别人没法借这个入口免费合成任意文字。
 * 路径 = <模型>/<语言>/<声线>/<句子的哈希>.mp3：换了模型、改了句子，旧的自然不命中。
 */

export const SAMPLES_BUCKET = 'voice-samples';

export type SampleLang = 'zh' | 'en' | 'ja' | 'ko';

/** FNV-1a，36 进制 */
export function sampleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(36);
}

/** 桶里的相对路径 */
export function samplePath(text: string, voiceId: string, lang: SampleLang, model: string): string {
  return `${model}/${lang}/${voiceId}/${sampleHash(text)}.mp3`;
}

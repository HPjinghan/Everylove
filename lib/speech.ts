/**
 * 语音供给的纯逻辑（D-139）：识别按语言分流 + 音色池推荐。不碰网络、不碰 RN，可直接测。
 * - 识别：中 / 英走百度（同一把千帆 key、快且免费），日 / 韩走多语种通道（Fish transcribe-1，或 Whisper 协议的 Groq / OpenAI …，CONFIG.asr.provider）；
 *   哪些语言走多语种通道由 CONFIG.asr.langs 定。
 * - 音色：角色自己选的 > 种子角色预定的 > 音色池里同语言同性别的第一把 > env 兜底 > Fish 默认声。
 */

import { SEED_VOICES, VOICES, type VoiceOption } from '@/content/voices';
import { CONFIG } from '@/core/config';
import { seedBaseId } from '@/content/portraits';
import type { Lang } from '@/lib/i18n';
import type { Character } from '@/lib/types';

/* ═══ 识别分流 ═══ */

export type AsrChannel = 'multi' | 'baidu' | 'none';

/** 百度识别会的语言 */
export const BAIDU_ASR_LANGS: Lang[] = ['zh', 'en'];

/** 这门语言按配置想不想走多语种通道 */
export function multiAsrWanted(lang: Lang, langs = CONFIG.asr.langs): boolean {
  const list = langs
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes('all') || list.includes(lang);
}

/**
 * 选识别通道：想走多语种通道且有 → multi；百度会这门语言且有 → baidu；百度不会但有多语种通道 → multi；都不行 → none。
 * avail 由调用方按取路给（本地 key / 代理乐观放行）。
 */
export function asrChannelFor(lang: Lang, avail: { multi: boolean; baidu: boolean }, langs = CONFIG.asr.langs): AsrChannel {
  const baiduCan = avail.baidu && BAIDU_ASR_LANGS.includes(lang);
  if (avail.multi && multiAsrWanted(lang, langs)) return 'multi';
  if (baiduCan) return 'baidu';
  if (avail.multi) return 'multi';
  return 'none';
}

/* ═══ 音色池 ═══ */

export function voicesFor(lang: Lang): VoiceOption[] {
  return VOICES.filter((v) => v.lang === lang);
}

/** 角色的性别归一（推荐与默认音色用）：没填按 loveTag 推 */
export function voiceGenderOf(c: Pick<Character, 'gender' | 'loveTag'>): VoiceOption['gender'] {
  if (c.gender) return c.gender;
  if (c.loveTag === 'male') return 'male';
  if (c.loveTag === 'female') return 'female';
  return 'nonbinary';
}

/** 一轮推荐几把 */
export const VOICE_PICK = 3;

/**
 * 按角色推荐音色：同语言、同性别（nonbinary 不限性别），气质标签命中角色的提示词（恋爱类型 / 种族 / 风格标签）越多越靠前；
 * round 每加一就换下一批（池子转完循环）。池子不够三把就全给。
 */
export function recommendVoices(
  opts: { lang: Lang; gender: VoiceOption['gender']; hints?: string[] },
  round = 0
): VoiceOption[] {
  const pool = voicesFor(opts.lang).filter((v) => opts.gender === 'nonbinary' || v.gender === opts.gender || v.gender === 'nonbinary');
  if (pool.length <= VOICE_PICK) return pool;
  const hints = (opts.hints ?? []).map((h) => h.trim()).filter(Boolean);
  const score = (v: VoiceOption) => hints.reduce((s, h) => s + (v.tags.some((tg) => tg.includes(h) || h.includes(tg)) || v.name.includes(h) ? 1 : 0), 0);
  const ranked = pool
    .map((v, i) => ({ v, i, s: score(v) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.v);
  const start = (Math.max(0, round) * VOICE_PICK) % ranked.length;
  const out: VoiceOption[] = [];
  for (let k = 0; k < VOICE_PICK; k++) out.push(ranked[(start + k) % ranked.length]);
  return out;
}

/** 角色没选音色时的默认：种子预定 > 池里同语言同性别第一把 > env 按人称 */
export function defaultVoiceId(c: Pick<Character, 'id' | 'gender' | 'loveTag' | 'pronoun'>, lang: Lang): string {
  const base = seedBaseId(c.id);
  const seed = SEED_VOICES[`${base}@${lang}`] ?? SEED_VOICES[base];
  if (seed) return seed;
  const gender = voiceGenderOf(c);
  const fromPool = voicesFor(lang).find((v) => v.gender === gender) ?? voicesFor(lang)[0];
  if (fromPool) return fromPool.id;
  const p = c.pronoun ?? (gender === 'male' ? '他' : gender === 'female' ? '她' : 'TA');
  return p === '他' ? CONFIG.fish.voice.he : p === '她' ? CONFIG.fish.voice.she : CONFIG.fish.voice.ta;
}

/** 试听句（创造 ⑧）：没有开场白时用；中文键，显示 / 合成前 t() */
export const VOICE_SAMPLE_LINE = '今天也在想你。';

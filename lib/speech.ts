/**
 * 语音供给的纯逻辑（D-139）：识别按语言分流 + 音色池推荐。不碰网络、不碰 RN，可直接测。
 * - 识别：中 / 英走百度（同一把千帆 key、快且免费），日 / 韩走多语种通道（ElevenLabs Scribe，或 Whisper 协议的 Groq / OpenAI …，CONFIG.asr.provider）；
 *   哪些语言走多语种通道由 CONFIG.asr.langs 定。
 * - 音色（D-230 / D-241）：角色自己选的（还在池里才算）> 按恋爱类型取池里会这门语言、同性别的那把（种子按 SEED_STYLES、没填类型按原型）> 同性别第一把 > env 兜底。
 */

import { SEED_STYLES, VOICES, type VoiceOption } from '@/content/voices';
import { CONFIG } from '@/core/config';
import { seedBaseId } from '@/content/portraits';
import type { Lang } from '@/lib/i18n';
import type { ArchetypeId, Character } from '@/lib/types';

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

/** 会说这门语言的声线（没写 langs = 四门都会，D-241） */
export function voicesFor(lang: Lang): VoiceOption[] {
  return VOICES.filter((v) => !v.langs || v.langs.includes(lang));
}

/** 这把声线还在不在池里：换供应商以后旧的音色 id 作废，按默认走（D-241） */
export function inVoicePool(id: string | undefined): id is string {
  return Boolean(id && VOICES.some((v) => v.id === id));
}

/** 角色的性别归一（推荐与默认音色用）：没填按 loveTag 推，人外按人称（她 = 女声） */
export function voiceGenderOf(c: Pick<Character, 'gender' | 'loveTag' | 'pronoun'>): VoiceOption['gender'] {
  if (c.gender) return c.gender;
  if (c.loveTag === 'male') return 'male';
  if (c.loveTag === 'female') return 'female';
  if (c.pronoun === '他') return 'male';
  if (c.pronoun === '她') return 'female';
  return 'nonbinary';
}

/** 一轮推荐几把 */
export const VOICE_PICK = 3;

/** 没填恋爱类型时按原型取声 */
const ARCHETYPE_STYLE: Record<ArchetypeId, string> = {
  gentle: '温柔年上',
  sharp: '毒舌竹马',
  ceo: '霸总',
  nonhuman: '高冷禁欲',
};

/** 这个角色按哪种恋爱类型取声：种子预定 > 自己填的 > 原型 */
export function voiceStyleOf(c: { id: string; loveStyle?: string; archetype?: ArchetypeId }): string | undefined {
  return SEED_STYLES[seedBaseId(c.id)] ?? c.loveStyle ?? (c.archetype ? ARCHETYPE_STYLE[c.archetype] : undefined);
}

/**
 * 按角色推荐音色：同语言、同性别（nonbinary 不限性别）；对应角色恋爱类型的那把排第一，
 * 其余按提示词（恋爱类型 / 种族）命中排；round 每加一就换下一批（池子转完循环）。池子不够三把就全给。
 */
export function recommendVoices(
  opts: { lang: Lang; gender: VoiceOption['gender']; hints?: string[] },
  round = 0
): VoiceOption[] {
  const pool = voicesFor(opts.lang).filter((v) => opts.gender === 'nonbinary' || v.gender === opts.gender || v.gender === 'nonbinary');
  if (pool.length <= VOICE_PICK) return pool;
  const hints = (opts.hints ?? []).map((h) => h.trim()).filter(Boolean);
  const score = (v: VoiceOption) => hints.reduce((s, h) => s + (v.styles.includes(h) ? 1 : 0), 0);
  const ranked = pool
    .map((v, i) => ({ v, i, s: score(v) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.v);
  const start = (Math.max(0, round) * VOICE_PICK) % ranked.length;
  const out: VoiceOption[] = [];
  for (let k = 0; k < VOICE_PICK; k++) out.push(ranked[(start + k) % ranked.length]);
  return out;
}

/** 角色没选音色时的默认：按恋爱类型取同语言同性别那把 > 同性别第一把 > 池里第一把 > env 按人称 */
export function defaultVoiceId(
  c: Pick<Character, 'id' | 'gender' | 'loveTag' | 'pronoun' | 'loveStyle'> & { archetype?: ArchetypeId },
  lang: Lang
): string {
  const gender = voiceGenderOf(c);
  const pool = voicesFor(lang).filter((v) => gender === 'nonbinary' || v.gender === gender);
  const style = voiceStyleOf(c);
  const fromPool = (style ? pool.find((v) => v.styles.includes(style)) : undefined) ?? pool[0] ?? voicesFor(lang)[0];
  if (fromPool) return fromPool.id;
  const p = c.pronoun ?? (gender === 'male' ? '他' : gender === 'female' ? '她' : 'TA');
  return p === '他' ? CONFIG.eleven.voice.he : p === '她' ? CONFIG.eleven.voice.she : CONFIG.eleven.voice.ta;
}

/** 试听句（创造 ⑧）：没有开场白时用；中文键，显示 / 合成前 t() */
export const VOICE_SAMPLE_LINE = '今天也在想你。';

/**
 * 音色池（D-139 / D-230 / D-241）：TA 的声音只用 ElevenLabs 的官方默认声线（API 里叫 premade）——
 * 不收声库里的社区声线（真人克隆，作者随时能撤），也不收任何真人 / IP 的声音（红线 1）。
 * ElevenLabs 的声线四门语言都会说（v4 念别的语言不带原声线的口音），所以一把声线不分语言；只会某几门的写 langs。
 * 每把声线标它是哪几种恋爱类型的默认声（styles = LOVE_STYLES 的 label，同性别里每种类型恰好一把）；
 * 选法：听官方样音、看标签与描述，人工定（npm run eleven-voices 拉候选）。
 * 创造页按类型推荐、可换一批；角色没选 = 按恋爱类型取这里的默认（lib/speech defaultVoiceId）。
 * 官方默认声线 2026-12-31 到期，到期前要换成 ElevenLabs 给的替换声线（OPEN_QUESTIONS #41）。
 */

import type { Lang } from '@/lib/i18n';

export interface VoiceOption {
  /** ElevenLabs voice_id */
  id: string;
  /** 声线名（显示用） */
  name: string;
  /** 只会这几门语言；不写 = 四门都会 */
  langs?: Lang[];
  gender: 'male' | 'female' | 'nonbinary';
  /** 这把是哪几种恋爱类型的默认声（LOVE_STYLES 的 label；显示时 t()） */
  styles: string[];
}

/** 等 ElevenLabs key 到了用 npm run eleven-voices 拉官方声线、人工定好再填 */
export const VOICES: VoiceOption[] = [];

/** 六位种子角色按恋爱类型取声（原 id；-en / -ja / -ko 版本同一类型，各语言自动落到自己的那把） */
export const SEED_STYLES: Record<string, string> = {
  'shen-zhiyan': '温柔年上',
  'jiang-ye': '毒舌竹马',
  'su-cheng': '姐姐系',
  'luo-xiaoman': '阳光直球',
  'zhu-yuan': '高冷禁欲',
  'hu-bugui': '腹黑',
};

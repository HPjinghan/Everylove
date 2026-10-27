/**
 * 音色池（D-139 / D-230 / D-241）：TA 的声音只用 ElevenLabs 的官方默认声线（API 里叫 premade）——
 * 不收声库里的社区声线（真人克隆，作者随时能撤），也不收任何真人 / IP 的声音（红线 1）。
 * ElevenLabs 的声线四门语言都会说（v4 念别的语言不带原声线的口音），所以一把声线不分语言；只会某几门的写 langs。
 * 每把声线标它是哪几种恋爱类型的默认声（styles = LOVE_STYLES 的 label，同性别里每种类型恰好一把）；
 * 选法：听官方样音、看标签与描述，人工定（npm run eleven-voices 拉候选）。
 * 创造页按类型推荐、可换一批；角色没选 = 按恋爱类型取这里的默认（lib/speech defaultVoiceId）。
 * 官方默认声线 2026-12-31 到期，到期前要换成 ElevenLabs 给的替换声线（OPEN_QUESTIONS #41）。同性别里一把兼一到两种类型。
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

/** 2026-10-27 账号里的 21 把官方声线（npm run eleven-voices）；不收：Bill（老人）、Daniel（播音腔） */
export const VOICES: VoiceOption[] = [
  // 男
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', styles: ['温柔年上'] },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', styles: ['小狗系年下'] },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', gender: 'male', styles: ['姐姐系', '青梅竹马'] },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', styles: ['依恋型'] },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', styles: ['阳光直球'] },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'male', styles: ['天然治愈'] },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', styles: ['毒舌竹马', '腹黑'] },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', styles: ['傲娇'] },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', gender: 'male', styles: ['病娇（尺度内）'] },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'male', styles: ['高冷禁欲', '冷静大人'] },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', styles: ['霸总'] },
  // 女
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', styles: ['温柔年上', '冷静大人'] },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', styles: ['小狗系年下', '天然治愈'] },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella', gender: 'female', styles: ['姐姐系', '依恋型'] },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', styles: ['阳光直球', '青梅竹马'] },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', styles: ['毒舌竹马', '傲娇'] },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', styles: ['腹黑', '高冷禁欲'] },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', styles: ['病娇（尺度内）', '霸总'] },
  // 中性
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'nonbinary', styles: [] },
];

/** 六位种子角色按恋爱类型取声（原 id；-en / -ja / -ko 版本同一类型，各语言自动落到自己的那把） */
export const SEED_STYLES: Record<string, string> = {
  'shen-zhiyan': '温柔年上',
  'jiang-ye': '毒舌竹马',
  'su-cheng': '姐姐系',
  'luo-xiaoman': '阳光直球',
  'zhu-yuan': '高冷禁欲',
  'hu-bugui': '腹黑',
};

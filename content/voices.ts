/**
 * 音色池（D-139）：TA 的声音从这里选，不用 Fish Audio 整个公共声库（两百万个里大量模仿真人、未授权，红线 1）。
 * 只收 Fish 官方（licensed）与明确可商用的声线，按语言 × 性别 × 气质打标；创造 ⑧ 按角色推荐三把、可换一批。
 * 内容由 scripts/fish-voices.mts 从 Fish 声库拉取并写入（需要 EXPO_PUBLIC_FISH_API_KEY）；人工筛过再提交。
 * 池子为空的语言不显示音色选择（无供给不摆入口）。
 */

import type { Lang } from '@/lib/i18n';

export interface VoiceOption {
  /** Fish Audio reference_id */
  id: string;
  /** 声线名（显示用，各语言自己的名字） */
  name: string;
  lang: Lang;
  gender: 'male' | 'female' | 'nonbinary';
  /** 气质标签（中文键，推荐打分用；显示时 t()） */
  tags: string[];
}

export const VOICES: VoiceOption[] = [];

/** 六位种子角色各定一把（按原 id，-en / -ja / -ko 本地化版本按语言另配：键写 `id@lang`，没有就回落原 id） */
export const SEED_VOICES: Record<string, string> = {};

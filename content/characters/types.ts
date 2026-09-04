/**
 * 角色内容的类型（D-093 拆目录）：台词脚本、动态种子、语言包。
 */

import type { ArchetypeId, Character } from '@/lib/types';

export interface CharacterScript {
  /** 初见：TA 先开口（即点即聊，降低开口成本） */
  opening: string[];
  /** 初识模式的台词样本（前两句进 prompt 的【你的声音】） */
  square: string[];
  /** 领养触发：TA 开口要联系方式（产品触发器，不由模型决定） */
  offer: string[];
  /** 亲密模式的台词样本（前三句进 prompt 的【你的声音】） */
  bonded: string[];
  /** 缔结后 TA 打招呼的第一批消息（第二条也作台词样本） */
  arrival: { text: string; kind?: 'voice' }[];
  /** 人设与追法描述（进系统 prompt 的【你是谁】【你的追法】） */
  persona: string;
  pursuit: string;
  /* ── 下面几项自脚本引擎下线（D-069）与开门下线（D-046）后没有代码在用，中文包保留、其他语言可省 ── */
  triggers?: { pattern: RegExp; replies: string[] }[];
  farewell?: { text: string; kind?: 'voice' }[];
  notifBody?: string;
  commentReply?: string;
  nicknamePresets?: string[];
}

export interface SeedPost {
  text: string;
  hoursAgo: number;
  likes: number;
}

export interface SquarePost extends SeedPost {
  characterId: string;
}

/** 一种语言的全部角色内容：只分发给这门语言的用户（D-093） */
export interface LanguagePack {
  CHARACTERS: Character[];
  CHAR_SCRIPTS: Record<string, CharacterScript>;
  ARCHETYPE_DEFAULTS: Record<Exclude<ArchetypeId, 'nonhuman'>, CharacterScript>;
  SQUARE_POSTS: SquarePost[];
  BONDED_POSTS: Record<string, SeedPost[]>;
  BONDED_POSTS_DEFAULTS: Record<Exclude<ArchetypeId, 'nonhuman'>, SeedPost[]>;
}

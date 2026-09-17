/**
 * 传记（D-149）：TA 的故事，创作者按章写、每章设开放的羁绊等级；读者在传记 App 里看。
 * 章节是内容不是设定：不进领养快照——永远读角色的**现行版本**（种子 = 内容包、共享池角色 = 云端那份、自己的 = 角色库），
 * 快照只作找不到现行版本时的回落（比如别人下架了角色）。开不开按这段羁绊现在的等级（lib/bond levelOf）。
 */

import { chaptersFor } from '@/content/characters';
import { levelOf } from '@/lib/bond';
import { liveCharacter, type CharacterSources } from '@/lib/character-update';
import type { Bond, Character, StoryChapter } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

export type StoryBond = Pick<Bond, 'characterId' | 'character' | 'affinity' | 'createdAt' | 'legacyLevel'>;

/** 这段羁绊对应角色的现行版本；找不到就用缔结时的快照 */
export function liveCharacterFor(bond: Pick<Bond, 'characterId' | 'character'>, s: CharacterSources = useAppStore.getState()): Character | undefined {
  return liveCharacter(bond.characterId, s) ?? bond.character;
}

/** 这段羁绊能看到的传记（全部章节，含还没开放的），按创建时间从早到晚 */
export function chaptersForBond(bond: Pick<Bond, 'characterId' | 'character'>, s: CharacterSources = useAppStore.getState()): StoryChapter[] {
  const c = liveCharacterFor(bond, s);
  if (!c) return [];
  return [...chaptersFor(c)].sort((a, b) => a.createdAt - b.createdAt);
}

/** 这一章对这段羁绊开不开：羁绊等级 ≥ 章节的开放等级 */
export function chapterOpen(bond: StoryBond, chapter: Pick<StoryChapter, 'unlockLevel'>, now = Date.now()): boolean {
  return levelOf(bond, now) >= Math.max(1, chapter.unlockLevel);
}

/** 章节里的纯文字（列表预览 / 摘要用） */
export function chapterText(chapter: Pick<StoryChapter, 'blocks'>): string {
  return chapter.blocks
    .filter((b): b is Extract<StoryChapter['blocks'][number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

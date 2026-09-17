/**
 * 角色更新通道（D-140）：缔结即快照（D-116）之后，作者（自己或别的玩家）改了角色，这段关系不会自动变；
 * TA 的主页信息卡上留一条「设定」——现行版本和快照不一样就显示「作者更新了」，她点一下才换成最新（聊天记录、记忆、等级都留着）。
 * 「现行版本」：种子看内容包、共享池角色看云端拉回来的那份（store.sharedPool，5 分钟刷新）、自己的看角色库。
 */

import { CHARACTERS } from '@/content/characters';
import type { Bond, Character } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/** 比对时不看的字段：热度、来源标记、可见性这些不算「设定变了」 */
const VOLATILE: (keyof Character)[] = ['adoptedCount', 'shared', 'custom', 'visibility', 'teaser'];

/** 设定指纹：字段按名排序后序列化，去掉易变字段；两份相同 = 没更新 */
export function characterFingerprint(c: Character): string {
  const keys = (Object.keys(c) as (keyof Character)[]).filter((k) => !VOLATILE.includes(k) && c[k] !== undefined).sort();
  return JSON.stringify(keys.map((k) => [k, c[k]]));
}

/** 现行版本从哪找：角色库与共享池（界面传自己订阅的那份，判定才会跟着刷新） */
export type CharacterSources = { customCharacters: Character[]; sharedPool: Character[] };

/** 角色的现行版本（不看羁绊快照）：种子 > 共享池（别人的，云端最新）> 角色库 */
export function liveCharacter(id: string, s: CharacterSources = useAppStore.getState()): Character | undefined {
  const seed = CHARACTERS.find((c) => c.id === id);
  if (seed) return seed;
  const pooled = s.sharedPool.find((c) => c.id === id);
  const own = s.customCharacters.find((c) => c.id === id);
  if (own?.shared && pooled) return pooled;
  return own ?? pooled;
}

/** 这段关系有没有更新可换：有快照、找得到现行版本、且两者不同 → 返回现行版本 */
export function characterUpdateFor(bond: Pick<Bond, 'characterId' | 'character'>, s: CharacterSources = useAppStore.getState()): Character | undefined {
  if (!bond.character) return undefined;
  const live = liveCharacter(bond.characterId, s);
  if (!live) return undefined;
  return characterFingerprint(live) === characterFingerprint(bond.character) ? undefined : live;
}

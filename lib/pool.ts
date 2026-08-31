/**
 * 共享角色池（D-060）：公开的自创角色上传 Supabase，所有玩家的交友牌堆合入这一池。
 * - 读公开（anon 也可读，RLS：select using true）；写只限本人（owner_id）
 * - 本地缓存在 store.sharedPool（5 分钟节流刷新）；离线用缓存
 * - 审核暂缺：Harper 后续接平台（发布仍过本地真人/IP 拦截，红线 #1/#4 的最低线）
 */

import { authConfigured, currentSession, getSupabase } from '@/lib/auth';
import type { Character } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const REFRESH_MS = 5 * 60_000;

/** 刷新共享池缓存（节流；排除自己的、预告卡） */
export async function refreshSharedPool(force = false): Promise<void> {
  if (!authConfigured()) return;
  const state = useAppStore.getState();
  if (!force && Date.now() - state.sharedPoolAt < REFRESH_MS) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from('shared_characters')
      .select('id, owner_id, data')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const mine = (await currentSession())?.user.id;
    const chars: Character[] = (data ?? [])
      .filter((r) => r.owner_id !== mine)
      .map((r) => ({ ...(r.data as Character), id: r.id as string, shared: true }))
      .filter((c) => c.name && !c.teaser);
    useAppStore.getState().setSharedPool(chars);
  } catch (e) {
    console.warn('[pool] 共享池刷新失败（用缓存）：', e);
  }
}

/** 发布/更新一个公开角色；未登录或失败返回 false */
export async function publishCharacter(c: Character): Promise<boolean> {
  const sb = getSupabase();
  const session = await currentSession();
  if (!sb || !session) return false;
  const { error } = await sb.from('shared_characters').upsert({
    id: c.id,
    owner_id: session.user.id,
    data: { ...c, shared: undefined },
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[pool] 发布失败：', error);
    return false;
  }
  return true;
}

/** 转私密/删除：从共享池撤下 */
export async function unpublishCharacter(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !(await currentSession())) return false;
  const { error } = await sb.from('shared_characters').delete().eq('id', id);
  return !error;
}

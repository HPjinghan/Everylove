/**
 * 全局状态：zustand + AsyncStorage 持久化。
 * - squareChats：广场搭话记录（3 天过期，免费层商业承重墙）
 * - bonds：羁绊，个体层独立状态机（亲密度 / 记忆 / 开门排程）
 * - posts：动态流（广场公开帖 + 领养后物化帖）
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { bondedPostsFor, CHARACTERS, scriptFor, SQUARE_POSTS } from '@/content/characters';
import { ENV_ANTHROPIC_KEY, ENV_QIANFAN_KEY } from '@/lib/engine';
import { uid } from '@/lib/format';
import { arrivalTimeLabel, nextEightPM } from '@/lib/notifications';
import type {
  Bond,
  BondMemory,
  CalendarEvent,
  Character,
  ChatMessage,
  EngineId,
  LovePref,
  Post,
  SquareChat,
} from '@/lib/types';

/** 搭话记录过期时长：3 天（免费层天花板是商业决策，不是产品缺陷） */
export const SQUARE_CHAT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

interface AppState {
  onboarded: boolean;
  lovePref?: LovePref;
  firstOpenAt: number;
  squareChats: Record<string, SquareChat>;
  bonds: Bond[];
  customCharacters: Character[];
  posts: Post[];
  /** 角色立绘（本机文件 URI），按角色 id；作为后续所有生图的参考图（D-019） */
  portraits: Record<string, string>;
  /** 手机壳桌面（D-020/D-021）：图标顺序（长按拖动后持久化）与壁纸 id */
  desktopOrder: string[];
  wallpaper: string;
  /** 日历用户层日程（D-020） */
  userEvents: CalendarEvent[];
  engine: EngineId;
  anthropicKey: string;
  qianfanKey: string;

  completeOnboarding: (pref: LovePref) => void;
  ensureSeedPosts: () => void;
  /** 打开广场搭话：过期则清空重来（他忘记你了）。返回是否刚过期。 */
  ensureSquareChat: (characterId: string) => boolean;
  appendSquare: (
    characterId: string,
    msgs: ChatMessage[],
    opts?: { userTurn?: boolean; offered?: boolean }
  ) => void;
  createBond: (input: {
    characterId: string;
    name: string;
    nickname: string;
    birthday?: string;
  }) => string;
  setBondNotif: (bondId: string, notifId?: string) => void;
  appendBond: (
    bondId: string,
    msgs: ChatMessage[],
    opts?: { affinityDelta?: number; unreadDelta?: number }
  ) => void;
  markBondRead: (bondId: string) => void;
  markAwayNotified: (bondId: string) => void;
  /** 写入羁绊记忆库（由 lib/memory.ts 后台提取后调用，D-016） */
  setBondMemory: (bondId: string, memory: BondMemory) => void;
  /** 到点开门：把「他来了」投递进会话，并排下一天的门。返回投递过的 bondId。 */
  deliverDueArrivals: () => string[];
  toggleLike: (postId: string) => void;
  addMyComment: (postId: string, text: string) => void;
  addHisReply: (postId: string) => void;
  addCustomCharacter: (c: Character) => void;
  setPortrait: (characterId: string, uri: string) => void;
  setDesktopOrder: (order: string[]) => void;
  setWallpaper: (id: string) => void;
  addUserEvent: (e: CalendarEvent) => void;
  removeUserEvent: (id: string) => void;
  /** 心跳三段式：标记某段已投递（lib/heartbeat.ts） */
  markEventStage: (id: string, stage: 'caredBefore' | 'caredDay' | 'caredAfter') => void;
  setEngine: (e: EngineId) => void;
  setAnthropicKey: (k: string) => void;
  setQianfanKey: (k: string) => void;
  /** 测试工具：把第一个羁绊的开门时间改到 n 分钟后 */
  devSetArrivalSoon: (minutes: number) => string | null;
  resetAll: () => void;
}

const initialData = {
  onboarded: false,
  lovePref: undefined as LovePref | undefined,
  firstOpenAt: Date.now(),
  squareChats: {} as Record<string, SquareChat>,
  bonds: [] as Bond[],
  customCharacters: [] as Character[],
  posts: [] as Post[],
  portraits: {} as Record<string, string>,
  desktopOrder: [] as string[],
  wallpaper: 'dawn',
  userEvents: [] as CalendarEvent[],
  // 工程配置里有 key 时默认走真模型（D-010）：Claude 优先，其次千帆；都没配则脚本引擎
  engine: (ENV_ANTHROPIC_KEY ? 'anthropic' : ENV_QIANFAN_KEY ? 'qianfan' : 'mock') as EngineId,
  anthropicKey: '',
  qianfanKey: '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData,

      completeOnboarding: (pref) => set({ onboarded: true, lovePref: pref }),

      ensureSeedPosts: () => {
        const { posts } = get();
        const now = Date.now();
        const missing = SQUARE_POSTS.filter(
          (s) => !posts.some((p) => p.id === `sq-${s.characterId}`)
        );
        if (missing.length === 0) return;
        const seeded: Post[] = missing.map((s) => ({
          id: `sq-${s.characterId}`,
          characterId: s.characterId,
          text: s.text,
          at: now - s.hoursAgo * 3600000,
          likes: s.likes,
          liked: false,
          comments: [],
        }));
        set({ posts: [...posts, ...seeded] });
      },

      ensureSquareChat: (characterId) => {
        const { squareChats } = get();
        const now = Date.now();
        const existing = squareChats[characterId];
        if (existing && now - existing.lastActiveAt > SQUARE_CHAT_TTL_MS) {
          set({
            squareChats: {
              ...squareChats,
              [characterId]: {
                characterId,
                messages: [],
                startedAt: now,
                lastActiveAt: now,
                adoptionOffered: false,
                userTurns: 0,
              },
            },
          });
          return true;
        }
        if (!existing) {
          set({
            squareChats: {
              ...squareChats,
              [characterId]: {
                characterId,
                messages: [],
                startedAt: now,
                lastActiveAt: now,
                adoptionOffered: false,
                userTurns: 0,
              },
            },
          });
        }
        return false;
      },

      appendSquare: (characterId, msgs, opts) => {
        const { squareChats } = get();
        const chat = squareChats[characterId];
        if (!chat) return;
        set({
          squareChats: {
            ...squareChats,
            [characterId]: {
              ...chat,
              messages: [...chat.messages, ...msgs],
              lastActiveAt: Date.now(),
              userTurns: chat.userTurns + (opts?.userTurn ? 1 : 0),
              adoptionOffered: chat.adoptionOffered || !!opts?.offered,
            },
          },
        });
      },

      createBond: ({ characterId, name, nickname, birthday }) => {
        const state = get();
        const character =
          CHARACTERS.find((c) => c.id === characterId) ??
          state.customCharacters.find((c) => c.id === characterId);
        if (!character) return '';
        const script = scriptFor(character);
        const now = Date.now();
        const arrival = nextEightPM(new Date(now));
        const timeLabel = arrivalTimeLabel(arrival.getTime(), new Date(now));

        // 迁移仪式：搭话记录随关系升级并入羁绊（记忆从这里开始归他所有）
        const squareMsgs = state.squareChats[characterId]?.messages ?? [];
        const farewell: ChatMessage[] = script.farewell.map((f, i) => ({
          id: uid('m'),
          from: 'him',
          kind: f.kind ?? 'text',
          text: f.text.replace('{time}', timeLabel),
          at: now + i,
        }));
        const ceremony: ChatMessage = {
          id: uid('m'),
          from: 'system',
          kind: 'system',
          text: `你们交换了联系方式 · 他开始叫你「${nickname}」`,
          at: now - 1,
        };

        const bond: Bond = {
          id: uid('b'),
          characterId,
          name,
          nickname,
          birthday,
          createdAt: now,
          affinity: 10 + squareMsgs.length,
          messages: [...squareMsgs, ceremony, ...farewell],
          arrivalAt: arrival.getTime(),
          unread: 0,
          // 他先走：开门之前是离席态，不回消息（D-012）
          away: true,
        };

        // 领养后帖物化进动态流
        const bondedSeeds = bondedPostsFor(character);
        const bondedPosts: Post[] = bondedSeeds.map((p) => ({
          id: uid('p'),
          characterId,
          bondId: bond.id,
          text: p.text,
          at: now - p.hoursAgo * 3600000,
          likes: p.likes,
          liked: false,
          comments: [],
        }));

        const remaining = { ...state.squareChats };
        delete remaining[characterId];

        set({
          bonds: [...state.bonds, bond],
          squareChats: remaining,
          posts: [...state.posts, ...bondedPosts],
        });
        return bond.id;
      },

      setBondNotif: (bondId, notifId) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, notifId } : b)),
        }),

      appendBond: (bondId, msgs, opts) =>
        set({
          bonds: get().bonds.map((b) =>
            b.id === bondId
              ? {
                  ...b,
                  messages: [...b.messages, ...msgs],
                  affinity: b.affinity + (opts?.affinityDelta ?? 0),
                  unread: b.unread + (opts?.unreadDelta ?? 0),
                }
              : b
          ),
        }),

      markBondRead: (bondId) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, unread: 0 } : b)),
        }),

      markAwayNotified: (bondId) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, awayNotified: true } : b)),
        }),

      setBondMemory: (bondId, memory) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, memory } : b)),
        }),

      deliverDueArrivals: () => {
        const now = Date.now();
        const delivered: string[] = [];
        const bonds = get().bonds.map((b) => {
          if (!b.arrivalAt || b.arrivalAt > now) return b;
          const character =
            CHARACTERS.find((c) => c.id === b.characterId) ??
            get().customCharacters.find((c) => c.id === b.characterId);
          if (!character) return b;
          const script = scriptFor(character);
          const msgs: ChatMessage[] = script.arrival.map((a, i) => ({
            id: uid('m'),
            from: 'him',
            kind: a.kind ?? 'text',
            text: a.text,
            at: b.arrivalAt! + i,
          }));
          delivered.push(b.id);
          return {
            ...b,
            messages: [...b.messages, ...msgs],
            affinity: b.affinity + 3,
            unread: b.unread + msgs.length,
            arrivalAt: nextEightPM(new Date(now)).getTime(),
            notifId: undefined,
            away: false,
            awayNotified: false,
          };
        });
        if (delivered.length) set({ bonds });
        return delivered;
      },

      toggleLike: (postId) =>
        set({
          posts: get().posts.map((p) =>
            p.id === postId
              ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
              : p
          ),
        }),

      addMyComment: (postId, text) =>
        set({
          posts: get().posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    { id: uid('c'), from: 'me' as const, text, at: Date.now() },
                  ],
                }
              : p
          ),
        }),

      addHisReply: (postId) => {
        const post = get().posts.find((p) => p.id === postId);
        if (!post) return;
        const character =
          CHARACTERS.find((c) => c.id === post.characterId) ??
          get().customCharacters.find((c) => c.id === post.characterId);
        if (!character) return;
        const reply = scriptFor(character).commentReply;
        if (post.comments.some((c) => c.from === 'him')) return;
        set({
          posts: get().posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    { id: uid('c'), from: 'him' as const, text: reply, at: Date.now() },
                  ],
                }
              : p
          ),
        });
      },

      addCustomCharacter: (c) => set({ customCharacters: [...get().customCharacters, c] }),
      setPortrait: (characterId, uri) =>
        set({ portraits: { ...get().portraits, [characterId]: uri } }),

      setDesktopOrder: (order) => set({ desktopOrder: order }),
      setWallpaper: (id) => set({ wallpaper: id }),
      addUserEvent: (e) =>
        set({
          userEvents: [...get().userEvents, e].sort((a, b) => a.date.localeCompare(b.date)),
        }),
      removeUserEvent: (id) => set({ userEvents: get().userEvents.filter((e) => e.id !== id) }),
      markEventStage: (id, stage) =>
        set({
          userEvents: get().userEvents.map((e) => (e.id === id ? { ...e, [stage]: true } : e)),
        }),

      setEngine: (e) => set({ engine: e }),
      setAnthropicKey: (k) => set({ anthropicKey: k }),
      setQianfanKey: (k) => set({ qianfanKey: k }),

      devSetArrivalSoon: (minutes) => {
        const bond = get().bonds[0];
        if (!bond) return null;
        const at = Date.now() + minutes * 60000;
        set({
          bonds: get().bonds.map((b) =>
            b.id === bond.id ? { ...b, arrivalAt: at, notifId: undefined } : b
          ),
        });
        return bond.id;
      },

      resetAll: () => set({ ...initialData, firstOpenAt: Date.now() }),
    }),
    {
      name: 'everylove-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // v2：种子角色改版（陆隽行下架、人外上新），清掉指向已删除角色的数据
      migrate: (persisted: unknown, version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (!state || version >= 2) return state;
        const seedIds = new Set(CHARACTERS.map((c) => c.id));
        const customIds = new Set((state.customCharacters ?? []).map((c) => c.id));
        const valid = (id: string) => seedIds.has(id) || customIds.has(id);
        state.bonds = (state.bonds ?? []).filter((b) => valid(b.characterId));
        state.squareChats = Object.fromEntries(
          Object.entries(state.squareChats ?? {}).filter(([id]) => valid(id))
        );
        state.posts = (state.posts ?? []).filter((p) => valid(p.characterId));
        return state;
      },
    }
  )
);

/** AsyncStorage 水合完成后才为 true；水合前渲染要拿持久化状态做判断的组件应先返回 null */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(useAppStore.persist.hasHydrated());
  useEffect(() => useAppStore.persist.onFinishHydration(() => setHydrated(true)), []);
  return hydrated;
}

export function findCharacter(id: string): Character | undefined {
  return (
    CHARACTERS.find((c) => c.id === id) ??
    useAppStore.getState().customCharacters.find((c) => c.id === id)
  );
}

export function findBond(bondId: string): Bond | undefined {
  return useAppStore.getState().bonds.find((b) => b.id === bondId);
}

/** 亲密度阶段标签 */
// 亲密度阶段名已移到 lib/format.ts（prompts.ts 也要用，避免循环引用）；这里保留导出兼容旧 import
export { affinityStage } from '@/lib/format';

/**
 * 全局状态：zustand + AsyncStorage 持久化。
 * - squareChats：交友配对记录（滑到即配对 D-040；3 天不聊过期，免费层商业承重墙）
 * - bonds：羁绊，个体层独立状态机（亲密度 / 记忆 / 开门排程）
 * - posts：动态流（广场公开帖 + 领养后物化帖）
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { bondedPostsFor, CHARACTERS, scriptFor, SQUARE_POSTS } from '@/content/characters';
import { uid } from '@/lib/format';
import { applyThemeColors } from '@/constants/theme';
import { bondLevel, levelLabel } from '@/lib/bond';
import { setLang } from '@/lib/i18n';
import { DEFAULT_DOCK } from '@/constants/apps';
import { placeById } from '@/content/places';
import type {
  Bond,
  BondMemory,
  CalendarEvent,
  Character,
  ChatMessage,
  LovePref,
  OutingPlan,
  OutingSession,
  Post,
  SquareChat,
  UserProfile,
} from '@/lib/types';

/** 搭话记录过期时长：3 天（免费层天花板是商业决策，不是产品缺陷） */
export const SQUARE_CHAT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

interface AppState {
  onboarded: boolean;
  /** 界面语言（D-066）：onboarding 第 0 步选择；真模型输出语言跟随（prompts 语言行） */
  language: 'zh' | 'en' | 'ja';
  /** 新手流（D-058）：onboarding 后直接落交友滑卡；首次加好友或点「先逛逛」后才放行桌面 */
  introDone: boolean;
  /** 桌面揭幕 + 气泡标注是否已看过（首次加好友后播一次） */
  introRevealSeen: boolean;
  lovePref?: LovePref;
  /** 「我」的默认身份（D-035）：onboarding 时建立，设置 → 我的身份 里补充 */
  me?: UserProfile;
  /** 为单个角色定制的身份（按角色 id；没有的角色用默认身份） */
  meByCharacter: Record<string, UserProfile>;
  firstOpenAt: number;
  squareChats: Record<string, SquareChat>;
  bonds: Bond[];
  customCharacters: Character[];
  /** 共享角色池缓存（D-060）：别人公开的角色（本地缓存，lib/pool.ts 定时刷新） */
  sharedPool: Character[];
  sharedPoolAt: number;
  /** 订阅计划（D-063 试装模拟）：free 1 槽 / pro 5 槽 / max 不限 */
  plan: 'free' | 'pro' | 'max';
  posts: Post[];
  /** 角色立绘（本机文件 URI），按角色 id；作为后续所有生图的参考图（D-019） */
  portraits: Record<string, string>;
  /** 手机壳桌面（D-020/D-021）：图标顺序（旧模型，作迁移源保留）与壁纸 id */
  desktopOrder: string[];
  /** 桌面自由格位（D-034）：appId → 格位序号（行优先），允许留空格 */
  desktopSlots: Record<string, number>;
  /** 底部 Dock（D-044）：固定在桌面底部的 App id，最多 4 个 */
  desktopDock: string[];
  wallpaper: string;
  /** 主题配色 id（constants/theme.ts THEMES，D-030） */
  themeId: string;
  /** 日历用户层日程（D-020） */
  userEvents: CalendarEvent[];
  /** 发帖调度（D-055）：characterId → 下一条帖子的到点时间（频率按 MBTI，lib/posts.ts） */
  postSchedule: Record<string, number>;
  /** 交友左滑略过记录（D-041）：characterId → 最近一次略过的时间戳（进推荐算法的冷却项） */
  datingPasses: Record<string, number>;
  /** 交友视图（D-049）：滑卡 / 双列瀑布流 */
  datingView: 'swipe' | 'grid';
  /** 外出约定（D-038）：每个角色最多一条 */
  outingPlans: OutingPlan[];
  /** 当前外出场景会话（同一时间只有一场；结束后清空） */
  outingSession: OutingSession | null;

  completeOnboarding: (pref: LovePref) => void;
  setLanguage: (l: 'zh' | 'en' | 'ja') => void;
  /** 新手流逃生门 / 完成（D-058） */
  setIntroDone: () => void;
  setIntroRevealSeen: () => void;
  /** 交友偏好（D-049）：随时改口味（原只在 onboarding 定一次） */
  setLovePref: (pref: LovePref) => void;
  setDatingView: (v: 'swipe' | 'grid') => void;
  /** 交友左滑：记一笔略过（略过不是拉黑，冷却后回流牌堆，D-041） */
  markDatingPass: (characterId: string) => void;
  setMe: (p: UserProfile) => void;
  /** 为单个角色设置独立身份；传 undefined = 恢复使用默认身份 */
  setMeForCharacter: (characterId: string, p?: UserProfile) => void;
  ensureSeedPosts: () => void;
  /** 确保配对记录存在（交友滑卡配对 / 打开会话时）：过期则清空重来（TA 忘记你了）。返回是否刚过期。 */
  ensureSquareChat: (characterId: string) => boolean;
  appendSquare: (
    characterId: string,
    msgs: ChatMessage[],
    opts?: { userTurn?: boolean; offered?: boolean; heartDelta?: number }
  ) => void;
  createBond: (input: {
    characterId: string;
    name: string;
    nickname: string;
    birthday?: string;
  }) => string;
  appendBond: (
    bondId: string,
    msgs: ChatMessage[],
    opts?: { affinityDelta?: number; unreadDelta?: number }
  ) => void;
  markBondRead: (bondId: string) => void;
  /** LINE 规则（D-030）：撤回=占位+清内容（仅自己的消息、24h 内，界面侧把关）；删除=本地移除任意消息 */
  recallMessage: (scope: { bondId?: string; characterId?: string }, msgId: string) => void;
  deleteMessage: (scope: { bondId?: string; characterId?: string }, msgId: string) => void;
  /** 写入羁绊记忆库（由 lib/memory.ts 后台提取后调用，D-016） */
  setBondMemory: (bondId: string, memory: BondMemory) => void;
  toggleLike: (postId: string) => void;
  addMyComment: (postId: string, text: string) => void;
  /** 发帖调度（D-055） */
  setPostDue: (characterId: string, at: number) => void;
  addCharacterPost: (characterId: string, bondId: string, text: string) => void;
  /** TA 的回帖（D-053）：文本由调用方生成（模型或台词库回落），可多次回复 */
  addHisReply: (postId: string, text: string) => void;
  addCustomCharacter: (c: Character) => void;
  setSharedPool: (chars: Character[]) => void;
  setPlan: (p: 'free' | 'pro' | 'max') => void;
  /** 编辑已创建的角色（D-050）：原位更新；同名的羁绊备注跟着改 */
  updateCustomCharacter: (c: Character) => void;
  setPortrait: (characterId: string, uri: string) => void;
  setDesktopOrder: (order: string[]) => void;
  setDesktopSlots: (slots: Record<string, number>) => void;
  setDesktopDock: (ids: string[]) => void;
  setWallpaper: (id: string) => void;
  setThemeId: (id: string) => void;
  addUserEvent: (e: CalendarEvent) => void;
  removeUserEvent: (id: string) => void;
  /** 心跳三段式：标记某段已投递（lib/heartbeat.ts） */
  markEventStage: (id: string, stage: 'caredBefore' | 'caredDay' | 'caredAfter') => void;
  /** 外出（D-038）：立一个约定（同角色只保留最新一条），并在羁绊会话留系统记录 */
  addOutingPlan: (characterId: string, placeId: string) => void;
  removeOutingPlan: (id: string) => void;
  /**
   * 进入地点开一场外出：该地点有约定 → 赴约（消耗约定）；没有 → 偶遇一位通讯录里的 TA
   * （跳过离席中的；赴约不跳过——TA 说到做到）。没有可遇的人返回 null。
   * 若已有同地点的进行中会话则续上。
   */
  startOuting: (placeId: string) => OutingSession | null;
  appendOuting: (msgs: ChatMessage[]) => void;
  /** 结束外出：聊过的话在羁绊会话留一条系统记录，然后清空场景 */
  endOuting: () => void;
  resetAll: () => void;
}

const initialData = {
  onboarded: false,
  language: 'zh' as 'zh' | 'en' | 'ja',
  introDone: false,
  introRevealSeen: false,
  lovePref: undefined as LovePref | undefined,
  me: undefined as UserProfile | undefined,
  meByCharacter: {} as Record<string, UserProfile>,
  firstOpenAt: Date.now(),
  squareChats: {} as Record<string, SquareChat>,
  bonds: [] as Bond[],
  customCharacters: [] as Character[],
  sharedPool: [] as Character[],
  sharedPoolAt: 0,
  plan: 'free' as 'free' | 'pro' | 'max',
  posts: [] as Post[],
  portraits: {} as Record<string, string>,
  desktopOrder: [] as string[],
  desktopSlots: {} as Record<string, number>,
  desktopDock: DEFAULT_DOCK,
  wallpaper: 'dawn',
  themeId: 'peach',
  userEvents: [] as CalendarEvent[],
  postSchedule: {} as Record<string, number>,
  datingPasses: {} as Record<string, number>,
  datingView: 'swipe' as 'swipe' | 'grid',
  outingPlans: [] as OutingPlan[],
  outingSession: null as OutingSession | null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData,

      completeOnboarding: (pref) => set({ onboarded: true, lovePref: pref }),

      setLanguage: (l) => {
        setLang(l);
        set({ language: l });
      },

      setIntroDone: () => set({ introDone: true }),
      setIntroRevealSeen: () => set({ introRevealSeen: true }),

      setLovePref: (pref) => set({ lovePref: pref }),
      setDatingView: (v) => set({ datingView: v }),

      markDatingPass: (characterId) =>
        set({ datingPasses: { ...get().datingPasses, [characterId]: Date.now() } }),

      setMe: (p) => set({ me: p }),
      setMeForCharacter: (characterId, p) => {
        const next = { ...get().meByCharacter };
        if (p) next[characterId] = p;
        else delete next[characterId];
        set({ meByCharacter: next });
      },

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
        const { squareChats, customCharacters } = get();
        const now = Date.now();
        const existing = squareChats[characterId];
        // 你创造的 TA 不会忘记你（D-052）：自创角色的暧昧期不过期（共享池领来的不算，照常过期）
        const isOwnCreation = customCharacters.some((c) => c.id === characterId && !c.shared);
        if (existing && !isOwnCreation && now - existing.lastActiveAt > SQUARE_CHAT_TTL_MS) {
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
                heart: 0,
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
                heart: 0,
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
              heart: Math.min(100, (chat.heart ?? 0) + (opts?.heartDelta ?? 0)),
              adoptionOffered: chat.adoptionOffered || !!opts?.offered,
            },
          },
        });
      },

      createBond: ({ characterId, name, nickname, birthday }) => {
        const state = get();
        const character =
          CHARACTERS.find((c) => c.id === characterId) ??
          state.customCharacters.find((c) => c.id === characterId) ??
          state.sharedPool.find((c) => c.id === characterId);
        if (!character) return '';
        // 领养快照制（§5/D-060）：共享池角色缔结时快照进本地——创作者更新不改写已领养实例
        if (character.shared && !state.customCharacters.some((c) => c.id === characterId)) {
          set({ customCharacters: [...state.customCharacters, { ...character }] });
        }
        const script = scriptFor(character);
        const now = Date.now();

        // 迁移仪式：搭话/暧昧期记录随关系升级并入羁绊（记忆从这里开始归他所有）
        const squareMsgs = state.squareChats[characterId]?.messages ?? [];
        const ceremony: ChatMessage = {
          id: uid('m'),
          from: 'system',
          kind: 'system',
          text: character.custom
            ? `你们确定了关系 · 这一次，是 TA 自己选择留下 · TA 开始叫你「${nickname}」`
            : `你们交换了联系方式 · 他开始叫你「${nickname}」`,
          at: now - 1,
        };
        // 开门已下线（D-046）：加好友即在线——TA 直接开口打招呼（原开门台词转为见面第一句）
        const greeting: ChatMessage[] = script.arrival.map((a, i) => ({
          id: uid('m'),
          from: 'him',
          kind: a.kind ?? 'text',
          text: a.text,
          at: now + i,
        }));

        const bond: Bond = {
          id: uid('b'),
          characterId,
          name,
          nickname,
          birthday,
          createdAt: now,
          affinity: 0, // 羁绊 LV1 从零开始（心动值已在暧昧期满 100，D-029/D-052）
          messages: [...squareMsgs, ceremony, ...greeting],
          // 缔结后落桌面（D-058 方案 B）：打招呼计未读——桌面横幅就是「点进去」的教学
          unread: greeting.length,
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
          // 首次加好友 = 新手流完成（D-058）：桌面从此放行，并在首次进入时揭幕
          introDone: true,
        });
        return bond.id;
      },

      appendBond: (bondId, msgs, opts) =>
        set({
          bonds: get().bonds.map((b) => {
            if (b.id !== bondId) return b;
            const nextXp = b.affinity + (opts?.affinityDelta ?? 0);
            const leveled = bondLevel(nextXp) > bondLevel(b.affinity);
            // 升级瞬间：会话里出现系统提示（成长可感知，D-029）
            const extra: ChatMessage[] = leveled
              ? [
                  {
                    id: uid('m'),
                    from: 'system' as const,
                    kind: 'system' as const,
                    text: `羁绊升级 · ${levelLabel(nextXp)}`,
                    at: Date.now(),
                  },
                ]
              : [];
            return {
              ...b,
              messages: [...b.messages, ...msgs, ...extra],
              affinity: nextXp,
              unread: b.unread + (opts?.unreadDelta ?? 0),
            };
          }),
        }),

      markBondRead: (bondId) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, unread: 0 } : b)),
        }),

      recallMessage: ({ bondId, characterId }, msgId) => {
        const wipe = (m: ChatMessage): ChatMessage =>
          m.id === msgId
            ? { id: m.id, from: m.from, kind: 'text', text: '', at: m.at, recalled: true }
            : m;
        if (bondId) {
          set({
            bonds: get().bonds.map((b) =>
              b.id === bondId ? { ...b, messages: b.messages.map(wipe) } : b
            ),
          });
        } else if (characterId) {
          const chat = get().squareChats[characterId];
          if (!chat) return;
          set({
            squareChats: {
              ...get().squareChats,
              [characterId]: { ...chat, messages: chat.messages.map(wipe) },
            },
          });
        }
      },

      deleteMessage: ({ bondId, characterId }, msgId) => {
        if (bondId) {
          set({
            bonds: get().bonds.map((b) =>
              b.id === bondId ? { ...b, messages: b.messages.filter((m) => m.id !== msgId) } : b
            ),
          });
        } else if (characterId) {
          const chat = get().squareChats[characterId];
          if (!chat) return;
          set({
            squareChats: {
              ...get().squareChats,
              [characterId]: { ...chat, messages: chat.messages.filter((m) => m.id !== msgId) },
            },
          });
        }
      },

      setBondMemory: (bondId, memory) =>
        set({
          bonds: get().bonds.map((b) => (b.id === bondId ? { ...b, memory } : b)),
        }),

      toggleLike: (postId) =>
        set({
          posts: get().posts.map((p) =>
            p.id === postId
              ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
              : p
          ),
        }),

      setPostDue: (characterId, at) =>
        set({ postSchedule: { ...get().postSchedule, [characterId]: at } }),

      addCharacterPost: (characterId, bondId, text) =>
        set({
          posts: [
            ...get().posts,
            {
              id: uid('p'),
              characterId,
              bondId,
              text,
              at: Date.now(),
              // 小体量互动数：确定性伪随机（羁绊层帖子的量级，D-055）
              likes: 40 + ((text.length * 37 + characterId.length * 13) % 220),
              liked: false,
              comments: [],
            },
          ],
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

      addHisReply: (postId, text) =>
        set({
          posts: get().posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    { id: uid('c'), from: 'him' as const, text, at: Date.now() },
                  ],
                }
              : p
          ),
        }),

      addCustomCharacter: (c) => set({ customCharacters: [...get().customCharacters, c] }),
      setSharedPool: (chars) => set({ sharedPool: chars, sharedPoolAt: Date.now() }),
      setPlan: (p) => set({ plan: p }),
      updateCustomCharacter: (c) => {
        const prev = get().customCharacters.find((x) => x.id === c.id);
        set({
          customCharacters: get().customCharacters.map((x) => (x.id === c.id ? c : x)),
          // 她没改过备注的话，通讯录名字跟着新设定走
          bonds: get().bonds.map((b) =>
            b.characterId === c.id && prev && b.name === prev.name ? { ...b, name: c.name } : b
          ),
        });
      },
      setPortrait: (characterId, uri) =>
        set({ portraits: { ...get().portraits, [characterId]: uri } }),

      setDesktopOrder: (order) => set({ desktopOrder: order }),
      setDesktopSlots: (slots) => set({ desktopSlots: slots }),
      setDesktopDock: (ids) => set({ desktopDock: ids.slice(0, 4) }),
      setWallpaper: (id) => set({ wallpaper: id }),
      setThemeId: (id) => {
        applyThemeColors(id);
        set({ themeId: id });
      },
      addUserEvent: (e) =>
        set({
          userEvents: [...get().userEvents, e].sort((a, b) => a.date.localeCompare(b.date)),
        }),
      removeUserEvent: (id) => set({ userEvents: get().userEvents.filter((e) => e.id !== id) }),
      markEventStage: (id, stage) =>
        set({
          userEvents: get().userEvents.map((e) => (e.id === id ? { ...e, [stage]: true } : e)),
        }),

      addOutingPlan: (characterId, placeId) => {
        const state = get();
        const place = placeById(placeId);
        if (!place) return;
        const plan: OutingPlan = { id: uid('op'), characterId, placeId, createdAt: Date.now() };
        // 羁绊会话里留下这条约定（可感知；也给记忆提取一个钩子之外的人肉锚点）
        const bond = state.bonds.find((b) => b.characterId === characterId);
        set({
          outingPlans: [...state.outingPlans.filter((p) => p.characterId !== characterId), plan],
          bonds: bond
            ? state.bonds.map((b) =>
                b.id === bond.id
                  ? {
                      ...b,
                      messages: [
                        ...b.messages,
                        {
                          id: uid('m'),
                          from: 'system' as const,
                          kind: 'system' as const,
                          text: `你们约好了去${place.name}见面 · 到「外出」里赴约`,
                          at: Date.now(),
                        },
                      ],
                    }
                  : b
              )
            : state.bonds,
        });
      },

      removeOutingPlan: (id) =>
        set({ outingPlans: get().outingPlans.filter((p) => p.id !== id) }),

      startOuting: (placeId) => {
        // 同地点的进行中会话：续上（离开再进来 TA 还在）；换了地点则先体面结束上一场
        if (get().outingSession?.placeId === placeId) {
          return get().outingSession;
        }
        if (get().outingSession) get().endOuting();
        const state = get();
        const place = placeById(placeId);
        const plan = state.outingPlans.find((p) => p.placeId === placeId);
        let characterId: string | undefined;
        let kind: OutingSession['kind'] = 'encounter';
        if (place?.stranger) {
          // 广场（D-040）：直接偶遇陌生人——还没加好友的角色（不含预告卡）。
          // 优先还没配对过的新面孔，其次配对过但没加好友的；口味（lovePref）优先。
          const bondedIds = new Set(state.bonds.map((b) => b.characterId));
          const matchedIds = new Set(Object.keys(state.squareChats));
          const pool = [...state.customCharacters, ...CHARACTERS].filter(
            (c) => !c.teaser && !bondedIds.has(c.id)
          );
          const fresh = pool.filter((c) => !matchedIds.has(c.id));
          const base = fresh.length ? fresh : pool;
          const preferred =
            state.lovePref && state.lovePref !== 'any'
              ? base.filter((c) => c.loveTag === state.lovePref)
              : [];
          const candidates = preferred.length ? preferred : base;
          if (!candidates.length) return null;
          characterId = candidates[Math.floor(Math.random() * candidates.length)].id;
          kind = 'stranger';
        } else if (plan) {
          // 赴约：约定优先于离席——TA 说到做到
          characterId = plan.characterId;
          kind = 'date';
        } else {
          // 偶遇：通讯录里的人恰好也在（离席态已随开门一起退役，D-046）
          const candidates = state.bonds;
          if (!candidates.length) return null;
          const pickIdx = Math.floor(Math.random() * candidates.length);
          characterId = candidates[pickIdx].characterId;
        }
        const session: OutingSession = {
          id: uid('o'),
          placeId,
          characterId,
          kind,
          messages: [],
          startedAt: Date.now(),
        };
        set({
          outingSession: session,
          outingPlans: plan ? state.outingPlans.filter((p) => p.id !== plan.id) : state.outingPlans,
        });
        return session;
      },

      appendOuting: (msgs) => {
        const session = get().outingSession;
        if (!session) return;
        set({ outingSession: { ...session, messages: [...session.messages, ...msgs] } });
      },

      endOuting: () => {
        const state = get();
        const session = state.outingSession;
        if (!session) return;
        const place = placeById(session.placeId);
        const bond = state.bonds.find((b) => b.characterId === session.characterId);
        const talked = session.messages.some((m) => m.from === 'me' && m.kind === 'text');
        // 外出拍的照片是资产（D-051）：并进羁绊会话——相册按 bond.messages 汇集
        const photos = session.messages.filter((m) => m.kind === 'image' && m.imageUri);
        set({
          outingSession: null,
          bonds:
            bond && place && (talked || photos.length)
              ? state.bonds.map((b) =>
                  b.id === bond.id
                    ? {
                        ...b,
                        messages: [
                          ...b.messages,
                          ...photos.map((p) => ({ ...p, id: uid('m') })),
                          {
                            id: uid('m'),
                            from: 'system' as const,
                            kind: 'system' as const,
                            text: `你们一起去了${place.name}`,
                            at: Date.now(),
                          },
                        ],
                      }
                    : b
                )
              : state.bonds,
        });
      },

      resetAll: () => set({ ...initialData, firstOpenAt: Date.now() }),
    }),
    {
      name: 'everylove-store',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      // v2：种子角色改版（陆隽行下架、人外上新），清掉指向已删除角色的数据
      // v3：新手流标记（D-058）——已有存档的老用户不重走新手流
      // v4：Dock 默认收窄为通讯录+设置（D-064）——仍是旧默认的存档跟随新默认
      // v5：引擎与 key 不再是用户数据（D-069）——清掉旧存档/云端快照里的 engine/anthropicKey/qianfanKey
      migrate: (persisted: unknown, version) => {
        const state = persisted as (Partial<AppState> & Record<string, unknown>) | undefined;
        if (!state) return state;
        if (version < 5) {
          delete state.engine;
          delete state.anthropicKey;
          delete state.qianfanKey;
        }
        if (version < 2) {
          const seedIds = new Set(CHARACTERS.map((c) => c.id));
          const customIds = new Set((state.customCharacters ?? []).map((c) => c.id));
          const valid = (id: string) => seedIds.has(id) || customIds.has(id);
          state.bonds = (state.bonds ?? []).filter((b) => valid(b.characterId));
          state.squareChats = Object.fromEntries(
            Object.entries(state.squareChats ?? {}).filter(([id]) => valid(id))
          );
          state.posts = (state.posts ?? []).filter((p) => valid(p.characterId));
        }
        if (version < 3) {
          state.introDone = true;
          state.introRevealSeen = true;
        }
        if (version < 4) {
          const oldDefault = ['messages', 'dating', 'outing', 'settings'];
          if (JSON.stringify(state.desktopDock ?? []) === JSON.stringify(oldDefault)) {
            state.desktopDock = DEFAULT_DOCK;
          }
        }
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
  const s = useAppStore.getState();
  return (
    CHARACTERS.find((c) => c.id === id) ??
    s.customCharacters.find((c) => c.id === id) ??
    s.sharedPool.find((c) => c.id === id)
  );
}

export function findBond(bondId: string): Bond | undefined {
  return useAppStore.getState().bonds.find((b) => b.id === bondId);
}

/** 某角色眼中的「我」（D-035）：定制身份优先，其次默认身份 */
export function meForCharacter(characterId: string): UserProfile | undefined {
  const s = useAppStore.getState();
  return s.meByCharacter[characterId] ?? s.me;
}

/** 亲密度阶段标签 */
// 亲密度阶段名已移到 lib/format.ts（prompts.ts 也要用，避免循环引用）；这里保留导出兼容旧 import
export { affinityStage } from '@/lib/format';

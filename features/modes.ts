/**
 * 四种会话模式（D-086）：初识（交友试聊）/ 亲密（羁绊会话）/ 外出（现场）/ 通话。
 * 每种只回答五个问题：历史在哪、消息落到哪、她开口算什么账、组什么上下文、回复怎么拆。
 * 界面与后台都通过 core/turn 的管线用它们，不再各自拼 EngineContext。
 */

import { placeById } from '@/content/places';
import { modes, type ConversationMode, type TurnScope } from '@/core/modes';
import { appointmentAtLabel } from '@/lib/appointments';
import { anniversaryToday, type UtteranceKind } from '@/lib/bond';
import { cancelRecall } from '@/lib/recall';
import type { Bond, ChatMessage, EngineContext } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { findCharacter, meForCharacter, useAppStore } from '@/store/app-store';

/** 关系信息进引擎上下文的那一份（不整份 Bond：消息历史另走 history） */
function bondPick(bond: Bond, opts: { phone?: boolean } = {}): NonNullable<EngineContext['bond']> {
  const base = {
    name: bond.name,
    nickname: bond.nickname,
    affinity: bond.affinity,
    birthday: bond.birthday,
    createdAt: bond.createdAt,
    memory: bond.memory,
    circle: bond.circle,
    hisEvents: bond.hisEvents,
    legacyLevel: bond.legacyLevel,
    warmth: bond.warmth,
    warmthAt: bond.warmthAt,
    coldReturnAt: bond.coldReturnAt,
    wallet: bond.wallet,
    extraFired: bond.extraFired,
  };
  if (!opts.phone) return base;
  // 查手机（D-082）：TA 的手机密码第一次需要时才生成，记在这段羁绊上
  const phoneCode = useAppStore.getState().ensurePhoneCode(bond.id);
  return { ...base, phoneCode, phoneUnlocked: bond.phoneUnlocked };
}

function bondOf(scope: TurnScope): Bond | undefined {
  return scope.bondId ? useAppStore.getState().bonds.find((b) => b.id === scope.bondId) : undefined;
}

/** 她 24h 内回了 TA 主动发来的那条 */
const REPLY_REACH_WINDOW_MS = 24 * 3600_000;

/**
 * 羁绊层她开口一次的账（D-126）：按种类记来源表；顺带判两件事——
 * 回 TA 主动那条（北极星）、纪念日当天开过口；温度从 0 回来就取消召回。
 */
export function creditBondedUtterance(bond: Bond, kind: UtteranceKind = 'text'): void {
  const s = useAppStore.getState();
  const now = Date.now();
  const { returned } = s.creditBond(bond.id, kind);
  if (returned || bond.recall) void cancelRecall(bond.id);
  if (bond.lastReachAt && now - bond.lastReachAt < REPLY_REACH_WINDOW_MS && (bond.reachRepliedAt ?? 0) < bond.lastReachAt) {
    useAppStore.setState({ bonds: useAppStore.getState().bonds.map((b) => (b.id === bond.id ? { ...b, reachRepliedAt: now } : b)) });
    s.creditBond(bond.id, 'replyReach');
  }
  const character = findCharacter(bond.characterId);
  const her = meForCharacter(bond.characterId)?.birthday ?? bond.birthday;
  if (anniversaryToday({ createdAt: bond.createdAt, hisBirthday: character?.birthday, herBirthday: her }, now)) {
    s.creditBond(bond.id, 'anniversary');
  }
}

/* ── 初识：交友配对后的试聊（免费层：有心动值、没记忆，D-029） ── */
const square: ConversationMode = {
  id: 'square',
  maxBubbles: 1,
  stripStage: true,
  context(scope, userText) {
    const character = scope.characterId ? findCharacter(scope.characterId) : undefined;
    if (!character) return null;
    const chat = useAppStore.getState().squareChats[character.id];
    return {
      character,
      mode: 'square',
      me: meForCharacter(character.id),
      encounters: chat?.encounters,
      history: chat?.messages ?? [],
      userText,
    };
  },
  append(scope, msgs) {
    if (scope.characterId) useAppStore.getState().appendSquare(scope.characterId, msgs);
  },
  creditUserTurn(scope) {
    // 心动值（D-126）：这一句涨多少由模型判（features/heart.ts 的 [心动 n] 暗号），这里只记轮次
    if (scope.characterId) useAppStore.getState().appendSquare(scope.characterId, [], { userTurn: true });
  },
  patch(scope, msgId, patch) {
    useAppStore.getState().patchMessage({ characterId: scope.characterId }, msgId, patch);
  },
};

/* ── 亲密：羁绊会话（付费层：记忆、秘密、手机密码，D-016/D-045/D-082） ── */
const bonded: ConversationMode = {
  id: 'bonded',
  maxBubbles: 2,
  stripStage: true,
  context(scope, userText) {
    const bond = bondOf(scope);
    const character = bond && findCharacter(bond.characterId);
    if (!bond || !character) return null;
    return {
      character,
      mode: 'bonded',
      bond: bondPick(bond, { phone: true }),
      me: meForCharacter(character.id),
      history: bond.messages,
      userText,
    };
  },
  append(scope, msgs, opts) {
    if (scope.bondId) useAppStore.getState().appendBond(scope.bondId, msgs, { unreadDelta: opts?.unreadDelta });
  },
  creditUserTurn(scope, _text, kind) {
    const bond = bondOf(scope);
    if (bond) creditBondedUtterance(bond, kind);
  },
  patch(scope, msgId, patch) {
    useAppStore.getState().patchMessage({ bondId: scope.bondId }, msgId, patch);
  },
};

/* ── 通话（D-077）：亲密背景 + 电话口吻；电话里的话都进羁绊会话并带 viaCall ── */
const call: ConversationMode = {
  ...bonded,
  id: 'call',
  maxBubbles: 1,
  context(scope, userText) {
    const ctx = bonded.context(scope, userText);
    return ctx ? { ...ctx, mode: 'call' } : null;
  },
  append(scope, msgs, opts) {
    const tagged: ChatMessage[] = msgs.map((m) => (m.from === 'system' ? m : { ...m, viaCall: true }));
    bonded.append(scope, tagged, opts);
  },
};

/* ── 外出（D-038/D-040/D-079）：同一时间只有一场；赴约 / 偶遇带关系背景，陌生人不带 ── */
const outing: ConversationMode = {
  id: 'outing',
  maxBubbles: 1,
  stripStage: false,
  context(scope, userText) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (!session || session.characterId !== scope.characterId) return null;
    const character = findCharacter(session.characterId);
    const place = placeById(session.placeId);
    if (!character || !place) return null;
    const bond = s.bonds.find((b) => b.characterId === session.characterId);
    // 陌生人在现场交换了联系方式后（D-056），这场偶遇就地升格为熟人偶遇
    const kind = session.kind === 'stranger' && bond ? 'encounter' : session.kind;
    return {
      character,
      mode: 'outing',
      bond: bond ? bondPick(bond) : undefined,
      me: meForCharacter(character.id),
      // 陌生人也记得上次在广场见过她（D-110）
      encounters: kind === 'stranger' ? s.squareChats[character.id]?.encounters : undefined,
      outing: {
        placeName: place.name,
        scene: place.scene,
        kind,
        weatherLine: weatherLine(),
        appointment: session.planAt
          ? { atLabel: appointmentAtLabel(session.planAt), lateMinutes: session.lateMinutes ?? 0 }
          : undefined,
      },
      history: session.messages,
      userText,
    };
  },
  append(_scope, msgs) {
    useAppStore.getState().appendOuting(msgs);
  },
  creditUserTurn(scope, _text, kind) {
    const s = useAppStore.getState();
    const bond = s.bonds.find((b) => b.characterId === scope.characterId);
    if (bond) {
      // 她开口 = 来源表记账（升级系统提示会出现在羁绊会话里）
      creditBondedUtterance(bond, kind);
      return;
    }
    // 陌生人偶遇也积累心动（D-056）：与交友试聊同一套心动值（记在 squareChats 上，两处共通）；涨多少由模型判
    if (!scope.characterId) return;
    s.ensureSquareChat(scope.characterId);
    useAppStore.getState().appendSquare(scope.characterId, [], { userTurn: true });
  },
  patch() {
    // 外出现场没有语音 / 照片消息需要回填
  },
};

modes.register(square);
modes.register(bonded);
modes.register(call);
modes.register(outing);

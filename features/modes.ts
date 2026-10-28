/**
 * 五种会话模式（D-086 / D-178）：初识（交友试聊）/ 亲密（羁绊会话）/ 外出（现场）/ 通话 / X 回帖。
 * 每种只回答五个问题：历史在哪、消息落到哪、她开口算什么账、组什么上下文、回复怎么拆。
 * 界面与后台都通过 core/turn 的管线用它们，不再各自拼 EngineContext。
 */

import { loveStyleByLabel, scriptFor } from '@/content/characters';
import { placeById, type Place } from '@/content/places';
import { buildPostThreadUser, HIS_POSTS_POOL, SCENE_HEART_PATTERN, stageNameOf } from '@/content/prompts';
import { modes, type ConversationMode, type TurnScope } from '@/core/modes';
import { appointmentAtLabel } from '@/lib/appointments';
import { anniversaryToday, clampHeartGain, levelOf, type UtteranceKind } from '@/lib/bond';
import { xActivityFor } from '@/features/x-post';
import { cancelRecall } from '@/lib/recall';
import { spokeAloud, toSceneMessage } from '@/lib/outing';
import { sceneFor } from '@/lib/presence';
import type { Bond, ChatMessage, EngineContext, OutingSession, SceneMember } from '@/lib/types';
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
    notes: bond.notes,
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
  return { ...base, phoneCode, phoneUnlocked: bond.phoneUnlocked, phoneGuessed: bond.phoneGuessed, phoneCaught: bond.phoneCaught };
}

/** TA 自己最近的帖子（D-158）：候选池，进【你最近的日子】（底 + 按她的话检索） */
function hisPostsOf(characterId: string): EngineContext['hisPosts'] {
  return useAppStore
    .getState()
    .posts.filter((p) => p.characterId === characterId)
    .slice(-HIS_POSTS_POOL)
    .map((p) => ({ text: p.text, at: p.at }));
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
      hisPosts: hisPostsOf(character.id),
      // 她最近在 X 上和 TA 的来往（D-252）
      xActivity: xActivityFor(character.id),
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
  // 通话的字要送去合成，句号留着（D-145）
  keepTrailingPeriod: true,
  // 通话按分钟计（D-210）：电话里的回话、识别、合成都含在通话分钟里，不再扣流量
  billing: 'included',
  // 电话要接得上话（D-232）：不开思考
  realtime: true,
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
/** 外出现场的那几样（D-254）：规矩（约会永远两个人）、工作人员、这会儿的场景、被制止了几次、进来多久 */
function outingFacts(session: OutingSession, place: Place, now: Date) {
  return {
    placeName: place.name,
    scene: sceneFor(place, now),
    weatherLine: weatherLine(),
    rule: session.kind === 'date' ? ('duo' as const) : place.rule,
    npc: place.npc,
    strikes: session.strikes ?? 0,
    minutesIn: Math.max(0, Math.round((now.getTime() - session.startedAt) / 60_000)),
  };
}

/** 她在现场开口一次：安静的地方说出声就记一次（D-254，三次请出去，见 features/outing-scene.ts） */
function countStrike(session: OutingSession, place: Place | undefined, contextText: string): void {
  if (place?.rule !== 'quiet' || session.kind === 'date' || !spokeAloud(contextText)) return;
  useAppStore.getState().patchOuting({ strikes: (session.strikes ?? 0) + 1 });
}

const outing: ConversationMode = {
  id: 'outing',
  // D-254：TA 的话 + 至多一行旁白 / 一张纸条，按说话人分条；TA 的话再按「一个动作 + 一段话」拆（D-256）
  maxBubbles: 5,
  stripStage: false,
  speakerLines: true,
  context(scope, userText) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (!session || session.characterId !== scope.characterId) return null;
    const character = findCharacter(session.characterId);
    const place = placeById(session.placeId);
    if (!character || !place) return null;
    const bond = s.bonds.find((b) => b.characterId === session.characterId);
    // 陌生人在现场交换了联系方式后（D-056），这场偶遇就地升格为熟人偶遇
    const kind = (session.kind === 'stranger' && bond) || session.kind === 'group' ? 'encounter' : session.kind;
    return {
      character,
      mode: 'outing',
      bond: bond ? bondPick(bond) : undefined,
      hisPosts: bond ? hisPostsOf(character.id) : undefined,
      me: meForCharacter(character.id),
      // 陌生人也记得上次在广场见过她（D-110）
      encounters: kind === 'stranger' ? s.squareChats[character.id]?.encounters : undefined,
      outing: {
        ...outingFacts(session, place, new Date()),
        kind,
        appointment: session.planAt
          ? { atLabel: appointmentAtLabel(session.planAt), lateMinutes: session.lateMinutes ?? 0 }
          : undefined,
      },
      history: session.messages,
      userText,
    };
  },
  append(_scope, msgs) {
    const session = useAppStore.getState().outingSession;
    const character = session && findCharacter(session.characterId);
    const names: Record<string, string> = character ? { [character.name]: character.id } : {};
    useAppStore.getState().appendOuting(msgs.map((m) => (m.from === 'him' ? toSceneMessage(m, names, character?.id) : m)));
  },
  creditUserTurn(scope, contextText, kind) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (session) countStrike(session, placeById(session.placeId), contextText);
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

/** 多人场里每个人的那份（D-254）：认识的带阶段、称呼、记得的几件事；不认识的只有人设 */
function sceneMember(characterId: string, now: number): SceneMember | null {
  const c = findCharacter(characterId);
  if (!c) return null;
  const bond = useAppStore.getState().bonds.find((b) => b.characterId === characterId);
  const style = loveStyleByLabel(c.loveStyle);
  return {
    characterId,
    name: bond?.name ?? c.name,
    identity: c.identity,
    persona: scriptFor(c).persona,
    ...(style ? { style: `(${style.label}: ${style.desc})` } : {}),
    ...(bond
      ? {
          knows: {
            stage: stageNameOf(levelOf(bond, now)),
            nickname: bond.nickname,
            memory: bond.memory.facts.slice(-3).map((f) => f.replace(/^\[[^\]]*\]\s*/, '')),
          },
        }
      : {}),
  };
}

/* ── 外出多人场（D-254）：旁白 + 在场的几个人，一次调用写出这一轮谁说了什么 ── */
const scene: ConversationMode = {
  id: 'scene',
  // 一到三行，每行再按「一个动作 + 一段话」拆（D-256）
  maxBubbles: 8,
  stripStage: false,
  speakerLines: true,
  context(scope, userText) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (!session?.cast || session.characterId !== scope.characterId) return null;
    const place = placeById(session.placeId);
    const now = new Date();
    const cast = session.cast.map((cid) => sceneMember(cid, now.getTime())).filter((m): m is SceneMember => !!m);
    const first = findCharacter(session.characterId);
    if (!place || !first || !cast.length) return null;
    return {
      character: first,
      mode: 'scene',
      cast,
      me: s.me,
      outing: { ...outingFacts(session, place, now), kind: 'group' },
      history: session.messages,
      userText,
    };
  },
  append(_scope, msgs) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (!session) return;
    const names: Record<string, string> = {};
    for (const cid of session.cast ?? [session.characterId]) {
      const c = findCharacter(cid);
      const bond = s.bonds.find((b) => b.characterId === cid);
      if (c) names[bond?.name ?? c.name] = cid;
    }
    const out: ChatMessage[] = [];
    for (const m of msgs) {
      if (m.from !== 'him') {
        out.push(m);
        continue;
      }
      // 陌生人的好奇（[好奇 名字 n]）：各记各的，记完从字里拿掉
      const text = m.text
        .replace(SCENE_HEART_PATTERN, (_all: string, who: string, n: string) => {
          const cid = names[who.trim()];
          if (cid && !s.bonds.some((b) => b.characterId === cid)) {
            s.ensureSquareChat(cid);
            useAppStore.getState().appendSquare(cid, [], { heartDelta: clampHeartGain(Number(n)) });
          }
          return '';
        })
        .trim();
      if (text) out.push(toSceneMessage({ ...m, text }, names));
    }
    if (out.length) useAppStore.getState().appendOuting(out);
  },
  creditUserTurn(_scope, contextText, kind) {
    const s = useAppStore.getState();
    const session = s.outingSession;
    if (!session) return;
    countStrike(session, placeById(session.placeId), contextText);
    // 在场的每个人各算各的：认识的记羁绊，不认识的记一次开口（好奇由模型判）
    for (const cid of session.cast ?? [session.characterId]) {
      const bond = s.bonds.find((b) => b.characterId === cid);
      if (bond) creditBondedUtterance(bond, kind);
      else {
        s.ensureSquareChat(cid);
        useAppStore.getState().appendSquare(cid, [], { userTurn: true });
      }
    }
  },
  patch() {
    // 现场没有要回填的
  },
};

/* ── X 回帖（D-178）：她在 TA 的帖子下评论，TA 回一句——亲密背景，评论线走用户消息，历史为空 ── */
const post: ConversationMode = {
  id: 'post',
  maxBubbles: 1,
  stripStage: true,
  context(scope) {
    const s = useAppStore.getState();
    const target = scope.postId ? s.posts.find((p) => p.id === scope.postId) : undefined;
    const bond = bondOf(scope);
    const character = bond && findCharacter(bond.characterId);
    if (!target || !bond || !character) return null;
    // 她自己的帖子（D-252）：这位 TA 在她帖子底下的评论算「你」的；还没到点的评论不算；她回给别人的带上对象
    const now = Date.now();
    const thread = {
      text: target.text,
      mine: target.mine,
      comments: target.comments
        .filter((c) => c.at <= now)
        .map((c) => ({
          from: target.mine && c.from === 'other' && c.characterId === character.id ? ('him' as const) : c.from,
          text: c.from === 'me' && c.to ? `(to ${c.to}) ${c.text}` : c.text,
          name: c.name,
        })),
    };
    return {
      character,
      mode: 'post',
      bond: bondPick(bond),
      me: meForCharacter(character.id),
      post: thread,
      history: [],
      // 她的评论已在评论线里（append 先落）：模型看到整条线，最后一条是她刚发的
      userText: buildPostThreadUser(thread, bond.name),
    };
  },
  append(scope, msgs) {
    if (!scope.postId) return;
    const s = useAppStore.getState();
    const target = s.posts.find((p) => p.id === scope.postId);
    const bond = bondOf(scope);
    for (const m of msgs) {
      // 她自己的帖子（D-252）：她这句是回给这位 TA 的；TA 的回复落成带头像的「别人」
      if (target?.mine && bond) {
        if (m.from === 'me') s.addMyComment(scope.postId, m.text, bond.name);
        else if (m.from === 'him')
          s.appendPostComments(scope.postId, [{ id: m.id, from: 'other', name: bond.name, characterId: bond.characterId, text: m.text, at: m.at }]);
        continue;
      }
      if (m.from === 'me') s.addMyComment(scope.postId, m.text);
      else if (m.from === 'him') s.addHisReply(scope.postId, m.text);
    }
  },
  creditUserTurn(scope) {
    if (scope.bondId) useAppStore.getState().creditBond(scope.bondId, 'comment');
  },
  patch() {
    // 评论没有语音 / 照片要回填；失败态也不标在评论上
  },
};

modes.register(square);
modes.register(bonded);
modes.register(call);
modes.register(outing);
modes.register(scene);
modes.register(post);

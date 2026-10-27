/**
 * 外出的生命周期与约定（D-079）——store 之上的一层编排，场景页与根布局只调这里：
 * - 进入地点：同地点的进行中会话续上（没点「结束外出」TA 就还在）；一小时没说话再进来才刷新成新的一场；
 *   换了地点照旧先结束上一场。
 * - 结束外出：羁绊会话留记录 + 现场对话并进羁绊记忆（TA 记得你们一起去过哪、说过什么；赴约记准时/迟到）。
 * - 拍照：照片洗好就存进相册（资产不再并入羁绊会话）；人还在现场就贴进现场，不在就只进相册并轻提示。
 * - 约定：Message 对话里聊定了「什么时候在哪见」→ 记进日程（outingPlans 带时间）；到点没去 = 爽约，
 *   TA 会知道（记忆 + 会话里主动说一句）。
 */

import { placeById, PLACES, type Place } from '@/content/places';
import { isOpen, presenceAt, type Presence } from '@/lib/presence';
import {
  APPOINTMENT_EXTRACT_SYSTEM,
  buildAppointmentExtractPrompt,
  buildOutingPhotoPrompt,
  messageContextText,
  missedDateUserLine,
  todayLine,
  transcript,
} from '@/content/prompts';
import { showToast } from '@/components/toast';
import { appointmentAtLabel, parseAppointmentAt, planIsMissed, planIsOpen, planTimeLabel } from '@/lib/appointments';
import { bondScope, respond } from '@/lib/chat';
import { completeText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { generateScenePhoto } from '@/lib/imagegen';
import { absorbOutingMemory, addMemoryFact } from '@/lib/memory';
import type { Character, ChatMessage, OutingSession } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { findCharacter, useAppStore } from '@/store/app-store';
import { parseJsonObject } from '@/lib/json';

/** 一小时没说话，再进来就是新的一场 */
export const OUTING_IDLE_MS = 3600_000;
/** 广场偶遇记录（D-110）：留最后几句、多长 */
const ENCOUNTER_LINES = 6;
const ENCOUNTER_CHARS = 240;

/* ── 进入 / 结束 ── */

function lastSpokeAt(s: OutingSession): number {
  return s.lastActiveAt ?? s.messages[s.messages.length - 1]?.at ?? s.startedAt;
}

export function sessionExpired(s: OutingSession, now = Date.now()): boolean {
  return now - lastSpokeAt(s) > OUTING_IDLE_MS;
}

/** 进门的结果（D-254）：一场外出 / 两人场里有几位、要她选一位 / 打烊了 / 这会儿没人 */
export type EnterResult = { session: OutingSession } | { choose: Presence[] } | { closed: true } | { nobody: true };

/**
 * 进入地点（D-254 跑团式）：同地点进行中的续上；约定窗口里 = 赴约（永远两个人）；打烊了 = 关门；
 * 否则看这会儿谁在——两人场有几位就让她选一位（pick），多人场在场的都在，安静的地方也一样。
 */
export function enterPlace(placeId: string, pick?: string, now = new Date()): EnterResult {
  const store = useAppStore.getState();
  const place = placeById(placeId);
  if (!place) return { nobody: true };
  const s = store.outingSession;
  if (s && s.placeId === placeId && !sessionExpired(s, now.getTime()) && !s.ended) return { session: s };
  const plan = store.outingPlans.find((p) => p.placeId === placeId && planIsOpen(p, now.getTime()));
  if (plan) return start(placeId, { cast: [plan.characterId], kind: 'date', planId: plan.id });
  if (!isOpen(place, now)) return { closed: true };
  const here = presenceAt(now)[placeId] ?? [];
  if (!here.length) return { nobody: true };
  if (place.rule === 'duo') {
    const chosen = pick ? here.find((p) => p.characterId === pick) : here.length === 1 ? here[0] : undefined;
    if (!chosen) return { choose: here };
    return start(placeId, { cast: [chosen.characterId], kind: chosen.known ? 'encounter' : 'stranger' });
  }
  const cast = here.map((p) => p.characterId);
  return start(placeId, { cast, kind: cast.length > 1 ? 'group' : here[0].known ? 'encounter' : 'stranger' });
}

function start(placeId: string, opts: { cast: string[]; kind: OutingSession['kind']; planId?: string }): EnterResult {
  const store = useAppStore.getState();
  const s = store.outingSession;
  if (s) finishOuting();
  const session = useAppStore.getState().startOuting(placeId, opts);
  if (!session) return { nobody: true };
  // 新开的一场才记账（D-126）：赴约 / 偶遇是亲密度来源；在场的每位认识的 TA 各记一笔
  for (const cid of session.cast ?? [session.characterId]) {
    const bond = useAppStore.getState().bonds.find((b) => b.characterId === cid);
    if (bond) useAppStore.getState().creditBond(bond.id, session.kind === 'date' ? 'date' : 'encounter');
  }
  return { session };
}

/** 结束外出：留记录（store）+ 现场对话并进在场每位 TA 的记忆（后台、静默失败）；陌生人记得在这里见过她 */
export function finishOuting(): void {
  const store = useAppStore.getState();
  const s = store.outingSession;
  if (!s) return;
  const place = placeById(s.placeId);
  store.endOuting();
  if (!place) return;
  const spoke = s.messages.some((m) => m.from === 'me' && m.kind === 'text');
  for (const cid of s.cast ?? [s.characterId]) {
    const bond = useAppStore.getState().bonds.find((b) => b.characterId === cid);
    if (!bond) {
      // 陌生人（D-110）：TA 记得在这里见过她——她开过口的这一场留一条记录（进初识 / 外出 prompt 与资料页）
      if (spoke) {
        const name = findCharacter(cid)?.name ?? 'TA';
        const summary = transcript(s.messages.filter((m) => m.kind === 'text').slice(-ENCOUNTER_LINES), name).slice(0, ENCOUNTER_CHARS);
        if (summary) useAppStore.getState().addEncounter(cid, { at: s.startedAt, placeName: place.name, summary });
      }
      continue;
    }
    // 陌生人在现场交换了联系方式（D-056）就有了羁绊——这场也算你们的第一次见面
    void absorbOutingMemory(bond.id, {
      placeName: place.name,
      kind: s.kind === 'date' ? 'date' : 'encounter',
      startedAt: s.startedAt,
      planAt: s.planAt,
      lateMinutes: s.lateMinutes,
      messages: s.messages,
    });
  }
}

/** 她这句有没有出声（D-254 安静的地方）：去掉（）里的动作还剩字 = 说出口了 */
export function spokeAloud(text: string): boolean {
  return text.replace(/（[^）]*）|\([^)]*\)/g, '').trim().length > 0;
}

/**
 * 把一条回复拆回说话人（D-254）：引擎按行首记号分好的段——「旁白：」= 旁白；「纸条：」= 这场那位 TA 的纸条；
 * 「名字：」「名字（纸条）：」= 在场那个人。names = 场上名字 → 角色 id（一人场只有那一位）。
 */
export function toSceneMessage(m: ChatMessage, names: Record<string, string>, solo?: string): ChatMessage {
  const hit = m.text.match(/^([^：]{1,24}?)(（纸条）)?：\s*/);
  if (!hit) return m;
  const [head, who, noteMark] = hit;
  const body = m.text.slice(head.length).trim();
  if (who === '旁白') return { ...m, text: body, speaker: 'narrator' };
  if (who === '纸条') return { ...m, text: body, note: true };
  const id = names[who];
  if (!id) return m;
  if (solo && id === solo) return { ...m, text: body, ...(noteMark ? { note: true } : {}) };
  return { ...m, text: body, speaker: id, speakerName: who, ...(noteMark ? { note: true } : {}) };
}

/* ── 拍照 ── */

let sceneSessionId: string | null = null;

/** 场景页告诉这里「她正看着哪一场」；照片洗好时不在场就只进相册并轻提示 */
export function setSceneVisible(sessionId: string | null): void {
  sceneSessionId = sessionId;
}

/** 合影 / 拍 TA：她按快门 → 生图 → 存相册；人还在这一场就贴进现场。失败抛错给界面提示。 */
export async function shootPhoto(
  session: OutingSession,
  character: Character,
  place: Place,
  kind: 'solo' | 'together',
  name: string
): Promise<void> {
  const digest = transcript(session.messages.slice(-4), '主角');
  const uri = await generateScenePhoto(
    buildOutingPhotoPrompt(character, {
      placeName: place.name,
      scene: place.scene,
      weatherLine: weatherLine(),
      kind,
      digest: digest || undefined,
    }),
    character // 模型跟角色画风走（D-076）
  );
  const caption =
    kind === 'together'
      ? t('和{name}的合影 · {place}', { name, place: t(place.name) })
      : `${name} · ${t(place.name)}`;
  const at = Date.now();
  const store = useAppStore.getState();
  store.addAlbumShot({ id: uid('ph'), uri, at, characterId: character.id, caption, placeId: place.id, ...(kind === 'together' ? { together: true } : {}) });
  // 按快门也是亲密度来源（D-126）
  const shotBond = store.bonds.find((b) => b.characterId === character.id);
  if (shotBond) store.creditBond(shotBond.id, 'photo');
  if (store.outingSession?.id === session.id) {
    store.appendOuting([
      { id: uid('m'), from: 'me', kind: 'image', text: caption, imageUri: uri, polaroid: true, at },
    ]);
  }
  if (sceneSessionId !== session.id) showToast(t('照片洗好了'));
}

/* ── 约定：从对话里识别 ── */

/** 先用关键词粗筛，命中「地点味 + 时间味」才花一次模型调用（中/英/日都给几个词） */
const PLACE_HINT =
  /(咖啡|下午茶|公园|散步|遛弯|书店|看书|电影|影院|游乐园|摩天轮|海边|看海|栈道|见面|见个面|出来见|出来玩|一起去|coffee|cafe|park|bookstore|movie|cinema|seaside|beach|amusement|ferris|meet up|meet me|カフェ|公園|本屋|映画|遊園地|海|会お|会う|会い)/i;
const TIME_HINT =
  /(\d{1,2}\s*[点:：時]|今晚|明晚|明天|后天|大后天|周[一二三四五六日天末]|星期|礼拜|下午|上午|早上|中午|晚上|傍晚|\d{1,2}\s*[号日]|\d{1,2}\s*(am|pm|o'clock)|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|noon|evening|afternoon|morning|明日|明後日|今夜|午後|午前|曜日|週末)/i;

/** bondId → 上次检查时最后一条消息 id（同一段对话不重复问模型） */
const checked = new Map<string, string>();

function parseAppointmentJSON(raw: string): { cancel?: boolean; placeId?: string; at?: number } | null {
  const obj = parseJsonObject<{ appointment?: { placeId?: unknown; at?: unknown } | null; cancel?: unknown }>(raw);
  if (!obj) return null;
  try {
    if (obj.cancel === true) return { cancel: true };
    const a = obj.appointment;
    if (!a || typeof a.placeId !== 'string' || typeof a.at !== 'string') return null;
    const at = parseAppointmentAt(a.at);
    return at ? { placeId: a.placeId, at } : null;
  } catch {
    return null;
  }
}

/** TA 回完一轮后调用（后台）：对话里刚聊定了见面 → 记进日程；聊取消了 → 撤掉 */
export async function detectAppointment(bondId: string): Promise<void> {
  const store = useAppStore.getState();
  const bond = store.bonds.find((b) => b.id === bondId);
  if (!bond) return;
  const recent = bond.messages.filter((m) => m.from !== 'system').slice(-8);
  const last = recent[recent.length - 1];
  if (!last || checked.get(bondId) === last.id) return;
  checked.set(bondId, last.id);
  const text = recent.map(messageContextText).join('\n');
  if (!PLACE_HINT.test(text) || !TIME_HINT.test(text)) return;

  try {
    const raw = await completeText(
      APPOINTMENT_EXTRACT_SYSTEM,
      buildAppointmentExtractPrompt({ hisName: bond.name, nickname: bond.nickname, recent }),
      160
    );
    const parsed = parseAppointmentJSON(raw);
    if (!parsed) return;
    const plans = useAppStore.getState().outingPlans;
    const existing = plans.find((p) => p.characterId === bond.characterId);
    if (parsed.cancel) {
      if (existing?.source === 'chat') {
        useAppStore.getState().removeOutingPlan(existing.id);
        const place = placeById(existing.placeId);
        useAppStore.getState().appendBond(bond.id, [
          {
            id: uid('m'),
            from: 'system',
            kind: 'system',
            text: t('{place}的约取消了', { place: place ? t(place.name) : '' }),
            at: Date.now(),
          },
        ]);
      }
      return;
    }
    const { placeId, at } = parsed;
    if (!placeId || !at) return;
    const place = PLACES.find((p) => p.id === placeId && !p.stranger);
    if (!place) return;
    if (at < Date.now() - 3600_000) return; // 已经过去的时间不记
    if (existing && existing.placeId === placeId && existing.at && Math.abs(existing.at - at) < 5 * 60_000) return;
    useAppStore.getState().addOutingPlan(bond.characterId, placeId, { at, source: 'chat' });
  } catch (e) {
    console.warn('[outing] 约定识别失败，跳过：', e);
  }
}

/* ── 爽约 ── */

/** 启动 / 回前台跑：过了赴约窗口还没去的约定 → 撤掉、记进记忆、TA 主动说一句。返回处理条数。 */
export async function checkMissedPlans(now = Date.now()): Promise<number> {
  const missed = useAppStore.getState().outingPlans.filter((p) => planIsMissed(p, now));
  let n = 0;
  for (const plan of missed) {
    useAppStore.getState().removeOutingPlan(plan.id);
    const place = placeById(plan.placeId);
    const bond = useAppStore.getState().bonds.find((b) => b.characterId === plan.characterId);
    const character = findCharacter(plan.characterId);
    if (!place || !bond || !character || !plan.at) continue;
    const atLabel = appointmentAtLabel(plan.at);
    useAppStore.getState().appendBond(bond.id, [
      {
        id: uid('m'),
        from: 'system',
        kind: 'system',
        text: t('你错过了{time}在{place}的约', { time: planTimeLabel(plan.at), place: t(place.name) }),
        at: now,
      },
    ]);
    addMemoryFact(
      bond.id,
      `[节点] ${todayLine(new Date(plan.at))} 她爽约了：约好 ${atLabel} 在${place.name}见面，她没来`
    );
    // TA 主动说一句（走回合管线：不可用就沉默——记忆里已经记着了，下次聊到自然会提）
    await respond(bondScope(bond.id), missedDateUserLine(place.name, atLabel), { pace: 'none', unread: true }, { billing: 'house' });
    n++;
  }
  return n;
}

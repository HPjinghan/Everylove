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
import { appointmentAtLabel, parseAppointmentAt, planIsMissed } from '@/lib/appointments';
import { bondScope, respond } from '@/lib/chat';
import { completeText } from '@/lib/engine';
import { uid } from '@/lib/format';
import { t } from '@/lib/i18n';
import { generateScenePhoto } from '@/lib/imagegen';
import { absorbOutingMemory, addMemoryFact } from '@/lib/memory';
import type { Character, OutingSession } from '@/lib/types';
import { weatherLine } from '@/lib/weather';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 一小时没说话，再进来就是新的一场 */
export const OUTING_IDLE_MS = 3600_000;

/* ── 进入 / 结束 ── */

function lastSpokeAt(s: OutingSession): number {
  return s.lastActiveAt ?? s.messages[s.messages.length - 1]?.at ?? s.startedAt;
}

export function sessionExpired(s: OutingSession, now = Date.now()): boolean {
  return now - lastSpokeAt(s) > OUTING_IDLE_MS;
}

/** 进入地点：续上 / 冷却后刷新 / 换地点先结束上一场；没有可遇的人返回 null */
export function enterPlace(placeId: string): OutingSession | null {
  const s = useAppStore.getState().outingSession;
  if (s && (s.placeId !== placeId || sessionExpired(s))) finishOuting();
  return useAppStore.getState().startOuting(placeId);
}

/** 结束外出：留记录（store）+ 现场对话并进记忆（后台、静默失败） */
export function finishOuting(): void {
  const store = useAppStore.getState();
  const s = store.outingSession;
  if (!s) return;
  const bond = store.bonds.find((b) => b.characterId === s.characterId);
  const place = placeById(s.placeId);
  store.endOuting();
  if (!bond || !place) return;
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
  store.addAlbumShot({ id: uid('ph'), uri, at, characterId: character.id, caption, placeId: place.id });
  if (store.outingSession?.id === session.id) {
    store.appendOuting([
      { id: uid('m'), from: 'me', kind: 'image', text: caption, imageUri: uri, polaroid: true, at },
    ]);
  }
  if (sceneSessionId !== session.id) showToast(t('照片洗好了，已存进相册'));
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
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      appointment?: { placeId?: unknown; at?: unknown } | null;
      cancel?: unknown;
    };
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
            text: `${place?.name ?? ''}的约取消了`,
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
        text: `你错过了${atLabel}在${place.name}的约`,
        at: now,
      },
    ]);
    addMemoryFact(
      bond.id,
      `[节点] ${todayLine(new Date(plan.at))} 她爽约了：约好 ${atLabel} 在${place.name}见面，她没来`
    );
    // TA 主动说一句（走回合管线：不可用就沉默——记忆里已经记着了，下次聊到自然会提）
    await respond(bondScope(bond.id), missedDateUserLine(place.name, atLabel), { pace: 'none', unread: true });
    n++;
  }
  return n;
}

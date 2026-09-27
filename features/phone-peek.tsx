/**
 * 查 TA 的手机（D-082/D-084）：第一次要先拿到密码——锁屏上自己猜，或点「问 TA 要密码」发一张「想看看你的手机」卡片，
 * TA 按性格 × 亲密度决定给不给；答应即说出密码并在回复末尾写 [解锁手机]（她看不到），引擎剥掉、状态解锁。
 * 一个玩法一个文件：prompt 分段（TA 知道自己的密码）+ 回复暗号 + 卡片种类 + 「问 TA 要密码」的动作，
 * 以及反过来的「让 TA 看我的手机」（D-085 / D-113 / D-194 从 lib/chat 搬来）：TA 翻她的记事本、日历里的安排、她和别人的聊天，
 * 然后发 1–2 句消息，记事本并进记忆；看到的日程从此 TA 知道（event.knownBy）——心跳三段式只投给知道的 TA，日程也记成事实。
 */

import { CardShell } from '@/components/card-bubble';
import { showToast } from '@/components/toast';
import { parseDateKey } from '@/content/calendar';
import { buildPeekMyPhoneUser, PHONE_UNLOCK_MARK, phoneBlock, todayLine } from '@/content/prompts';
import { cardKinds } from '@/core/cards';
import { replyMarkers } from '@/core/markers';
import { modeOf } from '@/core/modes';
import { ORDER, promptSections } from '@/core/prompt';
import { himMsg, respond, sendCard, sysMsg, type TurnUi } from '@/core/turn';
import { BONDED_CHAT } from '@/features/prompts';
import { bondScope } from '@/lib/chat';
import { darkSideCheck } from '@/lib/engine';
import { t } from '@/lib/i18n';
import { absorbNotesMemory, addMemoryFact } from '@/lib/memory';
import type { ChatMessage } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

/* ── prompt：TA 知道自己的密码，她要看时由 TA 决定 ── */
promptSections.register({ name: 'phone', stable: true, modes: BONDED_CHAT, order: ORDER.gameplay, lines: (ctx) => phoneBlock(ctx) });

/* ── 暗号：[解锁手机] → 解锁 + 系统条（聊天里、电话里都一样） ── */
replyMarkers.register({
  key: 'unlockPhone',
  mark: PHONE_UNLOCK_MARK,
  apply({ scope, mode }) {
    const store = useAppStore.getState();
    const bond = scope.bondId ? store.bonds.find((b) => b.id === scope.bondId) : undefined;
    if (!bond || bond.phoneUnlocked) return;
    store.setPhoneUnlocked(bond.id);
    mode.append(scope, [sysMsg(t('TA 同意让你看手机了'))]);
  },
});

/* ── 卡片：想看看你的手机 ── */
cardKinds.register({
  type: 'phoneRequest',
  contextText: () => '(She wants to look at your phone and is asking for the passcode.)',
  render: (c, dark) => <CardShell emoji="📱" kicker={t('查手机')} title={c.title} subtitle={c.subtitle} dark={dark} />,
});

/** 锁屏上的「问 TA 要密码」：发一张卡片，TA 按性格决定给不给（给就说出密码并写暗号） */
export async function askPasscode(bondId: string, ui?: TurnUi): Promise<void> {
  const store = useAppStore.getState();
  const bond = store.bonds.find((b) => b.id === bondId);
  if (!bond) return;
  const code = store.ensurePhoneCode(bond.id);
  await sendCard(
    { mode: 'bonded', bondId },
    { type: 'phoneRequest', title: t('想看看你的手机') },
    `(She tapped "ask for the passcode": ${bond.nickname} wants to look at your phone. Decide as yourself, by your character and how close you are now: if you let her, tell her the passcode ${code} and write ${PHONE_UNLOCK_MARK} alone on the final line; if not, say why or tease her — no mark.)`,
    ui
  );
}

/* ── 让 TA 看我的手机（D-085 / D-113）── */

/** 记事本最多给 TA 看几条 / 每条多长；她和别人的聊天：几个人、各几句；日历：过去几天 + 接下来几天、最多几条 */
const PEEK_EVENT_PAST_DAYS = 3;
const PEEK_EVENT_AHEAD_DAYS = 45;
const PEEK_EVENTS = 8;
const PEEK_NOTES = 8;
const PEEK_NOTE_CHARS = 240;
const PEEK_OTHERS = 3;
const PEEK_LINES = 6;

/**
 * 让 TA 看我的手机（D-085）：TA 翻她的记事本、她和其他 TA 的近期聊天，然后给她发一条消息（进会话、计未读）。
 * 红线：记事本里出现痛苦 / 危机内容走暗面路由（温柔模式、不入戏）；记事本里的其他真人一个字不评论（他只看她）。
 */
/** TA 看她手机时拿到的那份东西（D-118 回放共用同一份）：记事本 / 日历 / 她和别人的聊天 */
export function peekPayload(bondId: string): {
  notes: { at: number; text: string }[];
  events: { id: string; date: string; title: string }[];
  chats: { name: string; characterId: string; messages: ChatMessage[] }[];
} {
  const state = useAppStore.getState();
  const notes = [...state.notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, PEEK_NOTES)
    .map((n) => ({ at: n.updatedAt, text: n.text.trim().slice(0, PEEK_NOTE_CHARS) }))
    .filter((n) => n.text);
  const chats = state.bonds
    .filter((b) => b.id !== bondId)
    .map((b) => ({
      name: b.name,
      characterId: b.characterId,
      messages: b.messages.filter((m) => m.from !== 'system' && !m.recalled).slice(-PEEK_LINES),
    }))
    .filter((c) => c.messages.length)
    .sort((a, b) => (b.messages[b.messages.length - 1]?.at ?? 0) - (a.messages[a.messages.length - 1]?.at ?? 0))
    .slice(0, PEEK_OTHERS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = today.getTime() - PEEK_EVENT_PAST_DAYS * 86400_000;
  const to = today.getTime() + PEEK_EVENT_AHEAD_DAYS * 86400_000;
  const events = state.userEvents
    .filter((e) => {
      const at = parseDateKey(e.date).getTime();
      return at >= from && at <= to;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, PEEK_EVENTS)
    .map((e) => ({ id: e.id, date: e.date, title: e.title }));
  return { notes, events, chats };
}

export async function peekMyPhone(bondId: string): Promise<boolean> {
  const state = useAppStore.getState();
  const bond = state.bonds.find((b) => b.id === bondId);
  if (!bond) return false;
  const scope = bondScope(bondId);
  const mode = modeOf(scope);
  const { notes, events, chats } = peekPayload(bondId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  mode.append(scope, [sysMsg(t('TA 看了你的手机'))]);
  showToast(t('TA 拿起了你的手机'));

  // 暗面路由前置（红线 3 / D-167）：记事本、日历标题、她和别人聊天里她说的话，任一处有危机内容 → 温柔模式，不入戏
  const herWords = [
    ...notes.map((n) => n.text),
    ...events.map((e) => e.title),
    ...chats.flatMap((c) => c.messages.filter((m) => m.from === 'me').map((m) => [m.text, m.transcript, m.caption].filter(Boolean).join(' '))),
  ];
  const dark = darkSideCheck(herWords.join('\n'));
  if (dark) {
    mode.append(scope, dark.texts.map(himMsg), { unreadDelta: dark.texts.length });
    return true;
  }

  const { reply } = await respond(
    scope,
    buildPeekMyPhoneUser({ nickname: bond.nickname, notes, events: events.map((e) => ({ date: e.date, title: e.title })), chats }),
    { pace: 'none', unread: true }
  );
  addMemoryFact(bondId, `[节点] ${todayLine()} 她把手机递给 ${bond.name} 看了——记事本、日历和她与别人的聊天`);
  // 给他看得越多他越懂你（§7）：让 TA 看手机也是亲密度来源（D-126）
  useAppStore.getState().creditBond(bondId, 'peekMine');
  // 看到的日程从此 TA 知道（D-113）：心跳会来、聊天也记得
  if (events.length) {
    useAppStore.getState().markEventsKnown(events.map((e) => e.id), bondId);
    for (const e of events) if (parseDateKey(e.date).getTime() >= today.getTime()) addMemoryFact(bondId, `[日程] 她 ${e.date} 有「${e.title}」（在她手机的日历里看到的）`);
  }
  if (notes.length) void absorbNotesMemory(bondId, notes);
  return !!reply;
}

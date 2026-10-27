/**
 * TA 的手机里的几样东西（D-242）：
 * - 最近通话：会话里挂断留下的「📞 m:ss」系统条（lib/call.ts logCall）——在 TA 的手机里就是她打来的电话
 * - 相册：立绘之外，外出的拍立得 + TA 在聊天里发给她的照片（D-135，本来就是 TA 拍的）
 * - 壁纸：放在心上（LV4）起，TA 的桌面与锁屏换成你们最近的一张合影
 * - 新的：她上次合上这部手机之后才有的（记事本 / 和身边人的聊天 / 照片），桌面图块带角标；第一次看不标
 * - 备注名：TA 通讯录里给她存的名字，每到一个新等级由 TA 重写一次，没写成用她的昵称
 * - 察觉：她合上手机时掷一次，TA 偶尔会发现她翻过（features/phone-peek.tsx 落消息）
 */

import { backgroundAwake, levelOf } from '@/lib/bond';
import { buildHerContactNameSystem, HER_CONTACT_NAME_USER, parseHerContactName } from '@/content/prompts';
import { completeText } from '@/lib/engine';
import { createInflight } from '@/lib/inflight';
import type { AlbumShot, Bond, ChatMessage, HisNote } from '@/lib/types';
import { findCharacter, useAppStore } from '@/store/app-store';

/** 放在心上（LV4）起 TA 拿合影当壁纸 */
export const WALLPAPER_LEVEL = 4;
/** 察觉的概率：TA 没给过密码、还没发现过 / 平常；24 小时内只察觉一次 */
const NOTICE_GUESSED = 0.5;
const NOTICE_USUAL = 0.25;
const NOTICE_COOLDOWN_MS = 24 * 3600_000;
const CALL_RE = /^📞 (\d+:\d{2})$/;

/** 她挂断后留下的通话记录（新的在前） */
export function callLog(messages: ChatMessage[]): { id: string; at: number; duration: string }[] {
  const out: { id: string; at: number; duration: string }[] = [];
  for (const m of messages) {
    const hit = m.from === 'system' ? m.text.match(CALL_RE) : null;
    if (hit) out.push({ id: m.id, at: m.at, duration: hit[1] });
  }
  return out.reverse();
}

export interface HisPhoto {
  id: string;
  uri: string;
  at: number;
  caption?: string;
}

/** TA 相册里的照片（不含立绘）：外出的拍立得 + TA 发给她的照片，新的在前 */
export function hisPhotos(bond: Pick<Bond, 'characterId' | 'messages'>, album: AlbumShot[]): HisPhoto[] {
  const shots = album.filter((p) => p.characterId === bond.characterId).map((p) => ({ id: p.id, uri: p.uri, at: p.at, caption: p.caption }));
  const sent = bond.messages
    .filter((m) => m.from === 'him' && m.kind === 'image' && m.imageUri && !m.recalled)
    .map((m) => ({ id: m.id, uri: m.imageUri!, at: m.at }));
  return [...shots, ...sent].sort((a, b) => b.at - a.at);
}

/** 是不是合影：新的有标记；旧存档按手写字猜（拍 TA 的那张写「名字 · 地点」） */
function isTogether(shot: AlbumShot, names: string[]): boolean {
  if (shot.together !== undefined) return shot.together;
  if (!shot.placeId || !shot.caption) return false;
  return !names.some((n) => shot.caption!.startsWith(`${n} · `));
}

/** TA 的壁纸：LV4 起最近的一张合影；没到或没有合影 = 角色色 */
export function hisWallpaper(bond: Bond, album: AlbumShot[], names: string[], now = Date.now()): string | undefined {
  if (levelOf(bond, now) < WALLPAPER_LEVEL) return undefined;
  return album
    .filter((p) => p.characterId === bond.characterId && isTogether(p, names))
    .sort((a, b) => b.at - a.at)[0]?.uri;
}

/** 她上次合上手机之后新有的：和身边人的聊天（personId）、记事本（id）、照片数；第一次看什么都不标 */
export function newSince(
  bond: Pick<Bond, 'circleChats'> & { notes?: HisNote[] },
  photos: HisPhoto[],
  seenAt: number | undefined
): { chats: Set<string>; notes: Set<string>; photos: number } {
  const empty = { chats: new Set<string>(), notes: new Set<string>(), photos: 0 };
  if (seenAt === undefined) return empty;
  for (const [id, lines] of Object.entries(bond.circleChats ?? {})) if (lines.some((l) => l.at > seenAt)) empty.chats.add(id);
  for (const n of bond.notes ?? []) if (n.at > seenAt) empty.notes.add(n.id);
  empty.photos = photos.filter((p) => p.at > seenAt).length;
  return empty;
}

/** TA 通讯录里她的名字 */
export function herContactName(bond: Pick<Bond, 'herContact' | 'nickname'>): string {
  return bond.herContact?.name || bond.nickname;
}

/** 她合上手机时 TA 察觉的概率：第一次是 TA 给的密码 = TA 本来就知道，不掷 */
export function noticeChance(
  bond: Pick<Bond, 'phoneGuessed' | 'phoneCaught' | 'phoneNotice'>,
  firstLook: boolean,
  now = Date.now()
): number {
  if (bond.phoneNotice) return 0;
  if (bond.phoneCaught && now - bond.phoneCaught < NOTICE_COOLDOWN_MS) return 0;
  if (bond.phoneGuessed && !bond.phoneCaught) return NOTICE_GUESSED;
  return firstLook ? 0 : NOTICE_USUAL;
}

/** 她看过的地方（looked 的键）：给 TA 的舞台提示（英语）与记忆（中文） */
const LOOKED: Record<string, { en: string; zh: string }> = {
  messages: { en: 'your message list', zh: '聊天列表' },
  contacts: { en: 'your contacts', zh: '通讯录' },
  calls: { en: 'your call log', zh: '通话记录' },
  notes: { en: 'your notebook', zh: '记事本' },
  calendar: { en: 'your calendar', zh: '日历' },
  album: { en: 'your photos', zh: '相册' },
  wallet: { en: 'your wallet', zh: '钱包' },
};

export function lookedLabel(key: string, lang: 'en' | 'zh'): string {
  if (key === 'chat:her') return lang === 'en' ? 'your chat with her' : '和她的聊天';
  if (key.startsWith('chat:')) return lang === 'en' ? `your chat with ${key.slice(5)}` : `和${key.slice(5)}的聊天`;
  return LOOKED[key]?.[lang] ?? key;
}

/* ── 备注名：每到一个新等级 TA 重写一次 ── */

const RETRY_MS = 6 * 3600_000;
const lastTry = new Map<string, number>();
const inflight = createInflight();

/** 这段羁绊的备注名还停在旧等级就重写；返回是否写了 */
export async function ensureHerContactName(bondId: string, now = Date.now()): Promise<boolean> {
  const bond = useAppStore.getState().bonds.find((b) => b.id === bondId);
  const character = bond && findCharacter(bond.characterId);
  if (!bond || !character) return false;
  const level = levelOf(bond, now);
  if (bond.herContact?.level === level) return false;
  if (now - (lastTry.get(bondId) ?? 0) < RETRY_MS) return false;
  return inflight.run(
    bondId,
    async () => {
      lastTry.set(bondId, now);
      try {
        const raw = await completeText(buildHerContactNameSystem(character, bond, bond.herContact?.name), HER_CONTACT_NAME_USER, 60);
        const name = parseHerContactName(raw);
        if (!name) return false;
        useAppStore.getState().patchPhone(bondId, { herContact: { name, level } });
        return true;
      } catch (e) {
        console.warn('[his-phone] 备注名没写成，稍后再试：', e);
        return false;
      }
    },
    false
  );
}

/** 回前台时补写所有升了级的备注名（久别的不补，打开 TA 的手机时照常补） */
export async function deliverDueHerContactNames(now = Date.now()): Promise<number> {
  let n = 0;
  for (const bond of useAppStore.getState().bonds) {
    if (!backgroundAwake(bond, now)) continue;
    if (await ensureHerContactName(bond.id, now)) n++;
  }
  return n;
}

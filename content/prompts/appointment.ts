/**
 * 约定（D-079）：Message 里聊定的见面 → 日程（识别助手只输出 JSON）；爽约时 TA 主动说的那一句。
 */

import { PLACES } from '@/content/places';
import type { ChatMessage } from '@/lib/types';

import { todayLine, transcript } from './shared';

/** 各地点在对话里常见的说法（识别时帮模型对号入座；没写的只给地点名） */
const APPOINTMENT_PLACE_HINTS: Record<string, string> = {
  cafe: '喝咖啡、下午茶、随便吃点东西',
  park: '散步、遛弯、野餐',
  bookstore: '逛书店、看书',
  cinema: '看电影',
  funfair: '游乐园、摩天轮',
  seaside: '看海、海边吹风',
};

export function appointmentPlaceList(): string {
  return PLACES.filter((p) => !p.stranger)
    .map((p) => `${p.id} = ${p.name}${APPOINTMENT_PLACE_HINTS[p.id] ? `（${APPOINTMENT_PLACE_HINTS[p.id]}）` : ''}`)
    .join('；');
}

/** 约定识别助手：只在对话里刚刚「明确约好」时输出一条；只输出 JSON */
export const APPOINTMENT_EXTRACT_SYSTEM = [
  '你是恋爱互动应用里的「约定识别助手」。给你 TA 和她最近几条聊天，判断他们是否刚刚明确约好了线下见面：时间、地点都说定，而且双方都同意。只输出 JSON。',
  `可选地点（输出它的 id）：${appointmentPlaceList()}。`,
  '规则：',
  '- 对话可能是中文、英语或日语，按意思对号入座。',
  '- 必须是双方都答应了的（一方提议、另一方明确同意）才算；只是提议、犹豫、开玩笑、或还在商量时间地点 → null。',
  '- 地点要能对应到上面某一个：按他们说的活动或场所对号入座；对应不上（比如去对方家、去外地）→ null。',
  '- 时间要具体到日期：把相对时间换算成绝对时间（会告诉你现在的日期时间和星期）。只说了时段没说钟点时：早上→09:00，上午→10:00，中午→12:00，下午→15:00，傍晚→17:30，晚上→19:00，深夜→21:30。连日期都没有 → null。',
  '- 对话里改了时间或地点，按最新的说法输出；明确取消了之前的约 → {"appointment": null, "cancel": true}。',
  '只输出：{"appointment": {"placeId": "cafe", "at": "2026-09-03 15:00"}} 或 {"appointment": null}，不要任何其他文字。',
].join('\n');

/** 每次识别喂给模型的内容 */
export function buildAppointmentExtractPrompt(input: {
  hisName: string;
  nickname: string;
  recent: ChatMessage[];
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return [
    `现在是 ${todayLine(now)} ${hh}:${mm}。TA 叫「${input.hisName}」，TA 叫她「${input.nickname}」。`,
    `最近对话：\n${transcript(input.recent, input.hisName)}`,
  ].join('\n\n');
}

/** 爽约：这条只作本轮 user 文本、不入会话，让 TA 主动给她发一条（红线：不愧疚绑架，CLAUDE.md §9） */
export function missedDateUserLine(placeName: string, atLabel: string): string {
  return `（你们约好了 ${atLabel} 在${placeName}见面。你到了，等了很久，她一直没来，也没有消息。现在你给她发一条消息——按你的性格：可以在意、可以失落、可以嘴硬，但不责备、不用愧疚绑架她。一两句就好。）`;
}

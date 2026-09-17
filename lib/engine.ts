/**
 * ChatEngine 门面（D-086 起是薄的一层）：
 * - 供应商在 core/providers（features/providers.ts 注册 anthropic / qianfan），这里只调 completeChat；
 * - 系统 prompt 由 core/prompt 按分段表装配（content/prompts/ 出文本、features/prompts.ts 定顺序）；
 * - 回复暗号（[解锁手机] / [拆红包]……）由 core/markers 统一剥掉并置位 reply.flags。
 * 系统层规则（情绪暗面路由）在 generateReply 入口执行，任何供应商不可绕过——对应行为树「系统层锁死」。
 * 领养触发是产品触发器（D-008），在 features/adoption.ts，不交给模型。
 * 取路 = 本地 key 直连 > 登录走服务端代理 > 不可用抛错；调用失败直接抛，界面把原因露出来（D-069）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DARK_SIDE_PATTERN, darkSideReply } from '@/content/characters';
import { buildChatSystemPrompt, messageContextText, OPENING_STAGE_LINE } from '@/content/prompts';
import { stripReplyMarkers } from '@/core/markers';
import { modes } from '@/core/modes';
import {
  AiUnavailableError,
  chatProviderPreference,
  chatProviders,
  chatRoute,
  chatRouteSync,
  completeChat,
  currentChatProvider,
  setChatProviderPreference,
  type AiRoute,
  type ChatTurn,
} from '@/core/providers';
import { stripTrailingPeriods } from '@/lib/text';
import type { ChatMessage, EngineContext, EngineReply } from '@/lib/types';

// 全部 prompt 文本都在 content/prompts/（D-017/D-087）；这里只负责调用与组装历史。
export { messageContextText } from '@/content/prompts';
export { AiUnavailableError, type AiRoute, type ChatTurn };

/** 角色回话的输出预算（推理模型的供应商会自行加思考余量） */
const REPLY_MAX_TOKENS = 300;

/** 界面用的引擎名 */
export function engineLabel(providerId?: string): string {
  return currentChatProvider(providerId).label;
}

/* ── 引擎偏好（D-106）：设置 → 开发者点「AI 引擎」在已注册供应商之间切换；只存本机（AsyncStorage），不进 store、不进云端快照 ── */
const ENGINE_PREF_KEY = 'everylove-engine-pref';

/** 启动时读回上次的选择（app/_layout 调一次） */
export async function loadEnginePreference(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(ENGINE_PREF_KEY);
    if (id) setChatProviderPreference(id);
  } catch {}
}

/** 选一家（'' = 跟随工程配置）；立即生效并落盘 */
export function setEnginePreference(id: string): void {
  setChatProviderPreference(id);
  void (id ? AsyncStorage.setItem(ENGINE_PREF_KEY, id) : AsyncStorage.removeItem(ENGINE_PREF_KEY)).catch(() => {});
}

/** 当前偏好的供应商 id（'' = 跟随工程配置） */
export function enginePreference(): string {
  return chatProviderPreference();
}

/** 可选的供应商：id、界面名、当前取路 */
export function engineOptions(): { id: string; label: string; route: AiRoute }[] {
  return chatProviders.list().map((p) => ({ id: p.id, label: p.label, route: chatRouteSync(p) }));
}

/** 某供应商本地直连用的 key（媒体模块判断能否直连百度时用；空 = 没配） */
export function envKey(providerId?: string): string {
  return currentChatProvider(providerId).localKey();
}

/** AI 取路（D-057/D-069）：direct 本地 key 直连 > proxy 登录走服务端代理 > none 不可用。同步近似，界面显示用。 */
export function aiRouteSync(providerId?: string): AiRoute {
  return chatRouteSync(currentChatProvider(providerId));
}

/** 准确判断（发请求前用） */
export async function aiRoute(providerId?: string): Promise<AiRoute> {
  return chatRoute(currentChatProvider(providerId));
}

/** 把调用错误压成一行给界面看（试装口径：错误要看得见） */
export function describeAiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * 上下文窗口：最近 20 轮完整对话（一轮 = 她说一次 + 他的回应），完整送给模型（D-016）。
 * 更早的相处由记忆库的 summary 承接（仅羁绊层）。
 */
export const HISTORY_ROUNDS = 20;

/**
 * 把会话历史整理成模型可用的轮次：
 * - 系统提示条与空消息（如没台词的图片）不进上下文；
 * - 甩图消息用 spoken 补回他说过的话（否则他会忘记自己刚说了什么）；
 * - 调用方传入的 history 若已含本轮用户消息，去掉以免重复；
 * - 同角色连续消息合并成一条；
 * - 只保留最近 HISTORY_ROUNDS 轮；
 * - 首条必须是 user（Anthropic 硬性要求；他先开口的会话补一条舞台提示）。
 */
export function buildTurns(history: ChatMessage[], userText: string): ChatTurn[] {
  const msgs = [...history];
  const last = msgs[msgs.length - 1];
  // 本轮用户消息若已在 history 里就去掉（文字直接比；语音/照片比 messageContextText，D-073）
  if (last && last.from === 'me' && (last.text === userText || messageContextText(last) === userText)) {
    msgs.pop();
  }

  const turns: ChatTurn[] = [];
  for (const m of msgs) {
    const content = messageContextText(m);
    if (!content) continue;
    const role = m.from === 'me' ? 'user' : 'assistant';
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += '\n' + content;
    else turns.push({ role, content });
  }

  // 只留最近 N 轮：从后往前数 user 轮
  let userSeen = 0;
  let start = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') {
      userSeen++;
      if (userSeen === HISTORY_ROUNDS) {
        start = i;
        break;
      }
    }
  }
  const windowed = turns.slice(start);

  if (windowed.length && windowed[0].role === 'assistant') {
    windowed.unshift({ role: 'user', content: OPENING_STAGE_LINE });
  }
  const tail = windowed[windowed.length - 1];
  if (tail && tail.role === 'user') tail.content += '\n' + userText;
  else windowed.push({ role: 'user', content: userText });
  return windowed;
}

/**
 * 把模型回复拆成气泡（D-137：分段在客户端做，不指望模型自己用空行）：
 * 1. 先按空行拆（模型自己分好的照用）；2. 还没拆到 max 条就按句子拆——两句以上的回复在句末标点处断开，长度尽量均衡；
 * 初识 / 外出 / 通话 max = 1 不拆。顺手去掉模型偶尔加的名字前缀（「沈之言：」）与包裹引号。
 */
export function splitBubbles(text: string, max: number, name?: string): string[] {
  const cap = Math.max(1, max);
  const parts = text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .map((t) => (name && t.startsWith(name) ? t.replace(/^[^：:]*[：:]\s*/, '') : t))
    .map((t) => t.replace(/^[「"“]([\s\S]*)[」"”]$/, '$1').trim())
    .filter(Boolean)
    .slice(0, cap);
  if (parts.length >= cap || parts.length !== 1) return parts;
  return splitBySentences(parts[0], cap);
}

/** 句子：到句末标点（中英日韩）为止，带上后面的引号 / 括号；单换行也算一句的边界 */
// 正文用懒匹配：英文句号不在排除集里（小数点 5.20 要保住），贪婪会一路吃到下一个「！」
const SENTENCE_RE = /[^。！？!?…\n]+?(?:[。！？!?…]+|\.(?=\s|$)|\n|$)[」』"”'’）)]*\s*/g;
/** 短于这个字数的回复不拆 */
const SPLIT_MIN_CHARS = 8;

/** 两句以上就拆成最多 max 条：在句末标点处断，长度尽量均衡；一句话不拆 */
export function splitBySentences(text: string, max: number): string[] {
  const t = text.trim();
  if (max <= 1 || t.length < SPLIT_MIN_CHARS) return [t];
  // 句子带着自己后面的空格（英文句间的空格不能丢），最后再 trim
  const sentences = (t.match(SENTENCE_RE) ?? []).filter((s) => s.trim());
  if (sentences.length < 2) return [t];
  const n = Math.min(max, sentences.length);
  const lens = sentences.map((s) => s.trim().length);
  const total = lens.reduce((a, b) => a + b, 0);
  const target = total / n;
  // 逐条凑：下一句加进来离目标更近就加，否则收口；最后一条把剩下的全收
  const out: string[] = [];
  let i = 0;
  for (let k = 0; k < n - 1; k++) {
    let cur = sentences[i];
    let len = lens[i];
    i++;
    const mustLeave = n - 1 - k; // 后面每条至少留一句
    while (i < sentences.length - mustLeave && Math.abs(len + lens[i] - target) <= Math.abs(len - target)) {
      cur += sentences[i];
      len += lens[i];
      i++;
    }
    out.push(cur);
  }
  out.push(sentences.slice(i).join(''));
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * 聊天模式（初识/亲密）的打字感兜底（D-039）：prompt 已禁（）舞台提示，这里把模型
 * 偶尔仍带出的（动作/神态）剥掉，保证 LINE 打字感。外出模式不走这里（现场描写是合法语法）。
 * 整条只剩舞台提示的气泡直接丢弃；全部剥空则退回原文（宁可有旁白也不能不回话）。
 */
export function stripStageDirections(texts: string[]): string[] {
  const cleaned = texts
    .map((t) => t.replace(/（[^（）]*）/g, '').replace(/ {2,}/g, ' ').trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : texts;
}

/** 系统层前置检查：命中暗面路由则绕过一切角色扮演 */
export function darkSideCheck(userText: string): EngineReply | null {
  if (DARK_SIDE_PATTERN.test(userText)) {
    return { texts: [darkSideReply()], darkSide: true };
  }
  return null;
}

/**
 * 通用文本补全（不带角色人设）：供记忆提取/摘要/发帖/回帖/描述解析用，走工程配置的供应商。
 * 没有可用取路抛 AiUnavailableError，调用失败原样抛出——由调用方决定露出还是静默（D-069：不再回落脚本）。
 */
export async function completeText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
  providerId?: string
): Promise<string> {
  return completeChat(
    { system: systemPrompt, turns: [{ role: 'user', content: userPrompt }], maxTokens, kind: 'task' },
    providerId
  );
}

/**
 * 角色回一轮：暗面路由 → 装配系统 prompt → 供应商 → 拆气泡（条数与是否剥舞台提示由会话模式决定）→ 剥暗号。
 * 调用失败或没有取路时**抛错**，界面在会话里露出原因（D-069）。
 */
export async function generateReply(ctx: EngineContext, providerId?: string): Promise<EngineReply> {
  const dark = darkSideCheck(ctx.userText);
  if (dark) return dark;

  const text = await completeChat(
    {
      system: buildChatSystemPrompt(ctx),
      turns: buildTurns(ctx.history, ctx.userText),
      maxTokens: REPLY_MAX_TOKENS,
      kind: 'reply',
    },
    providerId
  );
  if (!text) throw new Error('empty reply');

  const policy = modes.get(ctx.mode);
  const maxBubbles = policy?.maxBubbles ?? (ctx.mode === 'bonded' ? 2 : 1);
  const stripStage = policy?.stripStage ?? ctx.mode !== 'outing';
  // 先剥暗号再拆气泡（D-126）：初识只留第一条气泡，写在末尾另起一段的暗号不能跟着丢
  const marked = stripReplyMarkers({ texts: [text] });
  const bubbles = splitBubbles(marked.texts.join('\n\n'), maxBubbles, ctx.character.name);
  const texts = stripStage ? stripStageDirections(bubbles) : bubbles;
  // D-145：末尾句号在前端去掉（真人不这样）；通话的字要送去合成，留着
  return { ...marked, texts: ctx.mode === 'call' ? texts : stripTrailingPeriods(texts) };
}

/** 兼容旧名：剥回复暗号（现由 core/markers 的注册表驱动） */
export const applyReplyMarkers = stripReplyMarkers;

/** 领养节奏的缺省值：心动满 100 约需几句（角色可用 offerAfterTurns 覆盖，D-029） */
export const ADOPTION_OFFER_AFTER_TURNS = 4;

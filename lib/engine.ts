/**
 * ChatEngine：对话引擎抽象（anthropic / qianfan，D-069 起没有脚本引擎）。
 * 系统层规则（情绪暗面路由、尺度、无 PUA）在入口处执行，任何引擎不可绕过——
 * 对应行为树「系统层锁死」。领养触发（他开口要联系方式）是产品触发器，
 * 由会话轮数决定，不交给模型（见 DECISIONS D-008）。
 * 引擎与 key 全部来自工程配置 .env.local（或登录后的服务端代理）；调用失败直接抛错，
 * 由界面把原因露出来——假回复只会妨碍判断（D-069）。
 */

import { DARK_SIDE_PATTERN, DARK_SIDE_REPLY } from '@/content/characters';
import { buildChatSystemPrompt, messageContextText, OPENING_STAGE_LINE } from '@/content/prompts';
import { t } from '@/lib/i18n';
import { proxyAvailable, proxyJson, proxyReadySync } from '@/lib/proxy';
import type { ChatMessage, EngineContext, EngineId, EngineReply } from '@/lib/types';

// 全部 prompt 文本都在 content/prompts.ts（D-017）；这里只负责调用与组装历史。
export { messageContextText } from '@/content/prompts';

const ANTHROPIC_MODEL = 'claude-sonnet-5';

/**
 * 工程配置：来自 .env.local（不进 git，见 .env.example）。
 * Metro 在打包时内联 EXPO_PUBLIC_ 变量，改动 .env.local 后需重启 npx expo start。仅试装用（D-010）。
 */
export const ENV_ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
export const ENV_QIANFAN_KEY = process.env.EXPO_PUBLIC_QIANFAN_API_KEY ?? '';
/** 千帆平台上挂着多家模型，具体用哪个由配置决定，默认 DeepSeek V4（千帆模型 ID：deepseek-v4-pro） */
export const QIANFAN_MODEL = process.env.EXPO_PUBLIC_QIANFAN_MODEL || 'deepseek-v4-pro';

/**
 * 引擎选择也是工程配置（D-069）：EXPO_PUBLIC_AI_ENGINE=anthropic|qianfan；
 * 不填则有 Claude key 用 Claude，否则千帆（服务端代理两家都通，默认千帆）。
 */
const ENV_ENGINE = process.env.EXPO_PUBLIC_AI_ENGINE;
export const ENGINE: EngineId =
  ENV_ENGINE === 'anthropic' || ENV_ENGINE === 'qianfan'
    ? ENV_ENGINE
    : ENV_ANTHROPIC_KEY
      ? 'anthropic'
      : 'qianfan';

/** 本地直连用的 key：只读工程配置（开发者面板手填已下线，D-069） */
export function envKey(engine: EngineId = ENGINE): string {
  return engine === 'anthropic' ? ENV_ANTHROPIC_KEY : ENV_QIANFAN_KEY;
}

/** 界面用的引擎名 */
export function engineLabel(engine: EngineId = ENGINE): string {
  return engine === 'anthropic' ? `Claude · ${ANTHROPIC_MODEL}` : `千帆 · ${QIANFAN_MODEL}`;
}

/** AI 取路（D-057/D-069）：direct 本地 key 直连 > proxy 登录走服务端代理 > none 不可用（不再有 mock） */
export type AiRoute = 'direct' | 'proxy' | 'none';

/** 同步近似（UI 显示用） */
export function aiRouteSync(engine: EngineId = ENGINE): AiRoute {
  if (envKey(engine)) return 'direct';
  return proxyReadySync() ? 'proxy' : 'none';
}

/** 准确判断（发请求前用） */
export async function aiRoute(engine: EngineId = ENGINE): Promise<AiRoute> {
  if (envKey(engine)) return 'direct';
  return (await proxyAvailable()) ? 'proxy' : 'none';
}

/** 没有任何可用取路时抛出：界面直接把原因露出来，不再用脚本假装回复（D-069） */
export class AiUnavailableError extends Error {
  constructor() {
    super(t('未配置 AI：.env.local 没有 key，也未登录（服务端代理不可用）'));
    this.name = 'AiUnavailableError';
  }
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

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

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
  if (last && last.from === 'me' && last.text === userText) msgs.pop();

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
 * 把模型回复拆成气泡：亲密模式允许用空行分成最多 2 条（prompt 里约定），初识模式只取第一段。
 * 顺手去掉模型偶尔加的名字前缀（「沈之言：」）与包裹引号。
 */
export function splitBubbles(text: string, max: number, name?: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .map((t) => (name && t.startsWith(name) ? t.replace(/^[^：:]*[：:]\s*/, '') : t))
    .map((t) => t.replace(/^[「"“]([\s\S]*)[」"”]$/, '$1').trim())
    .filter(Boolean);
  return parts.slice(0, Math.max(1, max));
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
    return { texts: [DARK_SIDE_REPLY], darkSide: true };
  }
  return null;
}

/** apiKey 为空 = 走服务端代理（D-057：key 收在服务端，客户端带登录态调用） */
async function anthropicReply(ctx: EngineContext, apiKey: string | null): Promise<EngineReply> {
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    system: buildChatSystemPrompt(ctx),
    messages: buildTurns(ctx.history, ctx.userText),
  };
  let data: { content: { type: string; text?: string }[] };
  if (apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    data = await res.json();
  } else {
    data = await proxyJson('anthropic.messages', body);
  }
  const text = data.content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('empty reply');
  const bubbles = splitBubbles(text, ctx.mode === 'bonded' ? 2 : 1, ctx.character.name);
  return { texts: ctx.mode === 'outing' ? bubbles : stripStageDirections(bubbles) };
}

/** 百度千帆 v2（OpenAI 兼容格式），模型由 QIANFAN_MODEL 决定；apiKey 为空 = 走服务端代理 */
async function qianfanReply(ctx: EngineContext, apiKey: string | null): Promise<EngineReply> {
  const body = {
    model: QIANFAN_MODEL,
    // deepseek-v4-pro 是推理模型，思考 token 也算在 max_tokens 里；给足余量防止正文被截空
    max_tokens: 1000,
    messages: [
      { role: 'system', content: buildChatSystemPrompt(ctx) },
      ...buildTurns(ctx.history, ctx.userText),
    ],
  };
  let data: { choices?: { message?: { content?: string } }[] };
  if (apiKey) {
    const res = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Qianfan API ${res.status}`);
    data = await res.json();
  } else {
    data = await proxyJson('qianfan.chat', body);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty reply');
  const bubbles = splitBubbles(text, ctx.mode === 'bonded' ? 2 : 1, ctx.character.name);
  return { texts: ctx.mode === 'outing' ? bubbles : stripStageDirections(bubbles) };
}

/**
 * 通用文本补全（不带角色人设）：供记忆提取/摘要/发帖/回帖/描述解析用，走工程配置的引擎。
 * 没有可用取路抛 AiUnavailableError，调用失败原样抛出——由调用方决定露出还是静默（D-069：不再回落脚本）。
 */
export async function completeText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1200,
  engine: EngineId = ENGINE
): Promise<string> {
  const route = await aiRoute(engine);
  if (route === 'none') throw new AiUnavailableError();
  const key = route === 'direct' ? envKey(engine) : null;
  if (engine === 'anthropic') {
    const body = {
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
    let data: { content: { type: string; text?: string }[] };
    if (key) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      data = await res.json();
    } else {
      data = await proxyJson('anthropic.messages', body);
    }
    return data.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('')
      .trim();
  }
  const body = {
    model: QIANFAN_MODEL,
    // 推理模型的思考 token 也算在内，给足余量
    max_tokens: Math.max(maxTokens, 2000),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  let data: { choices?: { message?: { content?: string } }[] };
  if (key) {
    const res = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Qianfan API ${res.status}`);
    data = await res.json();
  } else {
    data = await proxyJson('qianfan.chat', body);
  }
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * 统一入口：暗面路由 → 工程配置的引擎（本地 key 直连 / 登录走服务端代理，D-057）。
 * 调用失败或没有取路时**抛错**，界面在会话里露出原因（D-069：脚本引擎与回落链路已删——
 * 「他一定会回」改由真模型保证，假回复只会妨碍判断）。
 */
export async function generateReply(ctx: EngineContext, engine: EngineId = ENGINE): Promise<EngineReply> {
  const dark = darkSideCheck(ctx.userText);
  if (dark) return dark;

  const route = await aiRoute(engine);
  if (route === 'none') throw new AiUnavailableError();
  const key = route === 'direct' ? envKey(engine) : null;
  try {
    if (engine === 'anthropic') return await anthropicReply(ctx, key);
    return await qianfanReply(ctx, key);
  } catch (e) {
    console.warn(`[engine] ${engine}${key ? '' : '（代理）'} 调用失败：`, e);
    throw e;
  }
}

/** 领养触发器：广场会话中用户第 4 次发言后，他开口要联系方式 */
export const ADOPTION_OFFER_AFTER_TURNS = 4;

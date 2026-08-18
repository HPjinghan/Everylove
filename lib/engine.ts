/**
 * ChatEngine：对话引擎抽象。
 * 系统层规则（情绪暗面路由、尺度、无 PUA）在入口处执行，任何引擎不可绕过——
 * 对应行为树「系统层锁死」。领养触发（他开口要联系方式）是产品触发器，
 * 由会话轮数决定，不交给模型（见 DECISIONS D-008）。
 */

import { DARK_SIDE_PATTERN, DARK_SIDE_REPLY, scriptFor } from '@/content/characters';
import { buildChatSystemPrompt, messageContextText, OPENING_STAGE_LINE } from '@/content/prompts';
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

export interface EngineKeys {
  anthropic?: string;
  qianfan?: string;
}

/** key 解析：开发者面板手填的优先，其次读工程配置 */
export function resolveKey(engine: EngineId, keys: EngineKeys): string {
  if (engine === 'anthropic') return keys.anthropic || ENV_ANTHROPIC_KEY;
  if (engine === 'qianfan') return keys.qianfan || ENV_QIANFAN_KEY;
  return '';
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

function pick<T>(arr: T[], salt = 0): T {
  return arr[Math.floor(Math.random() * 977 + salt) % arr.length];
}

/** 系统层前置检查：命中暗面路由则绕过一切角色扮演 */
export function darkSideCheck(userText: string): EngineReply | null {
  if (DARK_SIDE_PATTERN.test(userText)) {
    return { texts: [DARK_SIDE_REPLY], darkSide: true };
  }
  return null;
}

async function mockReply(ctx: EngineContext): Promise<EngineReply> {
  const script = scriptFor(ctx.character);
  const salt = ctx.history.length + ctx.userText.length;

  for (const t of script.triggers) {
    if (t.pattern.test(ctx.userText)) {
      const reply = pick(t.replies, salt);
      // 广场模式只回一条：他有点兴趣，但不太主动（免费层商业承重墙）
      return { texts: [reply] };
    }
  }

  if (ctx.mode === 'square') {
    return { texts: [pick(script.square, salt)] };
  }

  const main = pick(script.bonded, salt);
  const texts = [main];
  // 羁绊模式的主动性：偶尔追一句称呼，体现「被爱」
  if (ctx.bond && salt % 3 === 0) {
    texts.push(`${ctx.bond.nickname}，在想什么？说来听听。`);
  }
  return { texts };
}

async function anthropicReply(ctx: EngineContext, apiKey: string): Promise<EngineReply> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: buildChatSystemPrompt(ctx),
      messages: buildTurns(ctx.history, ctx.userText),
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('empty reply');
  return { texts: splitBubbles(text, ctx.mode === 'bonded' ? 2 : 1, ctx.character.name) };
}

/** 百度千帆 v2（OpenAI 兼容格式），模型由 QIANFAN_MODEL 决定 */
async function qianfanReply(ctx: EngineContext, apiKey: string): Promise<EngineReply> {
  const res = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QIANFAN_MODEL,
      // deepseek-v4-pro 是推理模型，思考 token 也算在 max_tokens 里；给足余量防止正文被截空
      max_tokens: 1000,
      messages: [
        { role: 'system', content: buildChatSystemPrompt(ctx) },
        ...buildTurns(ctx.history, ctx.userText),
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Qianfan API ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty reply');
  return { texts: splitBubbles(text, ctx.mode === 'bonded' ? 2 : 1, ctx.character.name) };
}

/**
 * 通用文本补全（不带角色人设）：供记忆提取/摘要等后台任务用，走当前引擎与 key。
 * mock 引擎或没 key 时抛错，由调用方决定是否静默放弃。
 */
export async function completeText(
  systemPrompt: string,
  userPrompt: string,
  engine: EngineId,
  keys: EngineKeys,
  maxTokens = 1200
): Promise<string> {
  const key = resolveKey(engine, keys);
  if (!key || engine === 'mock') throw new Error('no engine for completion');
  if (engine === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('')
      .trim();
  }
  const res = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: QIANFAN_MODEL,
      // 推理模型的思考 token 也算在内，给足余量
      max_tokens: Math.max(maxTokens, 2000),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Qianfan API ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * 统一入口：暗面路由 → 所选引擎；API 引擎失败或没 key 时回落 Mock，保证「他一定会回」。
 */
export async function generateReply(
  ctx: EngineContext,
  engine: EngineId,
  keys: EngineKeys
): Promise<EngineReply> {
  const dark = darkSideCheck(ctx.userText);
  if (dark) return dark;

  const key = resolveKey(engine, keys);
  if (key) {
    try {
      if (engine === 'anthropic') return await anthropicReply(ctx, key);
      if (engine === 'qianfan') return await qianfanReply(ctx, key);
    } catch (e) {
      console.warn(`[engine] ${engine} 调用失败，回落脚本引擎：`, e);
      return mockReply(ctx);
    }
  } else if (engine !== 'mock') {
    console.warn(`[engine] ${engine} 没有 key（填 .env.local 后需重启 expo start），走脚本引擎`);
  }
  return mockReply(ctx);
}

/** 领养触发器：广场会话中用户第 4 次发言后，他开口要联系方式 */
export const ADOPTION_OFFER_AFTER_TURNS = 4;

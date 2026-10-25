/**
 * 聊天供应商（D-086）：anthropic（Claude，经 LLM Gateway 的 Anthropic 兼容接口，D-216）与 qianfan（百度千帆 v2，OpenAI 兼容格式）。
 * 每家 = 一个 ChatProvider：本地 key 直连怎么发、走代理时叫哪个服务、怎么从响应里取文本。
 * 再接一家（OpenAI / DeepSeek 官方 / 硅基流动）= 在这里加一个对象并 register；代理侧同名服务见 supabase/functions/ai。
 */

import { CONFIG } from '@/core/config';
import { billingOf, chatProviders, type ChatProvider, type ChatRequest, type ChatTurn } from '@/core/providers';
import { fetch as streamingFetch } from 'expo/fetch';

import { postJsonWithTimeout, proxyJson, proxyStream, TIMEOUTS } from '@/lib/proxy';

type AnthropicJson = { content: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
type OpenAIJson = { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

/** 默认就开着思考的 Claude 家族（Opus 5 / Fable / Sonnet 5.5 / Haiku 5.5）：思考 token 也算进 max_tokens，角色回话的 300 预算会被吃光 → 加余量、压低 effort（D-108 / D-205） */
const THINKING_ON_BY_DEFAULT = /^claude-(opus-5|fable|mythos|sonnet-5-5|haiku-5)/;
const THINKING_HEADROOM = 2048;

/** Claude 统一走 LLM Gateway（D-216）：Anthropic Messages 原格式，cache_control 原样转给上游；不直连 api.anthropic.com（并发额度低） */
const LLMGATEWAY_MESSAGES = 'https://api.llmgateway.io/v1/messages';

type Block = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
const EPHEMERAL = { type: 'ephemeral' as const };

/**
 * prompt 缓存（D-175）：系统 prompt 的稳定段单独一块打断点，动态段跟在后面；最后一条消息也打断点——
 * 下一轮请求的前缀（系统稳定段 + 到上一轮为止的历史）与这一轮相同，Anthropic 自动找最长命中的前缀，输入的大头只按缓存价计。
 * 历史窗口 20～25 轮一档滑动（lib/engine HISTORY_SLACK），不是每轮都掉最早一轮，前缀才稳得住。
 */
function cachedSystem(req: ChatRequest): string | Block[] {
  const p = req.cachePrefix;
  if (!p || !req.system.startsWith(p)) return req.system;
  const rest = req.system.slice(p.length);
  const blocks: Block[] = [{ type: 'text', text: p, cache_control: EPHEMERAL }];
  if (rest.trim()) blocks.push({ type: 'text', text: rest });
  return blocks;
}
function cachedTurns(req: ChatRequest): (ChatTurn | { role: ChatTurn['role']; content: Block[] })[] {
  if (!req.cachePrefix || !req.turns.length) return req.turns;
  const last = req.turns[req.turns.length - 1];
  return [...req.turns.slice(0, -1), { role: last.role, content: [{ type: 'text', text: last.content, cache_control: EPHEMERAL }] }];
}

type SseEvent = {
  type?: string;
  message?: { usage?: { input_tokens?: number } };
  delta?: { type?: string; text?: string; stop_reason?: string };
  usage?: { output_tokens?: number };
  error?: { message?: string };
};

/** 从 SSE 缓冲里取出完整的事件（data 行的 JSON），返回剩下没收完的部分 */
export function takeSseEvents(buf: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const parts = buf.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('');
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as SseEvent);
    } catch {
      /* 坏的一条跳过 */
    }
  }
  return { events, rest };
}

/** 流式（D-232，通话）：边到边把累计的正文交给 onText，最后给整段与 usage；拒答 / 出错抛错 */
async function streamAnthropic(body: Record<string, unknown>, route: 'direct' | 'proxy', req: ChatRequest): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUTS.chat);
  try {
    let reader: ReadableStreamDefaultReader<Uint8Array>;
    if (route === 'direct') {
      const res = await streamingFetch(LLMGATEWAY_MESSAGES, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${CONFIG.llmgatewayKey}`, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ ...body, stream: true }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) throw new Error(`LLM Gateway ${res.status}`);
      reader = res.body.getReader();
    } else {
      reader = (await proxyStream('anthropic.messages', { ...body, stream: true }, { billing: billingOf(req), signal: abort.signal })).reader;
    }
    const decoder = new TextDecoder();
    let buf = '';
    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let stop = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const taken = takeSseEvents(buf);
      buf = taken.rest;
      for (const e of taken.events) {
        if (e.type === 'message_start') inputTokens = e.message?.usage?.input_tokens ?? 0;
        else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
          text += e.delta.text;
          req.onText?.(text);
        } else if (e.type === 'message_delta') {
          outputTokens = e.usage?.output_tokens ?? outputTokens;
          stop = e.delta?.stop_reason ?? stop;
        } else if (e.type === 'error') throw new Error(`Anthropic stream: ${e.error?.message ?? 'error'}`);
      }
    }
    if (stop === 'refusal') throw new Error('Anthropic refusal');
    return { text: text.trim(), usage: { inputTokens, outputTokens } };
  } finally {
    clearTimeout(timer);
  }
}

const anthropic: ChatProvider = {
  id: 'anthropic',
  // 全部文字调用都走 Claude Haiku 5.5（D-205）：后台任务、没配 key 时走代理的默认也是它
  tier: 'cheap',
  label: `Claude · ${CONFIG.anthropicModel} · LLM Gateway`,
  localKey: () => CONFIG.llmgatewayKey,
  async complete(req, route) {
    // 通话（D-232）：关掉思考，首字快一两秒；Haiku 5.5 在 effort high 及以下允许 disabled
    const thinks = THINKING_ON_BY_DEFAULT.test(CONFIG.anthropicModel) && !req.realtime;
    const body = {
      model: CONFIG.anthropicModel,
      max_tokens: thinks ? req.maxTokens + THINKING_HEADROOM : req.maxTokens,
      system: cachedSystem(req),
      messages: cachedTurns(req),
      // 回话要快要短：低 effort；任务类（记忆提取 / 解析）用默认 high
      ...(thinks && req.kind === 'reply' ? { output_config: { effort: 'low' } } : {}),
      ...(req.realtime && THINKING_ON_BY_DEFAULT.test(CONFIG.anthropicModel) ? { thinking: { type: 'disabled' } } : {}),
    };
    // 通话要边出字边合成（D-232）
    if (req.onText) return streamAnthropic(body, route, req);
    let data: AnthropicJson;
    if (route === 'direct') {
      const res = await postJsonWithTimeout(
        LLMGATEWAY_MESSAGES,
        { authorization: `Bearer ${CONFIG.llmgatewayKey}`, 'anthropic-version': '2023-06-01' },
        body,
        TIMEOUTS.chat
      );
      if (!res.ok) throw new Error(`LLM Gateway ${res.status}`);
      data = JSON.parse(res.text) as AnthropicJson;
    } else {
      data = await proxyJson<AnthropicJson>('anthropic.messages', body, { billing: billingOf(req) });
    }
    // 安全分类器拒答（HTTP 200）：当失败处理，她那条标「没送到 · 重发」（D-169）
    if (data.stop_reason === 'refusal') throw new Error('Anthropic refusal');
    const text = data.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('')
      .trim();
    // D-133：真实 usage 报给流量（思考 token 也算在 output 里）
    return data.usage ? { text, usage: { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 } } : text;
  },
};

const qianfan: ChatProvider = {
  id: 'qianfan',
  // 文字调用不再默认走千帆（D-205）：只留作开发者手动切换的备选；生图 / 看图 / 语音另走 lib/media、lib/imagegen
  tier: 'premium',
  label: `千帆 · ${CONFIG.qianfanModel}`,
  localKey: () => CONFIG.qianfanKey,
  async complete(req, route) {
    const body = {
      model: CONFIG.qianfanModel,
      // deepseek-v4-pro 是推理模型，思考 token 也算在 max_tokens 里；给足余量防止正文被截空
      max_tokens: Math.max(req.maxTokens, req.kind === 'reply' ? 1000 : 2000),
      messages: [{ role: 'system', content: req.system }, ...req.turns],
    };
    let data: OpenAIJson;
    if (route === 'direct') {
      const res = await postJsonWithTimeout(
        'https://qianfan.baidubce.com/v2/chat/completions',
        { authorization: `Bearer ${CONFIG.qianfanKey}` },
        body,
        TIMEOUTS.chat
      );
      if (!res.ok) throw new Error(`Qianfan API ${res.status}`);
      data = JSON.parse(res.text) as OpenAIJson;
    } else {
      data = await proxyJson<OpenAIJson>('qianfan.chat', body, { billing: billingOf(req) });
    }
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    return data.usage ? { text, usage: { inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 } } : text;
  },
};

// 注册顺序即「没指定引擎时谁优先」：有 LLM Gateway key 用 Claude；都没 key 走代理时用标 cheap 的那家 = Claude（core/providers.currentChatProvider）
chatProviders.register(anthropic);
chatProviders.register(qianfan);

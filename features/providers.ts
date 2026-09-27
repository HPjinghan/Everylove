/**
 * 聊天供应商（D-086）：anthropic（Claude）与 qianfan（百度千帆 v2，OpenAI 兼容格式）。
 * 每家 = 一个 ChatProvider：本地 key 直连怎么发、走代理时叫哪个服务、怎么从响应里取文本。
 * 再接一家（OpenAI / DeepSeek 官方 / 硅基流动）= 在这里加一个对象并 register；代理侧同名服务见 supabase/functions/ai。
 */

import { CONFIG } from '@/core/config';
import { chatProviders, type ChatProvider, type ChatRequest, type ChatTurn } from '@/core/providers';
import { postJsonWithTimeout, proxyJson, TIMEOUTS } from '@/lib/proxy';

type AnthropicJson = { content: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
type OpenAIJson = { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

/** 默认就开着思考的 Claude 家族（Opus 5 / Fable）：思考 token 也算进 max_tokens，角色回话的 300 预算会被吃光 → 加余量、压低 effort（D-108） */
const THINKING_ON_BY_DEFAULT = /^claude-(opus-5|fable|mythos)/;
const THINKING_HEADROOM = 2048;

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

const anthropic: ChatProvider = {
  id: 'anthropic',
  tier: 'premium',
  label: `Claude · ${CONFIG.anthropicModel}`,
  localKey: () => CONFIG.anthropicKey,
  async complete(req, route) {
    const thinks = THINKING_ON_BY_DEFAULT.test(CONFIG.anthropicModel);
    const body = {
      model: CONFIG.anthropicModel,
      max_tokens: thinks ? req.maxTokens + THINKING_HEADROOM : req.maxTokens,
      system: cachedSystem(req),
      messages: cachedTurns(req),
      // 回话要快要短：低 effort；任务类（记忆提取 / 解析）用默认 high
      ...(thinks && req.kind === 'reply' ? { output_config: { effort: 'low' } } : {}),
    };
    let data: AnthropicJson;
    if (route === 'direct') {
      const res = await postJsonWithTimeout(
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': CONFIG.anthropicKey, 'anthropic-version': '2023-06-01' },
        body,
        TIMEOUTS.chat
      );
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      data = JSON.parse(res.text) as AnthropicJson;
    } else {
      data = await proxyJson<AnthropicJson>('anthropic.messages', body);
    }
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
  // 便宜那家（D-179）：后台任务、没配 key 时走代理的默认
  tier: 'cheap',
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
      data = await proxyJson<OpenAIJson>('qianfan.chat', body);
    }
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    return data.usage ? { text, usage: { inputTokens: data.usage.prompt_tokens ?? 0, outputTokens: data.usage.completion_tokens ?? 0 } } : text;
  },
};

// 注册顺序即「没指定引擎时谁优先」：有 Claude key 用 Claude，否则千帆（core/providers.currentChatProvider）
chatProviders.register(anthropic);
chatProviders.register(qianfan);

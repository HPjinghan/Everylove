/**
 * 聊天供应商（D-086）：anthropic（Claude）与 qianfan（百度千帆 v2，OpenAI 兼容格式）。
 * 每家 = 一个 ChatProvider：本地 key 直连怎么发、走代理时叫哪个服务、怎么从响应里取文本。
 * 再接一家（OpenAI / DeepSeek 官方 / 硅基流动）= 在这里加一个对象并 register；代理侧同名服务见 supabase/functions/ai。
 */

import { CONFIG } from '@/core/config';
import { chatProviders, type ChatProvider } from '@/core/providers';
import { proxyJson } from '@/lib/proxy';

type AnthropicJson = { content: { type: string; text?: string }[] };
type OpenAIJson = { choices?: { message?: { content?: string } }[] };

const anthropic: ChatProvider = {
  id: 'anthropic',
  label: `Claude · ${CONFIG.anthropicModel}`,
  localKey: () => CONFIG.anthropicKey,
  async complete(req, route) {
    const body = {
      model: CONFIG.anthropicModel,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.turns,
    };
    let data: AnthropicJson;
    if (route === 'direct') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': CONFIG.anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      data = await res.json();
    } else {
      data = await proxyJson<AnthropicJson>('anthropic.messages', body);
    }
    return data.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('')
      .trim();
  },
};

const qianfan: ChatProvider = {
  id: 'qianfan',
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
      const res = await fetch('https://qianfan.baidubce.com/v2/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${CONFIG.qianfanKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Qianfan API ${res.status}`);
      data = await res.json();
    } else {
      data = await proxyJson<OpenAIJson>('qianfan.chat', body);
    }
    return (data.choices?.[0]?.message?.content ?? '').trim();
  },
};

// 注册顺序即「没指定引擎时谁优先」：有 Claude key 用 Claude，否则千帆（core/providers.currentChatProvider）
chatProviders.register(anthropic);
chatProviders.register(qianfan);

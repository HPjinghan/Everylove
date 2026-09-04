/**
 * 聊天供应商接缝（D-086）——借 dsh 的「能力接缝 = 定义 / 实现 / 消费者」三件套：
 * - 定义：ChatProvider 接口 + chatProviders 注册表（本文件）；
 * - 实现：features/providers.ts（anthropic / qianfan；接 OpenAI、DeepSeek 官方 = 再注册一个）；
 * - 消费者：lib/engine.ts 的 generateReply / completeText 只调 completeChat，不认识任何一家。
 * 取路纪律不变（D-057/D-069）：本地 key 直连 > 登录走服务端代理 > 不可用抛错（没有假回复）。
 */

import { CONFIG } from '@/core/config';
import { createRegistry } from '@/core/registry';
import { t } from '@/lib/i18n';
import { proxyAvailable, proxyReadySync } from '@/lib/proxy';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export interface ChatRequest {
  system: string;
  turns: ChatTurn[];
  /** 想要的输出长度；推理模型的供应商会自行加思考余量 */
  maxTokens: number;
  /** reply = 角色回话（短）；task = 记忆提取 / 解析这类工具调用（长） */
  kind: 'reply' | 'task';
}

export type AiRoute = 'direct' | 'proxy' | 'none';

export interface ChatProvider {
  /** 供应商 id，也是 EXPO_PUBLIC_AI_ENGINE 的取值 */
  id: string;
  /** 界面显示（设置 → 开发者） */
  label: string;
  /** 本地直连用的 key；空 = 没配 */
  localKey(): string;
  /** 发一次请求并返回纯文本；route = proxy 时 key 在服务端，走 lib/proxy */
  complete(req: ChatRequest, route: Exclude<AiRoute, 'none'>): Promise<string>;
}

export const chatProviders = createRegistry<ChatProvider>('chatProviders', (p) => p.id);

/** 没指定、也没人有本地 key 时用它走代理（服务端两家都通，默认千帆） */
export const DEFAULT_CHAT_PROVIDER = 'qianfan';

/** 当前该用哪家：指定 id > 工程配置 EXPO_PUBLIC_AI_ENGINE > 第一个有本地 key 的 > 默认供应商 */
export function currentChatProvider(id?: string): ChatProvider {
  const wanted = id ?? CONFIG.engine;
  const byId = wanted ? chatProviders.get(wanted) : undefined;
  if (byId) return byId;
  const all = chatProviders.list();
  const p = all.find((x) => x.localKey()) ?? chatProviders.get(DEFAULT_CHAT_PROVIDER) ?? all[0];
  if (!p) throw new Error('底座未启动：没有注册任何聊天供应商（先 import "@/features"）');
  return p;
}

/** 同步近似（界面显示用） */
export function chatRouteSync(p: ChatProvider = currentChatProvider()): AiRoute {
  if (p.localKey()) return 'direct';
  return proxyReadySync() ? 'proxy' : 'none';
}

/** 准确判断（发请求前用） */
export async function chatRoute(p: ChatProvider = currentChatProvider()): Promise<AiRoute> {
  if (p.localKey()) return 'direct';
  return (await proxyAvailable()) ? 'proxy' : 'none';
}

/** 没有任何可用取路时抛出：界面直接把原因露出来（D-069） */
export class AiUnavailableError extends Error {
  constructor() {
    super(t('未配置 AI：.env.local 没有 key，服务端代理也没连上'));
    this.name = 'AiUnavailableError';
  }
}

/** 唯一的对外调用点：选供应商 → 定取路 → 发请求。失败原样抛出，由调用方决定露出还是静默。 */
export async function completeChat(req: ChatRequest, providerId?: string): Promise<string> {
  const p = currentChatProvider(providerId);
  const route = await chatRoute(p);
  if (route === 'none') throw new AiUnavailableError();
  try {
    return await p.complete(req, route);
  } catch (e) {
    console.warn(`[provider] ${p.id}${route === 'proxy' ? '（代理）' : ''} 调用失败：`, e);
    throw e;
  }
}

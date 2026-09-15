/**
 * 聊天供应商接缝（D-086）——借 dsh 的「能力接缝 = 定义 / 实现 / 消费者」三件套：
 * - 定义：ChatProvider 接口 + chatProviders 注册表（本文件）；
 * - 实现：features/providers.ts（anthropic / qianfan；接 OpenAI、DeepSeek 官方 = 再注册一个）；
 * - 消费者：lib/engine.ts 的 generateReply / completeText 只调 completeChat，不认识任何一家。
 * 取路纪律不变（D-057/D-069）：本地 key 直连 > 登录走服务端代理 > 不可用抛错（没有假回复）。
 */

import { CONFIG } from '@/core/config';
import { createRegistry } from '@/core/registry';
import { estimateTokens, GenerationBlockedError, generationBlocked, reportUsage } from '@/core/usage';
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

/** 供应商返回：纯文本，或带上真实 usage（D-133 按 token 计流量；没有就按字数估） */
export interface ChatResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ChatProvider {
  /** 供应商 id，也是 EXPO_PUBLIC_AI_ENGINE 的取值 */
  id: string;
  /** 界面显示（设置 → 开发者） */
  label: string;
  /** 本地直连用的 key；空 = 没配 */
  localKey(): string;
  /** 发一次请求并返回文本（可带 usage）；route = proxy 时 key 在服务端，走 lib/proxy */
  complete(req: ChatRequest, route: Exclude<AiRoute, 'none'>): Promise<string | ChatResult>;
}

export const chatProviders = createRegistry<ChatProvider>('chatProviders', (p) => p.id);

/** 没指定、也没人有本地 key 时用它走代理（服务端两家都通，默认千帆） */
export const DEFAULT_CHAT_PROVIDER = 'qianfan';

/** 运行期偏好（D-106）：设置 → 开发者点选的供应商 id；空 = 跟随工程配置。只存本机，不是用户数据（lib/engine 负责落盘） */
let preferred = '';
export function setChatProviderPreference(id: string): void {
  preferred = chatProviders.get(id) ? id : '';
}
export function chatProviderPreference(): string {
  return preferred;
}

/** 玩家在设置里选的模型档对应的供应商（D-132，features/traffic.ts 同步）：只在这家有路（本地 key 或代理）时生效 */
let userChoice = '';
export function setUserProviderChoice(id: string): void {
  userChoice = chatProviders.get(id) ? id : '';
}
export function userProviderChoice(): string {
  return userChoice;
}
/** 后台任务（记忆提取 / 解析 / 周薪……）默认走的便宜供应商（D-132）：有路才用，否则跟随当前 */
export const TASK_CHAT_PROVIDER = 'qianfan';

function hasRoute(p: ChatProvider | undefined): p is ChatProvider {
  return !!p && chatRouteSync(p) !== 'none';
}

/** 当前该用哪家：指定 id > 运行期偏好 > 工程配置 EXPO_PUBLIC_AI_ENGINE > 第一个有本地 key 的 > 默认供应商 */
export function currentChatProvider(id?: string): ChatProvider {
  const wanted = id ?? (preferred || CONFIG.engine);
  const byId = wanted ? chatProviders.get(wanted) : undefined;
  if (byId) return byId;
  // 玩家的模型档（D-132）：这家有路才用
  const chosen = !id && !preferred && userChoice ? chatProviders.get(userChoice) : undefined;
  if (hasRoute(chosen)) return chosen;
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
  // 后台任务不花她的流量，也别用贵的那家（D-132）：没指定、没有开发者偏好时走便宜供应商
  const taskCheap = !providerId && !preferred && req.kind === 'task' ? chatProviders.get(TASK_CHAT_PROVIDER) : undefined;
  const p = hasRoute(taskCheap) ? taskCheap : currentChatProvider(providerId);
  const route = await chatRoute(p);
  if (route === 'none') throw new AiUnavailableError();
  // 生成闸门（D-133）：流量用完了就不花
  const blocked = generationBlocked('chat');
  if (blocked) throw new GenerationBlockedError(blocked);
  try {
    const r = await p.complete(req, route);
    const result: ChatResult = typeof r === 'string' ? { text: r } : r;
    // 报用量：供应商给了就用真的，没给按字数估
    const usage = result.usage ?? {
      inputTokens: estimateTokens(req.system + req.turns.map((x) => x.content).join('\n')),
      outputTokens: estimateTokens(result.text),
    };
    reportUsage({ kind: 'chat', provider: p.id, reqKind: req.kind, estimated: !result.usage, ...usage });
    return result.text;
  } catch (e) {
    console.warn(`[provider] ${p.id}${route === 'proxy' ? '（代理）' : ''} 调用失败：`, e);
    throw e;
  }
}

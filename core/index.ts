/**
 * 底座（D-086）：一个 Core、七个插槽、一条管线。玩法在 features/ 里往这些插槽注册，界面在 app/ 里只调 lib/。
 *
 *   插槽                  注册什么                       谁在用
 *   chatProviders         聊天供应商（anthropic / qianfan）  lib/engine → core/providers.completeChat
 *   promptSections        系统 prompt 的分段              core/prompt.assembleSystemPrompt
 *   modes                 会话模式（初识 / 亲密 / 外出 / 通话）  core/turn.runTurn
 *   replyMarkers          回复暗号 → 状态                  core/turn（剥标记在 lib/engine）
 *   cardKinds             卡片消息种类                     messageContextText / 会话气泡
 *   jobs                  启动 / 回前台的后台任务           app/_layout → core/jobs.runJobs
 *   turnHooks             回合钩子（bubble / after）        core/turn
 *
 * 启动：app/_layout.tsx 顶部 `import '@/features'`——features/index.ts 按顺序把所有玩法装进来。
 * 没装就调用会直接抛「底座未启动」，不会静默空转（dsh 原则：配置错误要响）。
 */

export { cardContextText, cardKinds, type CardKind } from '@/core/cards';
export { CONFIG } from '@/core/config';
export { createEmitHook, createWaterfallHook } from '@/core/hooks';
export { jobs, runJobs, type Job, type JobTrigger } from '@/core/jobs';
export { replyMarkers, stripReplyMarkers, type MarkerInfo, type ReplyMarker } from '@/core/markers';
export { modeOf, modes, type ConversationMode, type ModeId, type TurnScope } from '@/core/modes';
export { assembleSystemPrompt, ORDER, promptSections, sectionsFor, type PromptEnv, type PromptMode, type PromptSection } from '@/core/prompt';
export {
  AiUnavailableError,
  chatProviders,
  chatRoute,
  chatRouteSync,
  completeChat,
  currentChatProvider,
  DEFAULT_CHAT_PROVIDER,
  type AiRoute,
  type ChatProvider,
  type ChatRequest,
  type ChatTurn,
} from '@/core/providers';
export { createRegistry, type Disposer, type Registry } from '@/core/registry';
export {
  himMsg,
  meMsg,
  naturalDelay,
  respond,
  runTurn,
  sendCard,
  sendText,
  sysMsg,
  turnHooks,
  wait,
  type BubbleInfo,
  type TurnInfo,
  type TurnResult,
  type TurnUi,
} from '@/core/turn';

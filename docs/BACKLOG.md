# BACKLOG.md — 2026-09-27 全工程审计后的整改清单

> 来源：2026-09-27 四路审计（底座分层 / 数据与同步 / 界面体验 / AI 管线），每条都在代码里核实过。
> 用法：一次做一条，做完把状态改成 ✅ 并写上 D-编号（产生新决策的话）；不再需要的划掉并写原因。
> 编号只是顺序建议，不是硬约束。

## A. 安全与红线（先做）

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| A1 | ✅ D-166 | 代理限流改成不可绕过：service role + 原子自增、匿名配额更小、`ai_usage` 建表与 RLS 入 SQL | `supabase/functions/ai/index.ts:46-66`、`docs/supabase-setup.sql` | Postgres 函数 `increment_usage`（security definer）返回 count，Edge Function 只调它 |
| A2 | ✅ D-166 | 代理 body 白名单：model / max_tokens / 生图 size / n 服务端定死，上游错误只回状态码 | `supabase/functions/ai/index.ts:68-160` | 每个 service 一张允许表；`String(e)` 不再透传 |
| A3 | ✅ D-167 | 暗面路由看历史窗口：最近 N 轮里命中过就注入危机段；命中的轮次不进记忆提取 | `lib/engine.ts:329`、`features/memory.ts:10` | `darkSideCheck` 扫 `ctx.history` 尾部；`TurnInfo.darkSide` 为真时 after 钩子里的记忆跳过 |
| A4 | ✅ D-167 | 看手机的暗面检查扩到日历标题与她和别人的聊天 | `lib/chat.ts:158` | 三份文本拼一起再 `darkSideCheck` |
| A5 | ✅ D-168 | X 任务 prompt 去掉「你在扮演……虚构角色」，改真人自居（D-154）并带 `TALK_MANNER` | `content/prompts/social.ts:40,82,135` | 与亲密 prompt 同一行开头；快照必红，确认后更新 |
| A6 | ⬜ | 上游 key 不再 `EXPO_PUBLIC_`；发布脚本自动 grep bundle 里的 key 前缀，命中即中止 | `core/config.ts:10-13,40`、`docs/RELEASE.md:73-82` | 只在 `__DEV__` 读本地 key；`scripts/` 加校验脚本，eas update 前跑 |
| A7 | ⬜ | Supabase 会话 token 进 SecureStore | `lib/auth.ts:34` | `expo-secure-store` 做 storage adapter |

## B. 直接影响北极星的体验（小活，紧跟 A）

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| B1 | ✅ D-169 | 发送失败态：她那条气泡下标「没送到 · 重发」，可点重发；错误原因只进开发者页 | `core/turn.ts:123`、`components/chat-thread.tsx` | `ChatMessage.sendStatus: 'failed'`，`runTurn` 失败时 patch 她的那条；重发 = 不再 append 直接 `runTurn` |
| B2 | ✅ D-169 | 回合按 scope 串行：TA 在回时她再发的排队，不并行 | `core/turn.ts:163-172` | scope 级 inflight 队列（Promise 链），typing 由队列统一管 |
| B3 | ✅ D-170 | 通知点开进会话：响应监听 + 冷启动 last response | `lib/notifications.ts`、`app/_layout.tsx` | `addNotificationResponseReceivedListener` → `router.push('/bond/[bondId]')`；通知 data 带 bondId |
| B4 | ✅ D-171 | 直连 fetch 统一超时与取消 | `features/providers.ts:34,71`、`lib/media.ts:171,221`、`lib/tts.ts:132,153` | 全部走 `lib/proxy.ts` 的 `postJsonWithTimeout` 同款；`EngineContext` 可带 AbortSignal |
| B5 | ✅ D-172 | 「TA 正在看」回放加逃生门：超时或点遮罩可关 | `components/peek-replay.tsx:90-99` | 30 s 无结果自动 done；`onRequestClose` 生效 |
| B6 | ✅ D-173 | TA 发图的 apply 不再 await 生图 | `features/his-photo.tsx:38-58`、`lib/reach-out.ts:134` | apply 只落 pending 气泡，生图 fire-and-forget 后 patch |
| B7 | ✅ D-174 | 心跳三个时间点过勿扰时段 | `lib/heartbeat.ts:25-30` | 复用 `outsideQuiet` 推到勿扰结束后 |

## C. 成本（决定免费层手感）

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| C1 | ✅ D-175 | prompt 前缀缓存：静态段（人设 / 硬规则 / 说话方式）排最前并加 `cache_control`，动态段（时间 / 天气 / 记忆 / 舞台提示）统一放尾 | `core/prompt.ts` ORDER、`features/providers.ts:24-31` | Anthropic 用 system 数组 + `cache_control: ephemeral`；千帆靠前缀稳定自动命中；快照必红 |
| C2 | ⬜ | 后台任务限并发 + 回前台节流；后台生成一律走 task 档（便宜家） | `core/jobs.ts`、`core/providers.ts:199`、`lib/reach-out.ts`、`lib/recall.ts`、`lib/heartbeat.ts` | `runJobs` 用并发 2–3 的队列；回前台 5 分钟内不重跑；`generateReply` 加 `kind: 'task'` 参数 |
| C3 | ⬜ | 主动消息预写不再「她一开口就作废重写」 | `lib/reach-out.ts:166-179` | 到点前 10 分钟才写；或她说过话只改舞台提示不重写 |
| C4 | ⬜ | ASR 多语通道用量按真实时长计，不硬估 15 秒 | `lib/media.ts:144` | 传 `durationMs` 进去 |
| C5 | ⬜ | 媒体目录清理：TTS / 照片 / 立绘超龄或超量删 | `lib/tts.ts`、`lib/imagegen.ts`、`lib/media.ts` | 启动 job：TTS 保留 7 天，相册 / 立绘只删没被引用的 |

## D. 底座纪律回收

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| D1 | ⬜ | 主动 / 召回 / 心跳三条路改走管线 | `lib/reach-out.ts:203`、`lib/recall.ts:107`、`lib/heartbeat.ts:95` | `core/turn` 加 `draft(scope, userText)` 返回 EngineReply 不落屏，三处用它 + `applyMarkers`；bubble / after 钩子照跑 |
| D2 | ⬜ | X 回帖做成一种 `ConversationMode` | `app/apps/moments.tsx:46-55`、`features/modes.ts` | mode `'post'`，历史 = 该帖评论链 |
| D3 | ⬜ | core 去掉对玩法与界面的认识 | `core/providers.ts:48,68`（写死 qianfan）、`core/prompt.ts:37-42`（ORDER 槽名）、`core/turn.ts:9`（import toast） | 默认供应商由 `features/providers` 注册时声明；ORDER 改锚点区间（persona / rules / dynamic / tail）；toast 经 `TurnUi.notify` 注入 |
| D4 | ⬜ | 界面绕过会话层的 import 收回 | `app/apps/moments.tsx:20,27`、`character-edit.tsx:47`、`settings.tsx:23-25`、`app/call/[characterId].tsx:30-33`、`app/bond/[bondId].tsx:30`、`app/chat/[characterId].tsx:27`、`app/outing/[placeId].tsx:29-35`、`components/chat-thread.tsx:44`、`his-phone.tsx:25`、`time-picker.tsx:15` | `lib/chat.ts` 补导出门面；卡片渲染注册表经 `features/cards` 暴露 |
| D5 | ⬜ | 补投入口收口：界面只调 `runJobs('screen:xxx')` | `components/his-phone.tsx:111-118`、`app/apps/calendar.tsx:124`、`moments.tsx:209` | `JobTrigger` 加 `'screen:phone' / 'screen:x' / 'screen:calendar'` |
| D6 | ⬜ | 重复实现抽公共件：`scheduler({perDayOf, jitter})`、`withInflight(key, fn)`、`parseJsonObject` | `lib/posts.ts:49`、`his-notes.ts:30`、`reach-out.ts:52`；inflight 10 处；JSON 解析 5 处 | 放 `lib/schedule.ts` / `lib/inflight.ts` / `lib/json.ts` |
| D7 | ⬜ | prompt 重复规则合并：不纠缠 4 处、不提等了多久 3 处、不问在吗 3 处、无前缀无 markdown 4 处；8 段 `-outing` 影子注册改 `when(ctx)` | `content/prompts/shared.ts`、`chat.ts`、`warmth.ts`、`reach-out.ts`、`recall.ts`、`heartbeat.ts`、`features/prompts.ts:82-140` | `PromptSection` 加 `when`；快照必红 |
| D8 | ⬜ | 任务类 prompt 与卡片舞台提示改英语指令（D-142） | `reach-out.ts:26`、`heartbeat.ts:100-106`、`recall.ts`、`red-packet.tsx:80`、`phone-peek.tsx:49`、`invite.tsx:27`、`share.tsx:47`、`lib/delivery.ts:104` | 与对话 prompt 同口径 |
| D9 | ⬜ | 类型收紧：`ChatCard.type` 封闭联合、`LedgerKind` / `TrafficEntry.kind` / `MessageKind` 常量表、`reply.flags` 键从 markers 推导、退役字段删（`Bond.arrivalAt/notifId/away/awayNotified`、`AppState.themeId/desktopOrder`） | `lib/types.ts:168,311-320`、`store/app-store.ts:97-106` | 配一次 persist v12 迁移把可选字段补默认值改必填 |
| D10 | ⬜ | 记忆合并策略：旧 ∪ 新去重、条数骤降拒写、按消息 id 记进度而非下标 | `lib/memory.ts:114-121,172-176,218`、`store/app-store.ts:715` | `mergeFacts(old, new)` 纯函数 + 用例 |
| D11 | ⬜ | 暗号解析健壮：全角【】/［］也认、多暗号、半角 (…) 与 *动作* 也剥；句子切分放过 "Mr." / "e.g." | `core/markers.ts:41-60`、`lib/engine.ts:254,295` | 补多暗号 / 漂移 / 缩写 / emoji 用例 |
| D12 | ⬜ | 玩法归位：`peekMyPhone` 出 `lib/chat.ts` 进 `features/phone-peek`；钱包 / 外卖四处合一 | `lib/chat.ts:144-179`、`features/wallet.tsx` + `lib/delivery.ts` + `lib/salary.ts` + `lib/wallet.ts` | 纯搬家，行为不变 |

## E. 存储与同步（大活，可等 dev build 一起）

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| E1 | ⬜ | 消息滚动归档：每段会话内存只留最近 N 条，旧的落单独 key，上下文只需 20 轮 | `store/app-store.ts:641,439`、`lib/memory.ts:94-117` | 归档前先保证记忆摘要已覆盖 |
| E2 | ⬜ | 持久化分区：`partialize` 排除 `sharedPool` / `outingSession`；按 bond 分 key 或换 SQLite / MMKV | `store/app-store.ts:1053-1056` | 先 partialize（小），再分 key（大） |
| E3 | ⬜ | 云快照带 `rev` 条件更新，冲突时合并不覆盖；上传失败重试；防抖与上传加 inflight 锁 | `lib/sync.ts:63-67,157,222` | `.eq('rev', prev)` 失败则拉下来 merge；`planReconcile` 补用例 |
| E4 | ⬜ | 图片存相对路径 + 选图 copy 进 documentDirectory；正式版上 Storage | `lib/imagegen.ts:35-41`、`components/chat-thread.tsx:430`、`character-edit.tsx:535` | 存 `photos/xxx.jpg`，读时拼 documentDirectory |
| E5 | ⬜ | 共享池入库前剥本机 URI、校验大小 | `lib/pool.ts:46-51` | 章节图暂不上传（OPEN #36） |
| E6 | ⬜ | `localIsFresh` 把相册 / 记事本 / 零钱也算「有数据」；`restoreSnapshot` 显式跑 migrate | `lib/sync.ts:108-109,164` | |

## F. 界面质量

| # | 状态 | 事项 | 在哪 | 做法 |
|---|---|---|---|---|
| F1 | ⬜ | 开发者话术与「试装模拟」字样只在 `__DEV__` 露出；AI 不可用统一一句情绪化文案 | `app/apps/settings.tsx:162-171,246,307-310,373-468`、`bond/[bondId].tsx:126`、`phones.tsx:49`、`phone.tsx:28`、`auth.tsx:140` | 过文案纪律（§11-6）+ 补四语词典 |
| F2 | ⬜ | onboarding 第二步可回语言步；生日改选择器 | `app/onboarding.tsx:58,115-185`、`identity.tsx:205`、`calendar.tsx:62` | 复用 `time-picker` 的日期部分 |
| F3 | ⬜ | 聊天列表性能：输入栏拆子组件、`Bubble` memo、`data` / `readIds` useMemo、语音播放器共用一只 | `components/chat-thread.tsx:88,152,355,369,383,485` | |
| F4 | ⬜ | 创造表单拆状态：按页签拆子组件或 useReducer | `app/apps/character-edit.tsx:335-394` | |
| F5 | ⬜ | TA 主页占位行：故事行链传记、相册行链相册 | `app/bond/[bondId].tsx:184-189` | 无供给不摆 |
| F6 | ⬜ | 流式输出 + 按到达节奏打字 | `core/providers.ts`、`features/providers.ts`、`core/turn.ts:130-135` | 先 Anthropic SSE；`ChatProvider` 加 `stream?` |
| F7 | ⬜ | 约定窗口外进外出给一句解释；日历「赴约」校验窗口 | `app/outing/[placeId].tsx`、`app/apps/calendar.tsx:240` | |
| F8 | ⬜ | 字号走 `Type.scale`、Fredoka 从中文上撤下 | 全屏幕；`notes.tsx:191,205`、`his-phone.tsx:512`、`polaroid.tsx:105`、`dating.tsx:128` | 一次性 codemod |
| F9 | ⬜ | 硬写 rgba / hex 与自造控件回收：`phones.tsx:103-124` 自绘 Modal → ConfirmSheet、`ConfirmSheet` 单动作保留 destructive、toast 排队 | `character-edit.tsx:110-115`、`chat-thread.tsx:680-696`、`card-bubble.tsx:64-68`、`phone-lock.tsx:216-254`、`action-sheet.tsx:235-244`、`toast.tsx:28-36` | |
| F10 | ⬜ | 未 t() 与日期格式：settings 大段、`format.ts:26`「万」、`traffic-log.tsx:51` 露 qianfan、`story:56`；日期全走 `localeOf` | 见界面审计 §6 | 词典测试会扫出 |
| F11 | ⬜ | 可访问性底线：动作型文字按钮 ≥ 44pt（传记编辑器上移 / 下移 / 删除、锁屏、HeaderAction）、`accessibilityLabel` 给图标按钮 | `story-editor.tsx:106-114`、`phone-lock.tsx:177-196`、`components/app-screen.tsx` | |
| F12 | ⬜ | 拟真小断裂：自创角色 handle `@c_17xxx`、红包预设 6 / 13 / 52 / 520 按市场、挂断留「通话结束」、location UA 去掉 prototype | `moments.tsx:35`、`chat-extras.tsx:121`、`call:241`、`location-picker.tsx:54` | 红包预设进 OPEN_QUESTIONS |
| F13 | ⬜ | 静默吞错补提示：定位拒绝 / 搜索失败、试听失败、立绘循环、分享不等不 catch | `location-picker.tsx:131-149`、`voice-picker.tsx:62`、`settings.tsx:171`、`his-phone.tsx:113`、`share.tsx:31` | 统一 showToast |
| F14 | ⬜ | 桌面与创造的渲染期开销：时钟 15 s 整页 setState、渲染期 `Dimensions.get`、渲染期写 store | `app/index.tsx:73`、`outing.tsx:97`、`album.tsx:78`、`bond:245`、`phones:143` | |

## 建议顺序

A1 → A2 → A3 → A4 → A5 → B1 → B2 → B3 → B4 → B5 → B6 → B7 → C1 → C2 → D1 → D2 → D3 → F1 → F5 → F2 → 其余按表内顺序。

# 底座与插槽（D-086）

> 一句话：**一个 Core、七个插槽、一条管线。** 玩法往插槽里注册，界面只调会话层，模型看到的每个字都从可复现的地方来。
> 本文是「怎么往这个 App 里加东西」的手册；产品口径仍以 `CLAUDE.md` 为准。

## 1. 从 Cordis / dsh 借了什么，没借什么

Harper 的目标是「一个可插拔的结构和一个底座，以后可以任意引入新东西」。DeepSeek Harness（dsh）是编程智能体壳，跑在 Node 里、27 万行、96 个包，整体不能搬；它底下的 Cordis 插件框架有五个想法，我们取了对一个 1.8 万行 React Native App 有用的四个半：

| Cordis / dsh 的想法 | 我们的做法 | 没照搬的原因 |
|---|---|---|
| 插件 = 往共享上下文里注册东西 | `features/*.ts(x)`：一个玩法一个文件，往 `core/` 的注册表里 register | 不做 `ctx.xxx` 动态挂载与声明合并，用普通的类型化对象——TypeScript 直接给提示 |
| 注册即效果，可撤销 | 每个 `register()` 返回撤销函数；测试里可重置、开关可关掉一个玩法 | 不做运行时热重载（RN 没有这个需求） |
| `inject` 声明依赖、自动排启动顺序 | 不做：启动顺序就是 `features/index.ts` 的 import 顺序，一眼看得见 | 玩法之间没有需要自动解析的依赖 |
| 类型化事件 + 分发模式（emit / waterfall / bail…） | 只留两种：`emit`（观察者）与 `waterfall`（流水改写），挂在回合管线的两个具名钩子点上 | 不做通用事件总线：钩子点是具名、带类型的，加一个 = 加一个导出 |
| 系统 prompt 按「分段」装配，具名顺序槽 | `core/prompt.ts`：`PromptSection { name, modes, order, lines }` + `ORDER` 具名槽 | 直接照搬 |
| 能力接缝 = 定义 / 实现 / 消费者三件套 | `core/providers.ts` 定义 `ChatProvider`，`features/providers.ts` 实现，`lib/engine.ts` 消费 | 直接照搬（语音 / 生图接缝下一轮） |
| 「模型看得见的，日志里必须有」 | 卡片 / 语音 / 照片都存在 `ChatMessage` 上，进模型的文字由注册表从消息重建 | 舞台提示（接电话第一句、爽约、看手机）仍只作本轮 user 文本不入会话——记为已知例外 |
| profile / bundle 分层配置、会话日志投影、沙箱 | 不做 | 那是多产品形态与多租户的需求 |

## 2. 目录

```
core/          底座：不含任何具体玩法，只有插槽与管线（改这里 = 改「怎么加东西」）
  registry.ts    注册表：register 返回撤销函数、同 key 覆盖、按注册顺序 list
  hooks.ts       钩子：createEmitHook / createWaterfallHook
  config.ts      工程配置：所有 EXPO_PUBLIC_* 只在这里读一次
  providers.ts   聊天供应商接缝：ChatProvider + 取路（直连 / 代理 / 不可用）
  prompt.ts      系统 prompt 分段表 + ORDER 顺序槽 + assembleSystemPrompt
  modes.ts       会话模式接口（历史在哪 / 落到哪 / 她开口算什么账 / 组上下文 / 拆几条）
  markers.ts     回复暗号（[解锁手机] / [拆红包]……）→ flags → apply
  cards.ts       卡片消息种类：进上下文的一句 + 气泡怎么画
  jobs.ts        后台任务：启动 / 回前台
  turn.ts        回合管线：runTurn / sendText / sendCard / respond + turnHooks
  index.ts       总览与 re-export
features/      玩法：往插槽里注册；只 import core / lib / store / content / components
  index.ts       启动清单（app/_layout.tsx 顶部 import 一次）
  providers.ts   anthropic / qianfan
  prompts.ts     基础分段（人设 / 时间 / 她是谁 / 记忆 / 分寸 / 红线 / 输出格式）
  modes.ts       初识 / 亲密 / 外出 / 通话
  invite.tsx     外出邀请：卡片 + sendInvite
  red-packet.tsx 红包：prompt 分段 + 暗号 + 卡片 + sendRedPacket
  location.tsx   位置：卡片 + sendLocation
  phone-peek.tsx 查手机：prompt 分段 + 暗号 + 卡片 + askPasscode
  voice-reply.ts TA 偶尔发语音（bubble 钩子）
  memory.ts      记忆提取（after 钩子）
  appointment.ts 约定识别（after 钩子）
  adoption.ts    心动满的 offer（after 钩子，产品触发器）
  schedulers.ts  后台任务登记
lib/           领域模块（引擎门面、记忆、外出、通话、媒体、语音……）；lib/chat.ts 是界面唯一的会话入口
content/       角色、地点、日历数据；prompts/ = 全部 prompt 文本，一用途一文件（index.ts 头部是索引，D-087）
store/         zustand 单 store（切片是下一轮）
app/           界面（expo-router）；只调 lib/ 与 features/ 的 send 函数，不直接碰引擎 / 记忆
tests/         vitest：prompt 快照、回合管线、引擎工具函数
```

## 3. 一条管线

```
sendText / sendCard / sendVoice / sendImage / respond
  → mode.append(她的消息) + mode.creditUserTurn(心动 / XP)        ← 会话模式
  → runTurn
      mode.context()                                            ← 组 EngineContext
      generateReply
        暗面路由（系统层，不可拆）
        assembleSystemPrompt（分段表）                            ← promptSections
        completeChat（选供应商 → 定取路 → 请求）                   ← chatProviders
        splitBubbles / stripStageDirections（条数与剥不剥由模式定）
        stripReplyMarkers（剥暗号 → reply.flags）                  ← replyMarkers
      等一会儿（按字数）→ typing 关
      每条气泡：turnHooks.bubble（可改写，例：改成语音）→ mode.append
      按 flags 逐个 marker.apply（落状态）
      turnHooks.after（记忆 / 约定识别 / 心动满的 offer……）
```

会话页、外出页、通话、查手机、爽约提醒、TA 写记事本都走这一条，只传不同的 `scope` 与 `ui`。
失败不吞：模型调用失败在会话里落一条系统消息露出原因（D-069），并作为 `error` 返回。

## 4. 一个玩法长什么样

以红包为例（`features/red-packet.tsx`）：

```ts
promptSections.register({ name: 'red-packet', modes: BONDED_FAMILY, order: ORDER.redPacket, lines: () => [RED_PACKET_RULE] });
replyMarkers.register({ key: 'openRedPacket', mark: RED_PACKET_MARK, apply({ scope }) { /* 最近一个没拆的标已领取 */ } });
cardKinds.register({ type: 'redpacket', bubbleColor: '#E5533D', contextText: (c) => `（她给你发了一个 ${c.title} 的红包…）`, render: (c) => <…/> });
export async function sendRedPacket(bondId, amount, note, ui) { /* sendCard + 这轮没拆就标「TA 没拆」 */ }
```

规则文本 `RED_PACKET_RULE` 在 `content/prompts/red-packet.ts`；玩法文件只声明「它进哪些模式、排第几」。
在 `features/index.ts` 注释掉这一行，红包的规则、暗号、卡片一起消失——这就是「可插拔」。

## 5. 菜谱

| 要加的东西 | 做法 |
|---|---|
| 一家新的聊天供应商（OpenAI / DeepSeek 官方 / 硅基流动） | `features/providers.ts` 加一个 `ChatProvider`（id / label / localKey / complete）并 register；代理侧在 `supabase/functions/ai` 加同名服务；`core/config.ts` 登记 key；`.env.example` 补一行 |
| 一条要进多个模式的规则 | 文本写进 `content/prompts/` 对应用途的文件（都用的进 shared.ts）；`promptSections.register({ modes, order: ORDER.xxx, lines })`；跑 `npm test` 看快照 diff 是不是你想要的，再 `npx vitest -u` |
| 一种新的会话模式（群聊、故事章节） | `EngineContext.mode` 加一个字面量；`features/modes.ts` 实现 `ConversationMode`；`features/prompts.ts` 里各分段的 `modes` 加上它（或它自己的分段）；界面用 `sendText({ mode, … })` |
| 一种新的卡片（分享一首歌、送礼物） | 新建 `features/xxx.tsx`：`cardKinds.register`（contextText + render）+ `sendXxx()`；在 `features/index.ts` import；会话页的「+」面板加一项调用 `sendXxx` |
| 模型能发出的一个新暗号（[送礼物]） | 暗号常量进 `content/prompts/<玩法>.ts`；`replyMarkers.register({ key, mark, apply })`；提示模型怎么用它 = 一段 promptSection |
| 一个回合后要做的事（成就、剧情触发） | `turnHooks.after.on(({ scope, ctx, reply, mode, ui }) => …)`；要改气泡本身用 `turnHooks.bubble.on` |
| 一个后台调度器（TA 主动来找你、morning call） | `features/schedulers.ts` 里 `jobs.register({ id, on: ['launch','foreground'], run })` |
| 一项工程配置 | `core/config.ts` 加字段（必须是字面量的 `process.env.EXPO_PUBLIC_XXX`），`.env.example` 补说明 |
| 桌面上的一个 App | 仍是 `constants/apps.ts` 的注册表（供给纪律：无内容供给不上架） |

## 6. 纪律

1. **`core/` 不认识任何具体玩法**：出现「if 红包」「if 千帆」就是放错地方了。
2. **界面只调 `lib/chat.ts` 与 `features/*` 的 send 函数**，不 import 引擎、记忆、约定识别。
3. **新行为挂扩展点，不改管线**：`core/turn.ts` 加分支要在本文 §3 更新流程图并入档。
4. **模型看得见的字**：全在 `content/prompts/` 目录，一用途一文件，一段只属于一个用途（一般对话与外出各自一份、立绘与拍照各自一份，不在段里按模式切换）；玩法自己的一句话提示语（卡片进上下文的那句、发出时的舞台提示）随玩法文件。
5. **改到模型看到的字，快照必红**：`npm test` 是改 prompt 的第一道验收；只在确认 diff 是你想要的之后更新快照。
6. **配置错误要响**：底座没启动就调用会抛「底座未启动」，不会静默空转。

## 7. 测试

```
npm test              # vitest run：prompt 快照（对话 14 份 + 任务类 26 份）、回合管线（假供应商 + 真 store）、引擎工具函数
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
```

`tests/setup.ts` 把 react-native / expo-* 换成最小桩，所以底座与玩法能在 node 里跑；界面组件不在测试范围。

## 8. 下一轮

- **store 切片**：`store/app-store.ts`（859 行）按领域拆 slice（bonds / square / outing / desktop / notes…），持久化形状不变。
- **语音 / 生图接缝**：`lib/tts.ts`、`lib/media.ts`、`lib/imagegen.ts` 里的直连 / 代理判断各自手写，按 `ChatProvider` 的样子抽成 `SpeechProvider` / `ImageProvider`。
- **记忆接缝**：`lib/memory.ts` 的本地 mem0 式实现换自托管服务时，接口不变。
- **i18n 按玩法拆**：`lib/i18n.ts` 的词典可由玩法文件各自登记。

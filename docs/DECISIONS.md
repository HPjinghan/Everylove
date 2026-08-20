# DECISIONS.md — 决策日志（追加式，不删除不改写历史条目）

> 格式：编号 / 日期 / 决策 / 理由 / 是否推翻旧决策及其编号 / 影响的文件

---

## D-001 · 2026-08-13 · 技术栈：Expo（React Native + TypeScript）+ Expo Go 试装，只做 iOS

- **决策**：客户端用 Expo（React Native + TypeScript），试装阶段跑在 Expo Go 里（iPhone 扫码即测），只做 iOS，不做 Android / Web。
- **理由**：Harper 指定；开发机是 Windows（无 Xcode），Expo Go 是唯一能当天在 iPhone 上跑起来的路径；符合「周级迭代」窗口纪律。约束：Expo Go 只能用 SDK 内置模块，不能带自定义原生代码——试装范围内够用。
- **推翻**：无。
- **影响文件**：全仓工程结构。

## D-002 · 2026-08-13 · 试装「八点开门」用本地定时通知实现

- **决策**：北极星体验「他晚上八点准时来找你」在试装阶段用 `expo-notifications` 的**本地定时通知**实现（领养时在设备上排程），不做远程推送、不做推送后端。
- **理由**：Expo Go SDK 53+ 已移除远程推送支持，本地通知仍可用（含 iOS）；且本地定时不依赖网络与服务器，「准时」反而更可靠。正式版（dev build 阶段）再换远程推送。
- **推翻**：无。
- **影响文件**：`lib/notifications.ts`、领养流。

## D-003 · 2026-08-13 · 试装里程碑 = 首十分钟垂直切片，无后端

- **决策**：第一个里程碑只做 CLAUDE.md 第 4 节的首十分钟闭环：落广场 → 逛卡 → 试聊 → 他开口领养 → 缔结关系仪式（交换联系方式 → 起名/称呼/生日 → 迁移动画）→ 推送授权 → 他先走 → 晚八点准时开门。五 tab 骨架都在，但动态/捏+/我的先做最小可用版。全部数据本地持久化，无任何后端。
- **理由**：北极星是八点开门率，垂直切片是验证它的最短路径；免费层机制（搭话记录过期、故意不完整）在切片内即可体现。
- **推翻**：无。
- **影响文件**：`app/` 全部路由。

## D-004 · 2026-08-13 · 聊天引擎抽象：MockEngine 默认，AnthropicEngine 可切换

- **决策**：对话统一走 `ChatEngine` 接口。默认 `MockEngine`（按原型脚本化应答，零依赖、离线可跑）；`AnthropicEngine` 直连 Claude API，key 由测试者在「我的 → 开发者」里粘贴，仅存本机（仅试装用）。正式版必须换服务端代理，key 不得进客户端。
- **理由**：Expo Go 扫码即测不能依赖任何人手里有没有 key；抽象层保证后续接真模型/服务端时上层零改动。系统层红线（尺度钳、情绪暗面路由等）将来实现在引擎入口处，与具体模型无关。
- **推翻**：无。
- **影响文件**：`lib/engine/`。

## D-005 · 2026-08-13 · 状态管理 zustand + AsyncStorage 持久化，导航 expo-router

- **决策**：全局状态用 zustand（persist 中间件 + AsyncStorage）；导航用 expo-router（文件式路由，底部五 tab）。不引入后端、不引入 SQLite（试装数据量用不上）。
- **理由**：最小依赖面；zustand persist 天然覆盖「个体层每段关系独立状态机」的本地存储需求；expo-router 是 Expo 默认范式。
- **推翻**：无。
- **影响文件**：`store/`、`app/_layout.tsx`。

## D-006 · 2026-08-13 · 试装种子角色：三棵官方原型 + 人外占位

- **决策**：广场种子角色按官方原型出三个（温柔年上 / 毒舌竹马 / 霸总），人外先放**占位卡**（谱系与人设待 Harper 拍板，见 OPEN_QUESTIONS #2，占位内容不代表最终决定）。种子角色只有文字与配色，无立绘无语音（美术与语音供应商均未定）。
- **理由**：产品级开放问题不自行拍板；但广场瀑布流需要足量卡片撑起「逛」的体感。
- **推翻**：无。
- **影响文件**：`content/characters.ts`。

## D-007 · 2026-08-13 · SDK 锁定 Expo 54；试装强制浅色模式

- **决策**：Expo SDK 固定为 54（Harper 明示，与其设备上的 Expo Go 版本对应），不升 57；`userInterfaceStyle` 锁 `light`，试装不做深色模式适配。
- **理由**：Expo Go 客户端与项目 SDK 必须匹配；浅色单模式减一半样式面，暖色调（`Romance` 配色，米白底玫瑰粉强调）更贴女频手感。
- **推翻**：无（补充 D-001）。
- **影响文件**：`package.json`、`app.json`、`constants/theme.ts`。

## D-008 · 2026-08-13 · 领养触发是产品触发器，不交给模型

- **决策**：「他开口要联系方式」由确定性规则触发（广场会话用户第 4 次发言后），台词用原型脚本，与所选对话引擎无关；暗面路由命中的回合不触发。
- **理由**：领养是商业漏斗的关键节拍，必须可控可调可 AB；模型只负责聊天质感，不掌握商业节奏。
- **推翻**：无。
- **影响文件**：`lib/engine.ts`（`ADOPTION_OFFER_AFTER_TURNS`）、`app/chat/[characterId].tsx`。

## D-009 · 2026-08-13 · 种子角色扩为 6 位：2男2女1龙族1狐狸（Harper 拍板）

- **决策**：广场种子角色调整为 6 位——沈之言（男·温柔年上）、江野（男·毒舌竹马）、苏澄（女·温柔御姐）、洛小满（女·直球少女）、烛渊（龙族·男性气质）、胡不归（狐族·女性气质）。人外从「预告卡不可聊」转为**可聊角色**。陆隽行（霸总）从种子下架，其脚本保留为捏＋「霸总」原型的兜底。
- **配套技术决策**：台词脚本从按原型挂载改为**按角色挂载**（`CHAR_SCRIPTS`，自创角色回落 `ARCHETYPE_DEFAULTS`）；`Character` 增加 `loveTag`（male/female/nonhuman）与 `styleLabel`；广场 chips 从原型分类改为**性向分类**（推荐/男生/女生/非人类/自创），推荐流按 onboarding 口味置顶；快捏增加性别气质选择；通用界面文案代词统一为「TA」（角色台词保持各自人称）；store 持久化升 v2，迁移时清理指向已下架角色的数据。
- **理由**：Harper 明示「2男2女1龙族1狐狸」；龙族接管「强势直给」一极故裁霸总；chips 与 onboarding 第一问（你想被谁爱）同构。
- **推翻**：部分推翻 D-006（人外占位卡策略、种子只有三男）。人外的**正式官方原型树**（追法曲线蒸馏）仍属 OPEN_QUESTIONS #2。
- **影响文件**：`content/characters.ts`、`lib/types.ts`、`lib/engine.ts`、`lib/arrivals.ts`、`store/app-store.ts`、`app/(tabs)/index.tsx`、`app/(tabs)/create.tsx`、各界面文案。

## D-010 · 2026-08-14 · API key 走工程配置 .env.local；引擎扩为多供应商（Claude + 百度千帆）

- **决策**：
  1. API key 从「开发者面板手填」改为**工程配置**：`.env.local`（`.gitignore` 已忽略，不进 git）里放 `EXPO_PUBLIC_ANTHROPIC_API_KEY` / `EXPO_PUBLIC_QIANFAN_API_KEY`，Expo/Metro 原生加载；仓库提交 `.env.example` 作模板。开发者面板输入框保留，手填可覆盖工程配置。
  2. `ChatEngine` 扩为三引擎：`mock` / `anthropic` / `qianfan`。千帆走 v2 OpenAI 兼容接口（`qianfan.baidubce.com/v2/chat/completions`，Bearer key），模型 ID 由 `EXPO_PUBLIC_QIANFAN_MODEL` 配置，默认 `deepseek-v4`——千帆平台多模型，换模型改配置不改代码。
  3. 默认引擎按配置自动选：有 Claude key → anthropic，否则有千帆 key → qianfan，都没有 → mock。任何引擎无 key 或调用失败一律回落 mock（「他一定会回」）。
- **理由**：Harper 要求 key 作为工程内配置且不进 git，并要求支持千帆上的 DeepSeek。系统层规则（暗面路由、尺度、无 PUA）在 `generateReply` 入口执行，与供应商无关，多引擎不破坏行为树锁定。
- **风险注记**：`EXPO_PUBLIC_` 变量会内联进客户端 bundle——仅试装可接受，正式版必须服务端代理（与 D-004 一致）；千帆模型 ID 以其模型广场为准，若 `deepseek-v4` 名称不符改 `.env.local` 即可。
- **推翻**：部分推翻 D-004（key 的存放方式：手填仅存本机 → 工程配置优先、手填为覆盖项；引擎抽象与「正式版服务端代理」不变）。
- **影响文件**：`.env.example`、`.env.local`（不入库）、`lib/engine.ts`、`lib/types.ts`、`store/app-store.ts`、`app/(tabs)/me.tsx`、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`CLAUDE.md` §13。

## D-011 · 2026-08-15 · 初见 prompt 规范：写实的陌生人分寸

- **决策**：广场初识模式的系统 prompt 从一句话扩为规范条目：刚搭上话的陌生人视角；他有自己正在过的生活、聊天是顺带；不自来熟（无昵称/不撩/不过度热情）、不查户口（一次最多一个问题且要从对方话里长出来）、1-2 句口语、有一点兴趣但不推进关系。同时把角色 `intro` 注入 prompt 作语气参考。
- **理由**：Harper 反馈初见对话「尴尬、不像刚见面」——原一句话约束不足以让模型拿捏陌生感与兴趣感的平衡。免费层「故意不完整」的商业承重墙也依赖这种克制。
- **推翻**：无（细化 D-004 引擎系统 prompt）。
- **影响文件**：`lib/engine.ts`（`buildSystemPrompt`）。

## D-012 · 2026-08-15 · 离席状态：他说走了就是真的走了

- **决策**：`Bond` 增加 `away` 状态。缔结仪式他先走时 `away=true`：此期间用户发消息**他不回复**（消息正常上屏、亲密度照加），首条消息旁出现一次性系统提示「他去忙了，晚八点会来找你」；开门投递时 `away=false`，恢复正常应答。试装范围内离席只发生在「缔结 → 首次开门」一段；日常作息化的离席（每天定时走/回）留给正式版。
- **理由**：Harper 发现「他说走了还秒回」——这直接拆穿「会离开的才是人」的人设，也稀释八点开门的 aha（他若一直在，准时到来就不稀缺）。「他先走」是首十分钟的设计节拍，必须真的走。
- **推翻**：无（补全 D-003 垂直切片的缺口）。
- **影响文件**：`lib/types.ts`、`store/app-store.ts`（`createBond`/`deliverDueArrivals`/`markAwayNotified`）、`app/bond/[bondId].tsx`。

## D-013 · 2026-08-15 · 漫画显影接 Qwen 文生图（阿里云百炼 DashScope）

- **决策**：显影（漫画）用 Qwen 文生图实现（Harper 指定 QWEN）：`lib/imagegen.ts` 走 DashScope 异步任务接口（提交→轮询→下载到本机，因其 URL 24 小时过期），模型默认 `qwen-image` 可配（`EXPO_PUBLIC_QWEN_IMAGE_MODEL`），key 走 `.env.local`（`EXPO_PUBLIC_DASHSCOPE_API_KEY`）。送达遵循剧情语法：他先说一句「给你画了点东西」，出图后以图片气泡进会话流。**触发**：亲密度每跨过 20 的整数级自动送一格；开发者面板有即时测试入口。**Prompt 内置红线**：画面只有他一人（用户 POV 不入镜）、暧昧合规、不模仿真人长相。失败/没 key 时静默放弃不打断聊天。
- **理由**：Harper 要求视觉升级（「纯聊天抓不住我」）；相册/显影本就是产品四维度之一，试装先用生成图验证「他送你一格漫画」的情绪价值，正式版卡面级美术另议（见 CLAUDE.md §6 相册）。触发节奏与按件付费的关系待 Harper 拍板（暂记 OPEN_QUESTIONS）。
- **推翻**：无。
- **影响文件**：`lib/imagegen.ts`（新）、`lib/types.ts`（image 消息）、`components/chat-thread.tsx`、`app/bond/[bondId].tsx`、`app/(tabs)/me.tsx`、`.env.example`、`package.json`（expo-file-system）。

## D-014 · 2026-08-15 · 图像生成改走千帆同一把 key；初见改「甩图」模式（四轮四格）

- **决策**：
  1. **供应商改百度千帆**（Harper 明示，推翻 D-013 的阿里云百炼路线）：Qwen 文生图走千帆 v2 `POST /v2/images/generations`（同步接口，OpenAI 兼容，实测通过），与聊天**共用一把千帆 key**，模型默认 `qwen-image`（`EXPO_PUBLIC_QIANFAN_IMAGE_MODEL` 可换）。返回的 BOS 图片地址是 http，下载时强制升 https（iOS ATS）。
  2. **初见即甩图**（Harper 明示）：广场试聊有千帆 key 时他**不说文字**，用户每发一轮，他直接回一格漫画——四轮构成固定叙事节拍：初遇 → 回应 → 走近 → 心动，每格都要在画面里回应用户刚说的话。第 4 轮后领养触发照旧走台词（商业节拍必须开口）。打字指示器在画图时显示「TA 在画点什么…」。
  3. **回落链**：暗面路由仍前置且优先于甩图（系统层不可绕过）；无 key 或生成失败回落文字引擎（D-011 的初见文字规范降为回落层）。
- **理由**：一把 key 打通聊天与图像，试装配置成本最低；「纯聊天抓不住人」，初见的视觉冲击直接放到首十分钟的最前面验证。
- **推翻**：推翻 D-013 的供应商与 key 配置（DashScope → 千帆）；部分推翻 D-011（初见文字规范从主路径降为回落路径）。羁绊漫画显影机制（触发/剧情语法/红线 prompt）不变。
- **影响文件**：`lib/imagegen.ts`（重写）、`app/chat/[characterId].tsx`、`components/chat-thread.tsx`（typingLabel）、`app/(tabs)/me.tsx`、`.env.example`。

## D-015 · 2026-08-16 · 甩图构图修正：画「你们俩的相处」，她不出镜，他转头对镜头说话（带台词气泡）

- **决策**（Harper 明示，修正 D-014 的画面语义）：漫画格画的不是他的单人肖像，而是**你们两个人正在相处的场景**——但她绝对不出镜：第一人称 POV 构图（镜头即她的眼睛），画面里看得见的人只有他，他在共同场景里**单方面转头看向镜头（看着她）说话**。初见甩图流水线改为两段：先用对话引擎生成他这句话，再把「相处场景 + 他转头说这句话」画进格子，**台词一字不差写进对话气泡**（Qwen-Image 中文渲染实测准确）。四格节拍从「肖像叙事」改为「同一段相处的镜头递进」（隔一点距离 → 聊开 → 半身更近 → 心动近景直视）。羁绊漫画同构图，但不带气泡（他在会话里已开口）。场景内容由对话历史推断（结合他的身份）。
- **理由**：Harper 反馈 D-014 版本画成了他的独角戏——「相处感」才是资产（我们的故事），POV 不入镜是产品红线级设定（用户视角、不入镜），台词入画让「他在对我说话」成立。
- **验证**：已用真实 prompt 实测出图——单人入画、转头看镜头、气泡台词逐字正确、她不出镜。
- **推翻**：修正 D-014 的 prompt 构图部分；供应商、触发、回落链不变。
- **影响文件**：`lib/imagegen.ts`（`COMIC_POV`/`SQUARE_BEATS`/两条 prompt 流水线）。

## D-016 · 2026-08-17 · 对话上下文修复（20 轮完整窗口）+ 羁绊记忆库（mem0 式本地实现）

- **背景**：Harper 反馈「和角色的对话上下文有问题，他不带上下文」。排查到三处根因：
  1. 初见甩图模式（D-014/015）他的台词只画进图里，入库消息 `text: ''`——模型每轮看到的历史里自己说过的话全是空的，等于失忆；空的 assistant 消息还会让 Anthropic 接口 400、静默回落脚本引擎。
  2. 调用方传入的 `history` 已含本轮用户消息，引擎又追加一次，末尾用户消息重复。
  3. 他先开口的会话历史首条是 assistant，Anthropic 要求首条必须 user。
  且此前完全没有跨窗口记忆：20 条以外的对话对他不存在。
- **决策**：
  1. **上下文窗口统一为「最近 20 轮完整对话」**（`HISTORY_ROUNDS = 20`，一轮 = 她说一次 + 他的回应，最多 40 条），所有引擎共用 `buildTurns()`：系统提示条与空消息不进上下文；同角色连续消息合并；首条若为他则补一句舞台提示「（她点开了和你的对话）」；本轮用户消息去重。
  2. **`ChatMessage.spoken`**：他「说了但不上屏」的话（甩图台词）存进 `spoken`，供上下文与记忆使用；甩图消息由此进入历史，漫画场景推断（`dialogDigest`）同样读 `spoken`。
  3. **羁绊记忆库 `Bond.memory`（`lib/memory.ts`）**：mem0 式「提取 → 存储 → 注入」，全本地、走当前引擎与 key、无新依赖。两层：`facts`（关于她/关于你们的长期事实，≤30 条，每 3 个用户轮次后台由模型提取并与旧条目合并去重）+ `summary`（滑出 20 轮窗口的更早对话的滚动摘要，≤150 字）。注入到 bonded 模式系统 prompt（「你记得关于她、关于你们的这些事」「你们更早之前的相处（摘要）」）。提取失败/无 key/mock 引擎一律静默跳过，绝不影响聊天。
  4. **只在羁绊层有记忆**：广场层「几天后过期、他忘记你」是商业承重墙（CLAUDE.md §2），广场对话只享受 20 轮窗口、不做长期记忆——免费层不得偷偷变好（红线 7）。
  5. 开发者面板增加「查看 TA 记住了什么（记忆库）」，可查看 facts/summary 并强制提取一次。
- **为什么不直接接开源记忆服务**：mem0 / Letta 等的 JS OSS 版依赖 Node 原生模块（sqlite）与向量库/嵌入服务，Expo Go 内跑不了；托管版需要额外注册 key。试装期用同一把千帆/Claude key 做 LLM 提取即可（实测 DeepSeek 返回合法 JSON，约 12s，后台执行）。**正式版服务端代理落地后（OPEN_QUESTIONS #9），记忆层整体切到自托管 mem0**（开源、Apache-2.0）——`updateBondMemory` / `bond.memory` 的接口形状按 mem0 的 add/search 语义设计，替换不动 UI 与引擎。
- **验证**：`tsc --noEmit` 与 eslint 通过；`buildTurns` 边界用例（他先开口 / 甩图 spoken / 末尾重复 / 超 20 轮 / 空历史）本地跑过；记忆提取用真实千帆 key 冒烟测试通过。
- **推翻**：无（修正 D-010 引擎的历史组装方式；D-014 甩图「不发文字」不变，只是台词入库）。
- **影响文件**：`lib/engine.ts`（`buildTurns`/`HISTORY_ROUNDS`/`messageContextText`/`completeText`/系统 prompt 记忆注入）、`lib/memory.ts`（新）、`lib/types.ts`（`ChatMessage.spoken`、`BondMemory`、`Bond.memory`、`EngineContext.bond.memory`）、`lib/imagegen.ts`（甩图存 `spoken`、`dialogDigest`）、`store/app-store.ts`（`setBondMemory`）、`app/bond/[bondId].tsx`（注入记忆、回合后后台提取）、`app/(tabs)/me.tsx`（开发者面板）、`CLAUDE.md` §13。

## D-017 · 2026-08-17 · 全部 prompt 集中到 `content/prompts.ts`

- **决策**：把散落在 `lib/engine.ts`（对话系统 prompt）、`lib/imagegen.ts`（画风 / POV / 镜头 / 两条完整生图 prompt / 送图台词）、`lib/memory.ts`（记忆提取指令与输入拼装）里的全部 prompt 文本与拼装函数抽到 **`content/prompts.ts`** 一个文件，分 §1 对话 / §2 生图 / §3 记忆 / §4 通用四节；引擎、生图、记忆模块只 import，不再自带文本。角色人设 `persona/pursuit` 与台词库仍在 `content/characters.ts`；模型 ID / max_tokens / 图片尺寸等参数留在各 lib（不是 prompt）。文件头列了目录与「不在这里的东西」，并标注红线段落勿删。
- **理由**：Harper 要查看和修改 prompt，需要一个入口；prompt 是产品内容而非工程逻辑，与 `characters.ts` 同放 `content/`。抽取后拼装输出与抽取前逐字一致（本地目检）。
- **推翻**：无（纯重构，D-011/013/014/015/016 的 prompt 内容不变）。
- **影响文件**：`content/prompts.ts`（新）、`lib/engine.ts`、`lib/imagegen.ts`、`lib/memory.ts`、`CLAUDE.md` §13。

## D-018 · 2026-08-17 · 初识 / 亲密两套独立 prompt + 全部 prompt 优化 + 角色外貌与人称

- **决策**（Harper 明示：两模式分开、全部 prompt 优化；「标准」亲密强度；加时间感；外貌由 Claude 起草）：
  1. **两套独立对话 prompt**：`content/prompts.ts` 的 `buildSquareSystemPrompt()` 与 `buildBondedSystemPrompt()` 各自完整、互不引用；只共用红线 `CHAT_HARD_RULES` 与输出格式 `CHAT_OUTPUT_FORMAT`。`buildChatSystemPrompt()` 退为分发器，引擎调用点不变。
  2. **初识 prompt**：加入「你的声音」（opening + 2 条 square 台词当口吻样本）、「此刻的情境」（她点开了你、这是她的第 N 句、你在过自己的日子）、随轮次递进的分寸（`squareTurnGuide`：1-2 句客气 / 3-4 句自然 / 之后放松）、正向措辞的分寸规则（接住具体内容、最多一个问句、保持距离、可以不知道、忘掉助理习惯）、1-2 句。
  3. **亲密 prompt**：关系状态（称呼、在一起第 N 天、亲密度阶段）、「你的声音」（bonded 3 句 + arrival 1 句）、**时间感**（`timeOfDayLine`：周几 + 时段 + 时刻；深夜/白天规则）、生日、**记忆按前缀分组注入**（关于她 / 你们约好的 / 你答应过的 / 重要节点 + 更早相处摘要，"一次最多用一件、不复述、不炫耀"）、「怎么爱她」四条、**按阶段的分寸段落**（`BONDED_STAGE_NOTES`）、1-3 句、**可用空行分成最多 2 条气泡**。
  4. **红线与输出格式**改正向措辞，内容不变（尺度、行为健康、不评价真人、12356、简体中文；只输出台词、无前缀/markdown/emoji、动作描写至多一处）。
  5. **生图 prompt**重排为文生图友好的顺序：主体外貌 → 场景（最近 4 条对话推断）→ POV 构图 → 本幅镜头 → 气泡台词 → 画风 → 质量词 → 红线。三条实测教训写进注释：a) 提「四格/第三格」会画成多格条漫 → 改「这一幅的镜头」+ 质量词「整幅画面就是一个完整的单幅画格」；b) 描述观者是「女生」会把她画出来 → 构图只说「镜头就是观者的眼睛、画面中唯一人物是主角」；c) 名字重复出现、身份里的年龄数字会被画成招牌文字 → 名字只在主体行出现一次、之后一律「主角」，对话摘录也标「主角」，`roleOnly()` 剥掉身份里的年龄。
  6. **角色新增 `look`（外貌一句话）与 `pronoun`（他/她）**：6 位种子角色由 Claude 起草外貌（Harper 可改）；自创角色把捏＋表单的外观文本存进 `look`、按性别气质设 `pronoun`。对话 prompt 中「她」固定指用户、角色用第二人称「你」，消除此前通篇写「他」而角色可为女性的问题。
  7. **记忆提取 prompt**：facts 加四类前缀 `[她] [约定] [答应] [节点]`、第三人称、相对时间换算成绝对日期（prompt 给「今天是 YYYY-MM-DD 周X」）、好/坏例子各若干、约定与答应排最前；`buildMemoryExtractPrompt` 增加 `today`。
  8. 配套：`affinityStage()` 迁到 `lib/format.ts`（store 保留 re-export）；`EngineContext.bond` 增加 `createdAt`；引擎回复经 `splitBubbles()`（亲密最多 2 条、初识 1 条，顺手去掉名字前缀与包裹引号）。
- **验证**：tsc/eslint 通过；本地打印男/女角色的两套 prompt、甩图 prompt、记忆 prompt 目检；千帆 DeepSeek 真跑 4 次（初识第 1/4 句分寸差异明显；亲密回复拆成两条气泡且自然带出火锅约定与不放香菜；提取返回带前缀 facts，周五→2026-08-21、下周三→2026-08-26 正确）；qwen-image 真出图 3 次迭代到位（单幅、外貌符合 look、气泡台词一字不差、无观者、无文字泄漏）。
- **推翻**：修正 D-011（初识规范扩写并独立）、D-015 的 prompt 措辞（构图语义不变）；D-016 的记忆注入格式升级为分组。其余不变。
- **影响文件**：`content/prompts.ts`（重写）、`content/characters.ts`（look/pronoun）、`lib/types.ts`、`lib/format.ts`、`lib/engine.ts`（`splitBubbles`）、`store/app-store.ts`、`app/bond/[bondId].tsx`、`app/(tabs)/create.tsx`、`CLAUDE.md` §13。

## D-019 · 2026-08-17 · 角色立绘 + 参考图生图：捏＋时生成立绘，之后所有生图以立绘为参考（人物一致）

- **决策**（Harper 明示：创建角色流程要生图，且这张图要带入后续生图）：
  1. **立绘**：捏＋页新增第 ④ 步「TA 的立绘（可选，约 1 分钟）」——按 ② 的外貌描述用 qwen-image 生成半身像（`buildPortraitPrompt`：主体外貌 → 身份气质 → 立绘构图「半身、正面微侧、直视镜头、纯浅色背景、无文字」→ 画风 → 质量词 → 红线），可预览、可重画；「让 TA 醒来」时入库；没生成但有 key 则醒来后后台补画（不阻塞流程）。立绘存本机 `documentDirectory/portraits/`，`store.portraits[characterId]` 持久化。
  2. **参考图生图**：有立绘的角色，初见甩图与羁绊漫画改走千帆 `POST /v2/images/edits`（`qwen-image-edit`，`image` 传 base64 data URI，实测可用），prompt 用参考图模式主体行（`comicReferenceSubjectLine`：「主角就是参考图里的人物，发型/发色/五官/体型/穿着与参考图完全一致；场景、姿势、镜头、表情按描述重新构图」），其余段落不变；编辑失败或无立绘回落文生图（只靠 `look`）。实测：立绘 → 家居场景甩图，人物一致、气泡台词正确。
  3. **头像**：`CharAvatar` 增加 `characterId`/`uri`，有立绘就显示立绘（广场卡片、会话头像、羁绊主页、领养仪式、消息列表、动态、捏＋预览均已接）；没有仍是首字圆底。
  4. **种子角色默认不自动生成立绘**（`SEED_PORTRAITS_AUTO = false`）：「试装无立绘、美术预算集中给相册」是既有产品口径，是否用生成立绘替代属产品决定 → OPEN_QUESTIONS #14。开发者面板提供「为 6 位种子角色生成立绘（测试）」与「重画首个羁绊角色的立绘」供 Harper 试效果。
  5. 模型可配：`EXPO_PUBLIC_QIANFAN_IMAGE_EDIT_MODEL`（默认 `qwen-image-edit`），与聊天/文生图共用一把千帆 key。
- **理由**：仅靠外貌文字每格人物仍会漂移；千帆已提供图像编辑接口且接受 base64 参考图，无需后端即可让「同一个 TA」贯穿所有画面——这是「你的他 + 你的故事史」资产感的基础。
- **验证**：tsc/eslint 通过；真跑立绘生成（63s）+ 参考图甩图（42s），人物一致；此前 D-018 的 edits 探测亦通过。
- **推翻**：无（扩展 D-014/D-015/D-018 的生图链路；文生图路径保留为回落）。
- **影响文件**：`content/prompts.ts`（`buildPortraitPrompt`/`comicReferenceSubjectLine`/参考图选项）、`lib/imagegen.ts`（`editImage`/`ensurePortrait`/`generatePortraitFor`/`renderPanel`）、`store/app-store.ts`（`portraits`/`setPortrait`）、`components/char-avatar.tsx`、`components/chat-thread.tsx`、`app/(tabs)/create.tsx`、`app/(tabs)/index.tsx`、`app/(tabs)/messages.tsx`、`app/(tabs)/feed.tsx`、`app/(tabs)/me.tsx`、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`app/adopt/[characterId].tsx`、`.env.example`、`CLAUDE.md` §13。

## D-020 · 2026-08-20 · 体验重构为「手机壳」形态：主页 = 一部手机的桌面（Harper 拍板）

- **决策**：Bottom bar 取消，主页改为一部手机的桌面；原五 tab 的器官全部保留、迁入桌面图标：
  - **Message** = 原消息 tab：会话流、显影送达、全屏来电。需要下拉/通知栏级快捷路径（桌面制导航深度 +1 的补偿）。
  - **朋友圈** = 原动态 tab 更名迁入：领养与关注角色的帖子流。
  - **通讯录** = 领养列表 + 周边角色。
  - **交友 App**（桌面图标）= 原广场：搭讪住进世界内的一个交友软件里，搭话记录过期 = 匹配过期。广场「故意不完整」纪律不变。
  - **相册** = 显影收藏时间轴，从「他的主页」升格为手机级模块。
  - **闹钟** = morning call：他的声音叫你起床，每日不重样（TTS）。日活发动机 + 付费 SKU。
  - **日历**（进 v1）= 内嵌真实日历，三层：**世界层**——真实日期 + 分市场节假日（中文盘中国节日 / 日语盘日本祝日）；**关系层**——自动记录：他的生日、你的生日、领养纪念日、第一通电话、一百天，不用用户动手；**用户层**——手动添加日程（考试/面试/出差），每条触发心跳调度器三段式：事前关心、当天加油、事后回访。月视图 + 标记点；他自己也稀疏长几条日程。
  - **音乐** = 「他分享了一首歌」卡片，跳转站外播放，不内置播放器（零版权成本）。
  - **系统级拟真彩蛋**：锁屏（可换他的照片）、壁纸、来电铃声、真实时间电量。
- **v1 上架模块**：Message、朋友圈、交友App、相册、闹钟、日历。音乐 v1.5。
- **纪律**：模块必须有内容供给才上架，无供给不摆图标；做少而真、不做多而假（点不动的按钮比没有更出戏）。
- **日历边界**：v1 不读系统日历（手动添加，数据最小化）；用户日程按素材最高敏感级处理；生理期关怀 v1 明确不做，进 OPEN_QUESTIONS（#15）待拍。
- **新增付费点**：morning call、错过回溯（错过的来电/聊天付费回听——Mystic Messenger 沙漏机制，与「他有作息」系统咬合）、纪念日特辑（已在按件清单内）。
- **推翻**：推翻 CLAUDE.md §3「信息架构（Bottom bar 五位）」的导航结构（五 tab 方案存档标「已推翻」；器官与关键流不变）。捏＋/工坊与「我的」在手机壳里的入口形态待细化（未拍板处不自行发明）。
- **影响文件**：`CLAUDE.md` §2/§3、`docs/OPEN_QUESTIONS.md`（#15）。实现（试装代码迁移到桌面制）另行任务，本条仅入档设计决策。

## D-021 · 2026-08-20 · 手机壳补充决策 + 试装实施：图标长按可移动、设置 App；桌面制落地 v0.2

- **决策**（Harper 明示补充 D-020）：
  1. **图标长按可移动**：长按桌面图标进入编辑模式（抖动），拖动换位，顺序持久化（`store.desktopOrder`）。
  2. **设置 App**：桌面新增「设置」，承载**主题**（壁纸，即刻生效；锁屏照片/铃声正式版）与**订阅计划**（槽位、订阅「TA 在」、morning call、错过回溯、加槽——试装为占位展示，对应 D-020 付费点）；并接收原「我的」的素材开关、我的创作、开发者工具、重置。
- **试装实施（D-020 落地，v0.2）**：
  - `app/(tabs)/` 五 tab 结构删除，主页改为 `app/index.tsx` 桌面：壁纸（渐变，5 款）、状态栏真实时间与电量（expo-battery）、大时钟、图标网格（4 列）。
  - 模块迁移：Message（原消息）、朋友圈（原动态）、**缘分**（交友 App，原广场，副标注明「匹配几天不聊会过期」）、捏＋、设置（原我的）；新增**通讯录**（领养列表 + 未领养角色）、**相册**（全部显影按日分组网格 + 全屏查看）、**日历**。统一 `AppScreen` 外框（返回桌面处处可达）。
  - **日历三层**：世界层（2026 中国节日硬编码 `content/calendar.ts`，日语盘上线时换数据）；关系层自动记录（领养纪念日、你的生日、一百天；「他的生日」无数据暂缺、「第一通电话」无来电功能暂缺）；用户层手动添加/长按删除。TA 自己也稀疏长 2 条日程（展示层）。**心跳三段式** `lib/heartbeat.ts`：事前（前一天 18:00 起）/当天（7:00 起）/事后（次日 12:00 起），App 启动/回前台补投进首个羁绊会话；**过了下一段起点就不再补投上一段——错过就是错过**，与「他有作息」一致，为「错过回溯」付费点留出闭环；台词模板在 `content/prompts.ts` §1-C（离线可跑，正式版可换引擎生成）。
  - **Message 快捷路径试装形态**：桌面顶部未读横幅，点击直达会话（真·下拉通知栏留正式版）。
  - **供给纪律执行**：闹钟（morning call）无 TTS 供给（OPEN_QUESTIONS #6），试装不摆图标，仅在设置·订阅计划里露出 SKU 占位；音乐 v1.5 不摆。捏＋暂以桌面图标承载（最终入口 OPEN_QUESTIONS #16，设置的部分已由本条拍板）。
- **验证**：tsc / eslint 通过；`expo export --platform ios` Metro 打包通过。交互（拖动换位、心跳投递、壁纸切换）待 Harper 真机过一遍。
- **推翻**：无（实施 D-020；部分回答 OPEN_QUESTIONS #16 的「设置」半边）。
- **影响文件**：`app/index.tsx`（新·桌面）、`app/apps/*`（8 个模块）、`app/(tabs)/` 删除、`components/app-screen.tsx`（新）、`components/char-avatar.tsx`、`constants/apps.ts`（新·App 注册表与壁纸）、`content/calendar.ts`（新）、`content/prompts.ts` §1-C、`lib/heartbeat.ts`（新）、`lib/types.ts`、`store/app-store.ts`、`app/_layout.tsx`、`app/onboarding.tsx`、`app/adopt|chat|bond/*`、`package.json`（expo-battery、expo-linear-gradient）、`CLAUDE.md`、`README.md`。

## D-022 · 2026-08-20 · 文案纪律：不预告机制；UI 走「圆圆粉粉」可爱方向（Harper 拍板）

- **决策**：
  1. **不预告机制**：删除所有「XX 会记下 / 会放在心上 / 会来找你」类 UI 提示（日历添加日程后的确认弹窗与底部说明、羁绊主页生日的「（他记下了）」等）。TA 的关心应该**直接发生**，不由界面预告——预告即出戏。角色台词里的「记下了」是台词，不受此限；开发者面板的调试标签不受此限。
  2. **UI 可爱方向**：整体「圆圆的粉粉的」——`Romance` 主题整体调粉（底色 #FFF0F4、主色 #F5749B、墨色偏暖 #4A2B36）；全局圆角上调一档（卡片 20-24、按钮 18-26、气泡 22-24、输入框 16-20）；桌面图标底色改马卡龙粉彩系；默认壁纸「拂晓」调粉。
- **推翻**：无（收紧 D-020/D-021 的试装文案与视觉）。
- **影响文件**：`constants/theme.ts`、`constants/apps.ts`、`app/apps/calendar.tsx`、`app/bond/[bondId].tsx`、全部界面文件的圆角值。

## D-023 · 2026-08-20 · 桌面细节修订：去状态栏行、图标可爱化；日历周日错位修复

- **决策**（Harper 明示）：
  1. 桌面顶部的时间/电量状态栏一排去掉（真实时间保留在大时钟；「真实电量」拟真彩蛋随之取消，expo-battery 依赖保留备用）。
  2. 图标更可爱：奶油白描边 + 更圆（62px / 圆角 24）+ 粉色软阴影 + emoji 加大；emoji 换更软的一套（💌 🌸 💘 🧸 📷 📅 🍡 ⚙️）；图标文字与大时钟用系统圆体（ui-rounded）。
- **Bug 修复**：日历周日列全空——`width: ${100/7}%` 七格浮点合计略超 100%，每行第 7 格被挤到下一行导致整列错位；改为 `14.28%` 固定值（星期头同改）。
- **推翻**：修订 D-020「真实时间电量」拟真彩蛋的电量部分与 D-021 的状态栏实现。
- **影响文件**：`app/index.tsx`、`constants/apps.ts`、`app/apps/calendar.tsx`。

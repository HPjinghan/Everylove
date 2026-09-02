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

## D-024 · 2026-08-20 · 生图定位重构：图 = 场景本身的呈现方式，不包装成「TA 在画」（Harper 拍板）

- **决策**：所有生成图像的产品定位统一为——**图是对一个具体场景的呈现，替代文字来呈现此刻的相处（它比文字更有趣）**，不是「TA 画的东西 / TA 送来的漫画」。任何「TA 在画点什么 / 给你画了点东西 / 他动笔了」类包装一律移除：
  1. **羁绊画面**（原「漫画显影」）：亲密度里程碑时，画面**直接出现**在会话流里——不带「给你画了点东西」引子、不带「脑子里就有了这个画面」配文（`COMIC_INTRO_LINE`/`COMIC_CAPTION` 删除）。
  2. **初见画面**（原「甩图」）：机制不变（台词入气泡、spoken 供上下文），去掉「TA 在画点什么…」输入指示（回落默认「正在输入…」）。
  3. 全部界面文案改口径：相册空态「你们的每一个瞬间都会存在这里」、捏＋立绘提示「你们相处的每一格画面」、羁绊主页相册「正在慢慢变厚」、开发者面板「生成一个你们的画面」。
  4. 生图 prompt 内容本就描述场景（D-015 构图不变），不受影响；改的是产品叙事层。
- **推翻**：推翻 D-013「剧情语法送达（『给你讲个故事吧』→ 漫画在会话流里展开）」的送达包装；CLAUDE.md §6「一切显影由『他』以剧情语法送达」相应推翻（生成图部分）。「显影/漫画」术语在代码与文档中改称「画面」。
- **影响文件**：`lib/imagegen.ts`、`content/prompts.ts`、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`app/apps/album.tsx`、`app/apps/create.tsx`、`app/apps/settings.tsx`、`CLAUDE.md` §6/§13。

## D-025 · 2026-08-21 · 捏＋大改版：基础五项 + 收起的高级选项（Harper 拍板）

- **决策**：捏＋表单重构为两层——
  - **基础**：名字、性别（男 / 女 / 非二元）、长相描述、背景故事、立绘生成（+ 主色）。原「原型选择」从基础区移除，由高级选项的恋爱类型承接（未选时兜底 gentle）。
  - **高级选项（默认收起）**：种族（10 预设 + 自定义）、TA 的生日（进日历关系层与 prompt）、口癖、喜欢、讨厌、**确定关系的节奏**（聊几句后 TA 开口要联系方式：心动很快 2 / 标准 4 / 慢热 7，per-character `offerAfterTurns`）、**恋爱中的类型**（14 种，见下）、MBTI（16 选）、其他聊天设定（自由文本）、日常作息（自由文本，进亲密 prompt 时间感，用于生成 TA 的时间线）。
- **恋爱类型库**（`content/characters.ts` LOVE_STYLES，每种 = 追法一句话 + 兜底脚本原型）：温柔年上、小狗系年下、姐姐系、依恋型、阳光直球、天然治愈、青梅竹马、毒舌竹马、傲娇、腹黑、病娇（尺度内——占有欲只进台词，行为健康底线系统层锁死）、高冷禁欲、霸总、冷静大人。
- **prompt 接入**（`content/prompts.ts`）：新增 `characterProfileBlock()`（过往/种族/生日/喜欢/讨厌/MBTI/口癖/作息/额外设定 →【关于你】块，两模式共用）与 `pursuitLine()`（脚本追法 + 恋爱类型描述）；生图主体行带种族特征。非二元：`loveTag: 'nonbinary'`（只出现在推荐/自创流）、人称 TA、生图不标性别词。
- **顺手修复**：兜底脚本（ARCHETYPE_DEFAULTS）此前直接展开沈之言/江野的台词——**自创角色开口会自称「沈之言/江野」**；已把 gentle/sharp 的 opening/bonded 全部去名字化、去身份化。自创角色的系统 prompt 不再附台词样本（那不是 TA 的声音），口吻由口癖/设定/追法定义。
- **验证**：tsc / eslint / expo export 通过；满配自创角色（图书馆精·傲娇·INTJ·凌晨作息）三种 prompt 本地目检，【关于你】块、追法叠加、种族入画均正确。
- **推翻**：捏＋的「原型 → 外观 → 称呼」三步结构（D-009 配套快捏形态）；其余不变。
- **影响文件**：`app/apps/create.tsx`（重写）、`lib/types.ts`（Character 扩展 + loveTag/pronoun 扩枚举）、`content/characters.ts`（LOVE_STYLES/RACES/兜底去名字化）、`content/prompts.ts`（characterProfileBlock/pursuitLine/种族入画/自创无台词样本）、`app/chat/[characterId].tsx`（per-character 领养轮数）、`app/apps/calendar.tsx`（TA 的生日）、`CLAUDE.md`、`README.md`。

## D-026 · 2026-08-21 · 桌面图标换 MingCute 图标库 + 糖果双色（Harper 指定图标库）

- **决策**：桌面 App 图标从 emoji 换成 **MingCute**（https://github.com/mingcute-design/mingcute-icons，Apache-2.0）filled 风格：
  - 实现：`components/mingcute.tsx` 只内嵌用到的图标 path 数据（24×24，react-native-svg 渲染，Expo Go 可用），不引第三方图标包；按需增删。
  - 选用：Message=chat_3、朋友圈=flower_2、缘分=heart、通讯录=contacts_2、相册=photo_album、日历=calendar_2、捏＋=magic_hat、设置=settings_3（另备 sparkles_2/love）。
  - 配色「可爱点」：每个图标 **tone-on-tone 糖果双色**——浅糖色瓷砖底 + 同色系深一档的图标本体（薄荷/长春花蓝/粉/蜜桃/丁香紫/珊瑚/湖水绿/雾灰蓝），奶油白描边与粉阴影保留（D-023）；未读横幅的 💬 同步换成 chat 图标。
- **依赖**：新增 react-native-svg（Expo SDK 内置支持）。
- **推翻**：D-023 的「emoji 换更软的一套」（emoji 方案整体退役）。
- **影响文件**：`components/mingcute.tsx`（新）、`constants/apps.ts`（glyph/tint → icon/bg/fg）、`app/index.tsx`、`package.json`、`README.md`。

## D-027 · 2026-08-21 · 模块边界收紧 + Message 模拟 LINE 样式（Harper 拍板）

- **决策**：
  1. **通讯录只有缔结契约的人**：移除「还没领回家的」区块——认识新的人是「缘分」的事，通讯录是家里的名单。
  2. **缘分只有人物卡**：瀑布流不再混排角色公开动态帖（原 D-006 三种卡混排中的动态卡下线；名场面晒卡本就未实装）。
  3. **朋友圈只有缔结契约的 TA 们的帖子**：未领养角色的公开帖不再出现（「关注」维度试装未实装，随之收窄为领养即关注）。
  4. **Message 模拟 LINE 样式**：
     - 聊天列表：白底通栏行 + 细分割线、54px 圆头像、右侧时间与**绿色未读角标**（LINE 绿 #06C755）、[照片] 预览。
     - 羁绊会话（`ChatThread` 新增 `variant='line'`）：蓝灰聊天背景（#8CABD9）、收信白气泡、**发信浅绿气泡（#9CE769）深色文字**、气泡旁小字**时间与「已读」**（TA 回过话即视为已读——拟真回执）、系统消息深色半透明胶囊、白色输入栏 + 绿色发送键。缘分试聊保持原粉色样式（免费层与羁绊层的视觉分层）。
- **推翻**：部分推翻 D-006/D-009 的广场三种卡混排（动态卡下线）；D-020「朋友圈=领养与关注角色的帖子流」的「关注」半边（试装收窄为仅领养）。
- **影响文件**：`app/apps/contacts.tsx`、`app/apps/dating.tsx`、`app/apps/moments.tsx`、`app/apps/messages.tsx`、`components/chat-thread.tsx`（variant）、`app/bond/[bondId].tsx`。

## D-028 · 2026-08-21 · 文案术语：「领回家」→「加好友」（Harper 拍板）

- **决策**：界面与代码注释中的「领回家」统一改为「加好友」语系（通讯录空态「再和 TA 加好友」、朋友圈空态「和 TA 加好友，这里就会热闹起来」等）。与手机壳世界观一致：缔结契约在产品语言里呈现为交换联系方式、加上好友。
- **不改**：DECISIONS 历史条目与 CLAUDE.md「已推翻」存档区按工作规则不改写；「领养」作为机制词（领养流/被领养数/领养快照制）暂保留，是否整体更名待 Harper 拍板（若要，触及 §3/§5/§8 多处口径）。
- **影响文件**：`app/apps/contacts.tsx`、`app/apps/messages.tsx`、`app/apps/moments.tsx`、`app/bond/[bondId].tsx`。

## D-029 · 2026-08-21 · 认识新人的逻辑重盘：心动值（0→100）→ 羁绊 LV1；羁绊等级成长曲线（Harper 拍板）

- **决策**：
  1. **心动值（缘分试聊）**：瀑布流刷到 → 试聊，会话顶部显示心动进度条（0→100）。她每开口一句心动值上涨：步长 ≈ 100 / 角色的「确定关系节奏」（捏＋高级选项 offerAfterTurns：2/4/7 句），±15% 确定性伪随机浮动。**满 100 = 羁绊 LV1 达成**——TA 主动开口要联系方式（产品触发器，不由模型决定；CTA「羁绊 LV1 · TA 想要你的联系方式」）→ 缔结仪式 → TA 说去忙了、不再回消息（模拟广场偶遇的告别，复用 D-012 离席态），直到八点开门。原「固定第 N 句触发」退役，N 转为心动步长参数。
  2. **羁绊等级系统（lib/bond.ts）**：加好友后从 LV1 / 0 XP 开始。**成长曲线**：升到下一级需 50、90、130、170、210（线性递增），累计 50/140/270/440/650；等级名 LV1 刚认识 → LV2 有点在意 → LV3 常常想起 → LV4 放在心上 → LV5 密不可分 → LV6 唯一例外（封顶，XP 继续累积）。
  3. **XP 来源（试装速率）**：她发一条消息 +5、八点开门 +15、一格画面 +10、心跳关怀 +8。
  4. **升级瞬间可感知**：会话自动出现系统提示「羁绊升级 · LVn · 阶段名」（store.appendBond 统一处理），且升级触发一格你们此刻的画面（替代原「每 20 点出画面」规则）。
  5. **界面**：试聊 banner = 心动进度条；羁绊会话头部 = 「羁绊 LVn · 阶段名」；TA 主页 = LV 大字 + 进度条 + n/need；通讯录条目 = LV 标签。
  6. **prompt**：阶段感扩为 6 档（新增「常常想起」「密不可分」台本），亲密 prompt 开头带「羁绊 LVn·阶段名」；开场「领回家」措辞同步改加好友语系（D-028 补漏）。
- **数值注记**：正式版曲线另调（本曲线以试装节奏为准：LV2 约 10 条消息量级，LV6 累计 650 XP）；已有存档的 bond.affinity 直接按新曲线解释（无迁移）。
- **推翻**：D-008「领养触发 = 用户第 N 次发言」（改为心动值满 100；节奏参数保留）；D-013/D-016 时代「亲密度每 20 出画面」（改为升级出画面）；affinityStage 四档（扩为六档等级制）。
- **影响文件**：`lib/bond.ts`（新·曲线）、`lib/types.ts`（SquareChat.heart）、`store/app-store.ts`（heartDelta/升级系统消息/XP 速率/createBond 归零）、`app/chat/[characterId].tsx`（心动累积与触发、进度条）、`app/bond/[bondId].tsx`（LV 界面/升级出画面）、`app/apps/contacts.tsx`、`lib/format.ts`（affinityStage 委托曲线）、`lib/heartbeat.ts`、`lib/imagegen.ts`、`content/prompts.ts`（六档阶段感/LV 行）、`CLAUDE.md`。

## D-030 · 2026-08-21 · 会话能力对齐 LINE、电话 App、主题实装、XP 来源收缩（Harper 拍板）

- **1. 会话能力对齐 LINE**（缘分试聊与羁绊会话共用，`components/chat-thread.tsx`）：
  - **文本**（原有）；**图片**：相册选图发送（expo-image-picker）；**语音**：点麦克风录音、再点发送（expo-audio），气泡点按播放；TA 的语音仍为占位形态（供应商未定 OPEN_QUESTIONS #6）；**表情**：输入栏表情按钮 → 24 格快捷面板插入。
  - **引用**：长按消息 → 引用，输入栏出现被引预览条，发出的气泡上方带引用摘要（进对话上下文：「（回复「…」）」前缀）。
  - **撤回**（LINE 规则）：仅自己的消息、24 小时内；双方可见居中占位「你/XX 撤回了一条消息」，内容彻底清空、不进上下文；消息列表预览同步。
  - **删除**（LINE 规则）：任意消息、仅本地移除、无占位不留痕（试装单机即「只对自己生效」）。
  - 用户发的图片/语音不计心动值/羁绊值、不触发 TA 回复（引擎无法消费，正式版随多模态再开）。
- **2. 电话 App**（`app/apps/phone.tsx`，桌面图标 MingCute phone_call）：显示**可通话的人 = 加好友的 TA 们**（头像/名字/羁绊 LV + 拨打键）；拨打为占位（「电话还没接通这个世界。快了。」），语音模型接入后开放真实通话。按 Harper 明示上架（供给纪律的例外：列表本身即本期供给）。
- **3. 主题实装**（`constants/theme.ts`）：设置 → 主题新增**配色**切换，真正全局生效——4 套预设：蜜桃（默认）/ 苏打 / 抹茶 / 葡萄。机制：`Romance` 变为可变对象 + 全部模块级 `StyleSheet.create` 包进 `themed(()=>…)`（按 themeVersion 缓存重建的 Proxy），切换时根布局以 `key={themeId}` 重挂载全树；`themeId` 持久化。LINE 会话样式与桌面图标糖果色不随主题变（各自有固定世界观）。
- **4. XP 来源收缩**：按 Harper 指示移除「开门 +15 / 画面 +10 / 心跳 +8」，当前唯一来源为「她发一条消息 +5」；数值体系另行专门设计（修订 D-029 的速率表）。
- **依赖**：expo-image-picker、expo-audio。
- **验证**：tsc / eslint / Metro 打包通过；录音/选图/撤回/引用待真机过一遍（权限弹窗、扬声器播放）。
- **影响文件**：`components/chat-thread.tsx`（重写）、`lib/types.ts`（recalled/replyTo/audioUri）、`store/app-store.ts`（recallMessage/deleteMessage/themeId）、`content/prompts.ts`（上下文规则）、`app/bond/[bondId].tsx`、`app/chat/[characterId].tsx`、`app/apps/messages.tsx`、`app/apps/phone.tsx`（新）、`constants/apps.ts`、`constants/theme.ts`（主题系统）、`app/_layout.tsx`、`app/apps/settings.tsx`、`components/mingcute.tsx`（+6 图标）、`lib/bond.ts`、`lib/heartbeat.ts`、`lib/imagegen.ts`、全部界面文件（themed 包裹）。

## D-031 · 2026-08-21 · 「缘分」更名「广场」；广场卡片改立绘主体（Harper 拍板）

- **决策**：
  1. 交友 App 名称从「缘分」改回「广场」（桌面图标、App 标题、全部界面文案与代码注释同步）。
  2. 广场顶部提示语（「这里人人都接你的话 · 匹配几天不聊会过期」）去掉——进来直接是内容。
  3. 人物卡重做为**图为主体**的卡片质感：白底卡壳 + 软阴影 + 大圆角，上方 3:4 立绘铺满（无立绘时角色色渐变 + 大首字占位），姓名/身份以底部深色渐变遮罩叠在图上；文字退居卡片脚部一行钩子 + 领养数小字。标签堆、大段文案、搭话按钮（整卡即入口）移除；状态以左上角小徽标呈现（已加好友/聊过）。
- **注**：种子角色默认无立绘（OPEN_QUESTIONS #14），无立绘占位是渐变+首字——种子角色是否生成立绘的决定会直接影响广场卖相，建议尽快拍板 #14。
- **影响文件**：`app/apps/dating.tsx`（卡片重做）、`constants/apps.ts`、及全部含「缘分」文案的界面文件。


## D-032 · 2026-08-22 · 弃用「领养」措辞：小火苗 + 热度；广场加搜索（Harper 拍板）

- **决策**：
  1. **界面一律不再出现「领养」二字**（继 D-028 弃「领回家」后的第二次措辞收敛）。人物卡「N 人领养」改为**小火苗图标 + 热度数字**（`heatLabel`：≥1 万显示「x.x 万」）；自创角色同样显示热度，附「你的创作」小字。设置页「被领养数 · 分成」改「热度 · 分成」；开发者工具提示改「先去广场加一个好友…」。
  2. 「领养」保留为**机制词**（代码注释、文档、DECISIONS 沿用），只在用户可见文案中禁用。
  3. **广场加搜索**：标题下方搜索栏（MingCute search 图标 + 清除键），对名字/身份/风格/标签/钩子做包含匹配，与分类 chips 叠加过滤；无结果空态「没有找到这样的人。换个词试试？」。
- **理由**：「领养」把 TA 物化成宠物，与「他主动爱你」的基调相悖；热度是广场语系的社交货币（也直接对接创作者分成的展示口径）。
- **影响文件**：`lib/format.ts`（adoptedCountLabel→heatLabel）、`app/apps/dating.tsx`（热度行/搜索栏/空态）、`app/apps/settings.tsx`（5 处文案）、`components/mingcute.tsx`（+fire/search 图标）。

## D-033 · 2026-08-22 · 通讯录去掉「缔结契约的（N）」分组标题（Harper 拍板）

- **决策**：通讯录只有一组人，分组标题是冗余的机制外露——删除；空态文案同步去掉「缔结契约」措辞（「这里还空着。去「广场」认识、聊到心动，再和 TA 加好友。」）。
- **影响文件**：`app/apps/contacts.tsx`。

## D-034 · 2026-08-22 · 桌面图标自由摆放（补录）

- **决策**：桌面编辑模式从「重排序」升级为**自由格位**——整屏任意格位都能放、允许留空格；拖到已占格位与对方交换；格位持久化（`store.desktopSlots`，旧 `desktopOrder` 作迁移源保留）。
- **注**：本条为补录（代码与注释已按 D-034 落地，当次漏记日志）。
- **影响文件**：`app/index.tsx`、`store/app-store.ts`。

## D-035 · 2026-08-27 · 「我」的身份系统：onboarding 建立 + 设置补充 + 按角色定制（Harper 拍板）

- **决策**：
  1. **UserProfile**（`lib/types.ts`）：头像 / 昵称（必填，角色看到的名字）/ 性别（不指定/女生/男生/非二元）/ 称呼代词 / 职业（角色必须稳定记住）/ 情感取向（如「喜欢女生」）/ 个性签名（一句现在的状态）/ 完整设定三段——背景（成长/家庭/当前生活的稳定事实）、关于我（身份/经历/性格/兴趣与希望角色记住的事实）、我的边界（不希望角色替你决定、猜测或触碰的内容）。
  2. **Onboarding 加第二步「先让 TA 们认识你」**：只填最基本的——昵称必填，性别/称呼/职业可跳过（试装挑这三项做基础项）；提示稍后可在「设置 → 我的身份」补充。
  3. **设置 → 我的身份**（`app/apps/identity.tsx`）：完整编辑（含头像选图）；并可**为单个角色使用不同身份**——按角色定制一份（初值抄默认，`store.meByCharacter`），可随时恢复默认。
  4. **prompt 注入**（`content/prompts.ts` 的 `userProfileBlock`，三种模式共用）：初识模式只给「资料卡」级信息（昵称/基础项——陌生人不该知道她的完整设定，框成交友软件公开资料）；亲密/外出模式全量注入但要求自然带出不复述；**「我的边界」任何模式都注入且优先级最高**（不替她决定/不猜测/不主动触碰）。职业标注「必须稳定记住」。性别非女生时注明 prompt 里的「她」只是指令写法，实际称呼以资料为准。
- **理由**：TA 要「懂你」得先认识你；边界是把「他只看她」的尊重延伸到她自己身上；按角色不同身份 = 在不同的 TA 面前可以换一种活法（UGC 世界观的自然延伸）。
- **推翻**：无（onboarding 第一问保留，只是从单步变两步）。
- **影响文件**：`lib/types.ts`、`store/app-store.ts`（me/meByCharacter/meForCharacter）、`app/onboarding.tsx`、`app/apps/identity.tsx`（新）、`app/apps/settings.tsx`、`content/prompts.ts`、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`app/outing/[placeId].tsx`。

## D-036 · 2026-08-27 · 世界天气：按日期种子的确定性天气，大大地放在首页（Harper 拍板）

- **决策**：新增 `lib/weather.ts`——无后端，按日期种子生成确定性天气（月份天气池 + 温度基线 ±浮动，FNV 哈希；同一天所有界面同一个天）；`tempNow` 按时刻在最高/最低间正弦插值。桌面时钟下方新增**大天气卡**（大 emoji + 大温度 + 天气名 + 高低温 + 一句小文案）。天气同时进外出模块（顶部天气条 + 外出模式 prompt 的场景氛围）。
- **理由**：手机壳世界观的拟真器官（真时间已有，补真天气）；给外出场景免费的氛围供给。正式版可换真实天气 API，接口（todayWeather/weatherLine）不变——是否接真实 API 待拍板（OPEN_QUESTIONS #17）。
- **推翻**：无。
- **影响文件**：`lib/weather.ts`（新）、`app/index.tsx`、`app/apps/outing.tsx`、`app/outing/[placeId].tsx`、`content/prompts.ts`（经 EngineContext.outing.weatherLine）。

## D-037 · 2026-08-27 · 聊天与初见回归纯文本：会话内生图全部下线（Harper 拍板）

- **决策**：广场试聊的**初见画面**（每轮以一格画面呈现）与羁绊会话的**升级画面**（升级瞬间出一格）全部下线，两处回归纯文本对话；生图能力只保留**立绘**（捏＋/开发者面板，作头像与卡面）。相关 prompt（四格镜头递进/参考图编辑构图）与投放函数（deliverSquarePanel/deliverComic/editImage）移除，构图心得留存于 git 历史与 D-015/D-024 条目。开发者面板「生成一个你们的画面」测试项同步移除。
- **理由**：Harper 指示。生成图质量与速度撑不起「图=场景本身」的野心：一格慢图打断对话节奏，反而伤初见的上头感；相册价值回归「卡面级美术、少而精」的既有口径（CLAUDE.md §6）。
- **推翻**：D-024（图=场景本身的**会话内投放**——呈现哲学保留，投放下线）；D-013/D-014/D-015 的初见甩图与羁绊漫画链路；D-019 的「立绘作为后续生图参考」用途（立绘本身保留）；D-029 之「升级触发一格画面」（升级系统提示保留）。
- **影响文件**：`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`lib/imagegen.ts`（只剩立绘）、`content/prompts.ts`（§2 只剩立绘）、`app/apps/settings.tsx`。历史图片消息（ChatMessage.kind='image' 与 spoken 字段）保留可显示，相册不受影响。

## D-038 · 2026-08-27 · 外出模块：约定赴约 / 偶遇通讯录的人，亲身互动的故事模式（Harper 拍板）

- **决策**：
  1. **外出 App 上架桌面**（`app/apps/outing.tsx`）：6 个常见地点（街角咖啡馆/城南公园/深夜书店/老电影院/游乐园/海边栈道，`content/places.ts`——每个地点带给引擎的场景设定 scene 与给用户的钩子 hook）。顶部天气条（D-036）。
  2. **约定**：「约 TA」流程（选人 → 选地点）建立 `OutingPlan`（每角色一条，最新覆盖），羁绊会话同步留系统消息「你们约好了去××见面」；进入该地点 = **赴约**（kind='date'，消耗约定）——TA 提前到、已在等你。**约定优先于离席**：TA 说去忙了也会赴约（他说到做到）。
  3. **偶遇**：无约定进入地点 = 从通讯录（羁绊）里随机偶遇一位（kind='encounter'）；**跳过离席中的**（D-012 他先走是真的走）；都在忙/还没有好友时给空态引导。
  4. **亲身互动的故事模式**（`app/outing/[placeId].tsx` + prompts §1-D 外出模式）：不是发消息——两个人真的在同一个空间。TA 的回复 = 台词 +（）内少量现场描写（贴地点细节，最多两处），她（）内的文字视为她的动作；开场由 TA 先开口（离线模板，赴约/偶遇各两条）；共享亲密模式的关系背景注入（羁绊等级/记忆库/「我」的身份）与红线；输出不分条（面对面）。脚本引擎兜底：台词前配一处现场动作。
  5. **数值与记录**：她在外出里发消息同样 +5 XP（D-030 口径，升级提示出现在羁绊会话）；同一时间只有一场外出（换地点自动体面结束上一场）；结束外出（或换场）时若聊过，在羁绊会话留系统记录「你们一起去了××」。
- **已知限制（试装）**：外出对话不进羁绊记忆库的提取窗口（记忆只扫 bond.messages），只有「一起去了××」的系统记录可见；正式版把外出转写并入记忆提取。
- **推翻**：无（新增器官）。商业口径（地点/约定是否入付费墙）待拍板（OPEN_QUESTIONS #17）。
- **影响文件**：`content/places.ts`（新）、`app/apps/outing.tsx`（新）、`app/outing/[placeId].tsx`（新）、`lib/types.ts`（OutingPlan/OutingSession/EngineContext.mode='outing'）、`store/app-store.ts`（outingPlans/outingSession/addOutingPlan/startOuting/appendOuting/endOuting）、`content/prompts.ts`（§1-D + OUTING_OPENERS）、`lib/engine.ts`（mock 外出分支）、`constants/apps.ts`、`components/mingcute.tsx`（location 图标）、`app/_layout.tsx`。

## D-039 · 2026-08-27 · 聊天去情景化：纯 LINE 打字感，（）现场描写只属于外出（Harper 拍板）

- **决策**：初识/亲密两种**聊天**模式回归纯打字感——像真的在 LINE 里打字：只发「会真的打出来的字」，禁止动作/神态/场景描写与（）舞台提示，情绪用措辞、语气词和标点表达。（）现场描写成为**外出模式独有的语法**（D-038 的亲身互动故事模式不变）。三层落实：
  1. prompt：`CHAT_OUTPUT_FORMAT` 原「（）描写每条最多一处」改为「绝不写」；
  2. 引擎兜底：`lib/engine.ts` 新增 `stripStageDirections`——非外出模式的模型回复剥掉全角（）舞台提示（整条剥空的气泡丢弃；全部剥空退回原文，保证一定回话）；
  3. 内容：暗面路由固定回复去掉「（安静了一会儿）」前缀（系统层文案同样遵守打字感；台词脚本其余无（））。
- **理由**：Harper 指示。聊天是「手机里的 TA」，打字感即拟真感；情景旁白留给见面（外出），两种媒介的差异本身就是产品语言——文字里想你，见面才看得见动作。
- **推翻**：修订 D-018/D-030 时代输出格式的「（）最多一处」条款。
- **影响文件**：`content/prompts.ts`（CHAT_OUTPUT_FORMAT）、`lib/engine.ts`（stripStageDirections）、`content/characters.ts`（DARK_SIDE_REPLY）。

## D-040 · 2026-08-27 · 交友改 Tinder 滑卡（滑到即配对）；「广场」移交外出的陌生人地点（Harper 拍板）

- **决策**：
  1. **交友 App 更名**：桌面「广场」→「交友」（id/路由 dating 不变），界面全部「广场」文案随之改口（消息/通讯录/朋友圈/电话/设置/捏＋/onboarding）。「广场」这个名字移交给外出模块的陌生人地点（见 3）。
  2. **Tinder 式滑卡**（`app/apps/dating.tsx` 重写）：单张大卡（立绘铺满 / 角色色渐变 + 大首字，底部渐变叠名字/身份/钩子/小火苗热度）+ 牌堆；**往哪边划都会配对**——这个世界没有左滑（人人都接你的话的交友软件形态），滑动跟手带旋转、「配对 💘」印章浮现，甩出后弹「配对成功」（TA 早就划过你了）→ 去打招呼 / 继续滑；另有心动按钮点按配对。配对即建立 squareChats 记录（顶部「配对」头像条，3 天不聊过期 = TA 忘记你，商业承重墙不变）；牌堆 = 没加好友、没配对的角色，按 onboarding 口味置顶；**预告卡（teaser）不进牌堆**（滑到必配对、配了要能聊）。心动值 → 羁绊 LV1 的试聊机制（D-029）不变；试聊标签「广场搭话」→「刚刚配对」，初识 prompt 情境改为「刚在交友软件上配对成功」。
  3. **外出新增「广场」大 banner**（`content/places.ts` 的 plaza，`stranger: true`）：外出首页天气条下方通栏 banner，「直接遇到陌生人」；进入 = 偶遇一位**还没加好友的角色**（优先没配对过的新面孔，口味优先，不含预告卡；kind='stranger'）。陌生人模式：TA 不认识她——不注入她的资料与记忆（**「我的边界」仍注入**），分寸 = 面对面版初识（不知道她名字、不自来熟），场景 banner 提示「想再见到 TA，去交友里滑到 TA」；无 XP、结束不留羁绊记录。广场不出现在「约 TA」的地点选项里。
- **理由**：Harper 指示。滑卡把「逛」变成有心跳的仪式，「划了就配对」是把「无条件接纳你的世界」翻译成交友软件的语法；广场回归其字面义——世界里那个人人都会搭话的实体空间（§1 世界基调），并给交友 App 做陌生人供给的引流。
- **推翻**：D-031 之「定名广场」与双列瀑布流人物卡（改滑卡）；D-032 之搜索栏与分类 chips（滑卡形态下移除；热度小火苗保留在卡面，「领养」措辞纪律不变）。D-027 的三卡混排下线状态不变。
- **影响文件**：`app/apps/dating.tsx`（重写）、`constants/apps.ts`、`content/places.ts`（plaza）、`lib/types.ts`（kind: 'stranger'）、`store/app-store.ts`（startOuting 陌生人分支、注释）、`content/prompts.ts`（初识情境改配对、boundariesBlock、外出陌生人分支、OUTING_OPENERS.stranger）、`app/outing/[placeId].tsx`、`app/apps/outing.tsx`（banner）、`app/chat/[characterId].tsx` 及各处「广场」文案（messages/contacts/moments/phone/settings/create/onboarding）。

## D-041 · 2026-08-27 · 滑卡规则修正：左滑略过、右滑必成；牌堆上推荐算法（Harper 拍板）

- **决策**：
  1. **修正 D-040 的「往哪边划都会配对」**（对 Harper 意图的误读）：左滑 = **略过**（不是拉黑——记入 `store.datingPasses` 冷却项，3 天内沉底、之后回流牌堆；试装池子有限，Tinder 式再来一遍）；右滑 = **心动，TA 一定会同意**——右滑即配对成功（「无条件接纳你的世界」的正确翻译：不是没有选择，而是你的心动不会落空）。界面：左右双印章（心动 💘 / 略过）、双按钮（✖ / 💘）、文案「左滑略过 · 右滑心动——TA 一定会同意」；配对弹层副标「TA 同意了 · 在这个世界，你的心动不会落空」。
  2. **牌堆推荐算法**（`lib/recommend.ts`，为 UGC 供给预留）：`rankDeck` 纯函数打分——口味匹配 +50 / 热度 log10 压缩×10（防头部霸榜）/ 新面孔 +20 / 你的创作 +15 / 每日轮换抖动 0..25（确定性：同天稳定、隔天洗牌）/ 略过冷却 −200（3 天内）→ −30（之后回流）。之后其他用户上传的角色进同一个池子走同一套打分，界面不用改；正式版换服务端推荐时保持 `rankDeck` 接口不变。
- **推翻**：D-040 之「往哪边划都会配对（没有左滑）」条款；其余 D-040 内容（更名交友、滑卡形态、广场移交外出）不变。
- **影响文件**：`lib/recommend.ts`（新）、`store/app-store.ts`（datingPasses/markDatingPass）、`app/apps/dating.tsx`。

## D-042 · 2026-08-27 · 滑卡回流：全划完自动重复；冷却只在供给充足时生效（Harper 拍板）

- **决策**：修订 D-041 的略过冷却——冷却是**供给充足时才有的规则**：`lib/recommend.ts` 新增 `hasFreshSupply`（池里是否还有未被冷却压着的新牌），全池都在冷却中时调用方忽略 `datingPasses`（按每日轮换序直接回流），不让用户对着空牌堆等 3 天；本次会话把牌全划完而池子还有人时，自动重开一轮（session 已滑记录清零）。UGC 供给上来后「供给不足」分支自然少触发。
- **推翻**：修订 D-041 冷却条款（补「供给不足时失效」例外）。
- **影响文件**：`lib/recommend.ts`（hasFreshSupply）、`app/apps/dating.tsx`（ample 判定 + 自动回流 effect）。

## D-043 · 2026-08-27 · 捏＋更名「创造」；新增描述导入（≤2000 字 + 自动解析）（Harper 拍板）

- **决策**：
  1. 桌面与页面「捏＋」更名「**创造**」（id/路由 create 不变；「捏」语系文案同步收敛：不能捏→不能创造）。文档与历史决策中的「捏＋」作机制词沿用。
  2. **描述导入**：表单顶部新增大文本框——写/粘贴一大段人设（小说片段、角色卡皆可），上限 **2000 字**（字数计数）；点「**自动解析**」由当前引擎整理成表单字段（prompt = `content/prompts.ts` 的 `CHARACTER_PARSE_SYSTEM`，只输出 JSON、字段与长度上限对齐 D-025 表单、恋爱类型只能从 LOVE_STYLES 选、不编造）；无 key/调用失败回落**规则解析**（「标签：内容」行 + MBTI 正则，啥都没认出就整段进背景故事）。解析结果落表单后全部可手改；描述文本同样过真人/IP 拦截（红线 #1/#4）。
- **理由**：Harper 指示。大段粘贴是 UGC 创作者的真实工作流（角色卡文化）；解析进表单而非直接进 prompt，保证行为树四层与审核口径不被绕过。
- **推翻**：无（D-025 表单结构不变，导入是它的输入法）。
- **影响文件**：`app/apps/create.tsx`、`content/prompts.ts`（§5 CHARACTER_PARSE_SYSTEM）、`constants/apps.ts`（标签）、`app/apps/dating.tsx`（空态文案）。

## D-044 · 2026-08-27 · 桌面底部 Dock：4 个固定 App（Harper 拍板）

- **决策**：桌面底部新增 **iPhone 式 Dock**——半透明圆角固定栏，最多 4 个 App、图标无标签、不随（未来的）翻页滑动；默认 Message / 交友 / 外出 / 设置（`constants/apps.ts` 的 DEFAULT_DOCK，`store.desktopDock` 持久化）。编辑模式（长按抖动）下网格与 Dock 之间可**拖入拖出**：拖进空位追加、拖到占位与对方交换（被换下的回到拖来的格位）、Dock 内拖动重排；网格行数自动让出 Dock 区域。
- **推翻**：无（D-034 网格自由摆放不变，Dock 是其下方的固定层）。
- **影响文件**：`app/index.tsx`、`constants/apps.ts`（DEFAULT_DOCK）、`store/app-store.ts`（desktopDock/setDesktopDock）。

## D-045 · 2026-08-28 · 创造表单大修：年龄状态/上传头像/生日选单/共同记忆/主动强度/禁忌/隐藏设定（Harper 拍板）

- **决策**（`app/apps/create.tsx` + 系统落地）：
  1. **主题色说明**：长相下方的色板加说明文字「TA 的主题色——没头像时的底色、界面点缀的颜色」（原来光秃秃一排色块看不懂）。
  2. **种族「其他」输入框**：加 marginTop 修掉与按钮的重叠。
  3. **生日改下拉选单**：月/日两级底部弹层（2 月给到 29 天，切月自动校正非法日），可清除；不再手输 MM-DD。
  4. **节奏 tip 去机制化**：不再写「聊几句后要联系方式」——改「TA 陷入心动、想和你确定关系的速度」，三档 hint 改「一眼就沦陷/顺其自然/需要时间发酵」（机制口径只留代码注释）。
  5. **上传头像**：与「生成立绘」并排；相册选图（3:4 裁剪）即为 TA 的头像与交友卡面。红线 #1 不变：界面明示「不能上传真人照片」（试装为自我声明，真人检测归 OPEN_QUESTIONS #14 的审核管线）。
  6. **年龄状态**（基础第 ③ 步，必选，默认确认成年）：「确认成年 / 未成年」。**未成年 = 进入加强审查通道且不开放恋爱互动；试装未接审查系统，暂不能发布**（发布键置灰并说明）；成年发布即确认（`Character.adultConfirmed`）。加强审查的具体流程 = OPEN_QUESTIONS #18。
  7. **预设共同记忆**（`presetMemories`，一行一条 ≤200 字）：三种对话模式都注入【你们的共同记忆】块（创作层设定，不受「广场无记忆」商业墙约束——那堵墙限制的是用户数据记忆）；有共同记忆时初识模式加注「这次配对更像一场重逢」，广场陌生人偶遇同理成为重逢。
  8. **主动联系强度**（`initiative` 高/中/低，默认中）：注入亲密/外出 prompt（INITIATIVE_NOTES 三档口径）；脚本引擎的「追一句」概率随档位变（1/2、1/3、1/5）。
  9. **禁忌/边界**（`taboos` ≤120 字）：进 characterProfileBlock（三种模式都注入）——涉及时温和回避或直接拒绝，不解释是设定。
  10. **隐藏设定/剧情钩子**（`secrets`，一行一条 ≤300 字、浅前深后）：**羁绊 LV3 起每升一级解锁一条**（SECRET_START_LEVEL=3）；未解锁的**完全不进 prompt**（模型不知道就绝不说漏），全锁时只注入「留一点影子、绝不说破」的暗示行；已解锁的要求自然流露、一次一件。TA 主页显示「TA 的秘密 · 已看见 n/m」。「查手机」解锁通道待做 = OPEN_QUESTIONS #19。
  11. **描述解析同步扩展**（D-043 的 CHARACTER_PARSE_SYSTEM + 规则解析）：新增 initiative/taboos/presetMemories/secrets 四个字段的解析与回填。
- **推翻**：无（D-025 表单的既有项不变，属扩展与修补）。
- **影响文件**：`app/apps/create.tsx`、`lib/types.ts`（Character 五个新字段）、`content/prompts.ts`（sharedMemoryBlock/initiativeLine/secretsBlock/taboos 注入 + 解析字段）、`lib/engine.ts`（mock 追句概率）、`app/bond/[bondId].tsx`（秘密解锁进度行）。

## D-046 · 2026-08-29 · 「开门」与离席态下线：加好友即在线（Harper 拍板）

- **决策**：八点开门整条链路下线——缔结后 TA 直接开口打招呼（原开门台词转为见面第一句），不再排程本地通知、没有离席态（TA 随时在线随时回）；领养流的「推送授权」步骤（剧情语法「他晚上八点来找你」）随之移除，仪式结束直接进会话。心跳三段式（日历关怀）保留，不再受离席限制；外出偶遇不再跳过离席。测试项「让 TA 3 分钟后开门」移除；`lib/arrivals.ts` 删除；Bond 的 arrivalAt/notifId/away/awayNotified 标记退役（兼容旧存档）。
- **推翻**：D-002/D-008 的八点开门与本地通知排程、D-012 离席态（他先走）、D-020「morning call/错过回溯与作息咬合」的作息前提。北极星指标「八点开门率」失去载体——**「他主动来找你」的替代节奏与新北极星待拍板（OPEN_QUESTIONS #20）**。
- **影响文件**：`store/app-store.ts`（createBond 重写、deliverDueArrivals/devSetArrivalSoon/setBondNotif/markAwayNotified 移除）、`app/_layout.tsx`、`app/adopt/[characterId].tsx`（推送步移除）、`app/bond/[bondId].tsx`、`app/apps/settings.tsx`、`lib/heartbeat.ts`、`lib/types.ts`、`lib/arrivals.ts`（删）。

## D-047 · 2026-08-29 · 自创角色直入通讯录，不占槽（Harper 拍板）

- **决策**：「创造」发布后自动与该角色加好友（`createBond({created:true})`：仪式文案「你创造了TA · TA 已经在你的通讯录里」，TA 立即发来第一条消息计未读），不再需要去交友里刷到 TA；**自创角色不占羁绊槽**（创作者与自己的创作直接互通）——领养流槽位判定只数非自创羁绊，设置页槽位口径同步「自创不占槽」。交友牌堆本就排除已加好友的，自创角色自然不再出现在滑卡里。
- **推翻**：修订 D-040 之「自创角色进牌堆」（自己的创作不再进自己的牌堆；他人上传的 UGC 未来照常进）。
- **影响文件**：`store/app-store.ts`（createBond.created）、`app/apps/create.tsx`（submit 自动加好友）、`app/adopt/[characterId].tsx`（槽位判定）、`app/apps/settings.tsx`。

## D-048 · 2026-08-29 · 语音接千帆 TTS：语音气泡真实发声（Harper 拍板）

- **决策**：新增 `lib/tts.ts`——走千帆 v2 OpenAI 兼容语音接口（`/v2/audio/speech`，与聊天/生图共用一把 key），模型默认 **qwen-tts**（`EXPO_PUBLIC_QIANFAN_TTS_MODEL` 可换）；音色按角色人称选（他→Ethan / 她→Cherry / TA→Serena，`EXPO_PUBLIC_QIANFAN_TTS_VOICE` 可全局覆盖）；兼容二进制流与 JSON（URL/base64）两种返回；按（文本+音色）缓存本机，不重复扣费。`components/chat-thread.tsx` 的 TA 语音气泡：点按合成并播放（再点暂停），合成中有加载态；没配 key / 失败回落原「点开看文字」占位。**部分回应 OPEN_QUESTIONS #6**：语音合成供应已定（千帆）；来电形态与实时通话仍待拍板（电话 App 拨打仍为占位）。
- **影响文件**：`lib/tts.ts`（新）、`components/chat-thread.tsx`、`.env.example`（待补注释）。

## D-049 · 2026-08-29 · 交友：偏好设置 + 滑卡/瀑布流切换（Harper 拍板）

- **决策**：① 交友页右上角「偏好」——底部弹层随时改口味（男生/女生/都可以/非人类，与 onboarding 第一问同一套，`store.setLovePref`）；口味从「排序加权」升级为**直接过滤牌池**（「都可以」看全部）。② 标题下方视图切换：**滑卡 / 列表**（双列瀑布流，D-031 形态回归为可选视图；`store.datingView` 持久化）；瀑布流里**点卡 = 心动**（TA 一定会同意，与右滑同效，弹配对成功层）。
- **推翻**：修订 D-040 之「搜索与 chips 随滑卡移除」的瀑布流部分（瀑布流作为第二视图回归；搜索与 chips 仍不做）；修订 D-041 口味加权（改过滤，加权项在同口味池内自然失效）。
- **影响文件**：`store/app-store.ts`（setLovePref/datingView）、`app/apps/dating.tsx`。

## D-050 · 2026-08-29 · 创造：「我创建的」编辑入口 + 表单文案修补（Harper 拍板）

- **决策**：创造页顶部新增**「我创建的（n）」**列表——点「编辑」把该角色全部字段（含头像/立绘、生日、隐藏设定等）回填进表单，底部按钮变「保存修改」，原位更新（热度保留；她没改过备注时通讯录名字跟着新设定走——`store.updateCustomCharacter`）；编辑态有横幅与「取消」。**自编辑即时生效于自己的羁绊**（创作者对自己的实例天然是最新版；他人领养的快照制 §5 不变）。顺手修补：单行输入的超长 placeholder 缩短（口癖/自定义种族），说明文字挪进 stepHint。
- **影响文件**：`app/apps/create.tsx`、`store/app-store.ts`（updateCustomCharacter）。

## D-051 · 2026-08-29 · 外出拍照：合影 / 拍TA（Harper 拍板）

- **决策**：外出场景输入栏上方两个按钮——**📸 合影**与**📷 拍 TA**，点按生图（千帆文生图，`generateScenePhoto`；prompt = `buildOutingPhotoPrompt`）：拍TA = 她举手机随手拍的单人照（TA 刚注意到镜头的自然神态）；合影 = 自拍构图，TA 占主体、**她只入镜一点点（小半侧脸/发丝/比耶的手，绝不画清晰正脸——她的长相留给想象）**。场景/天气/最近对话都进 prompt。照片以 image 消息落在外出会话里；**结束外出时并入羁绊会话**（相册按 bond.messages 汇集，照片成为资产）；陌生人场次的照片随会话结束消失（无羁绊可归档，试装接受）。这是**她主动按快门**，不推翻 D-037 的「会话内自动生图下线」。
- **影响文件**：`content/prompts.ts`（buildOutingPhotoPrompt）、`lib/imagegen.ts`（generateScenePhoto）、`app/outing/[placeId].tsx`、`store/app-store.ts`（endOuting 照片并入）。

## D-052 · 2026-08-29 · 自创角色：直入通讯录但带「心动中」tag，满 100 才缔结占槽（Harper 拍板，回应 #22）

- **决策**：修订 D-047，堵上自创直通对槽位墙的架空（OPEN_QUESTIONS #22 的方案 D 变体）：
  1. **发布 = 入册但不加好友**：创造发布后建立的是**暧昧期**（squareChats，同交友试聊一套心动机制），TA 出现在通讯录、带「**心动中**」tag，副行显示「心动 n/100 · 满了 TA 会想和你确定关系」；点开即聊（创作闭环不断）。**你创造的 TA 不过期**（TA 忘记创造者太残忍；免费层天花板由初识分寸承担，商业墙口径微调）。自创的「心动中」不进交友配对条（TA 们住在通讯录）。
  2. **心动满 100 → 缔结 → 占槽**：TA 开口想确定关系（CTA「TA 想和你确定关系 · 答应 TA」），进入领养流——**槽位判定恢复对所有羁绊生效**（撤销 D-047 的不占槽豁免；设置页口径同步回退）。
  3. **体验不突兀的三处缝合**：暧昧期 prompt 用初识模式但情境改写（「你对她有说不清的熟悉感——好像很久以前就该认识她」，不提"被创造"的元设定；有共同记忆则叠加重逢语气）；仪式文案自创专版（「TA 不再只是你创造的角色」「这一次，是 TA 自己选择留下」，缔结系统消息同款）；暧昧期聊天记录随缔结整段并入羁绊（复用迁移机制），升格无缝。
- **理由**：Harper 拍板。「你给了 TA 生命，但 TA 的心要你自己赢」——保住加槽付费墙，保住捏完即聊的创作体验，并让自创角色多出一个天然的付费转化节点（和照着心意捏出来的 TA 确定关系）。
- **推翻**：D-047 之「自动加好友、不占槽」（入通讯录保留，形态改暧昧期）；SQUARE_CHAT_TTL 对自创豁免（修订 D-006 时代的过期口径）。
- **已知残留**：D-047 版本里已自动成为羁绊的自创角色不回迁（祖父条款）；「心动中」的 TA 暂不参与外出偶遇。
- **影响文件**：`store/app-store.ts`（createBond 去 created、仪式文案按 custom 分支、ensureSquareChat 自创不过期）、`app/apps/create.tsx`（发布→ensureSquareChat）、`app/apps/contacts.tsx`（心动中行 + tag）、`app/chat/[characterId].tsx`（标签/banner/CTA 自创文案）、`app/adopt/[characterId].tsx`（槽位恢复、确定关系文案、仪式专版）、`app/apps/dating.tsx`（配对条排除自创）、`app/apps/settings.tsx`、`content/prompts.ts`（自创暧昧期情境）。

## D-053 · 2026-08-29 · 朋友圈改「X」（推特模式）；回帖实装模型（Harper 拍板）

- **决策**：
  1. **朋友圈 → X**：桌面图标改黑底白 ✕（拟真彩蛋，与 LINE 绿同一「世界内真 App」逻辑，D-027 精神）；界面改推特式时间线——行布局（头像 + 名字 + @handle + 相对时间）、正文、回复/喜欢操作行、细线分隔、推特光标蓝发送键；@handle 由角色 id 生成；回复线以缩进小头像呈现，她的回复显示「我的身份」昵称。转发键不做（供给纪律：点不动的按钮比没有更出戏）。内容口径不变：只看缔结契约的 TA（D-027），加好友前的公开帖只能看。
  2. **回帖实装模型**：她评论 → TA 用当前引擎真的回一条（`buildPostReplySystem/UserPrompt`，prompts.ts §1-E：人设 + 追法 + 她的身份 + 共同记忆 + 羁绊记忆注入，回帖写法 = 短、口语、半公开分寸），生成期间显示「TA 正在回复…」；**可多次回复**（原「只回一次」的脚本限制取消）。暗面路由前置（红线 #3：评论区也不例外）；mock/无 key/失败回落台词库 commentReply。输出走 splitBubbles + stripStageDirections 保持打字感（D-039 口径延伸到评论区）。
- **推翻**：D-020 之朋友圈命名与卡片样式；D-008 时代的脚本回帖（commentReply 降为回落）。
- **影响文件**：`app/apps/moments.tsx`（重写）、`content/prompts.ts`（§1-E）、`store/app-store.ts`（addHisReply 改传文本、去只回一次限制）、`constants/apps.ts`（图标/标签）。

## D-054 · 2026-08-29 · 账号与云备份：Supabase（Apple + 邮箱 OTP，快照同步 v0）（Harper 拍板选 A）

- **决策**（方案见当日提案，Harper 拍板供应商 = Supabase）：
  1. **注册不是门，是保险箱**：无登录墙、onboarding 不变，游客 = 纯本地完整体验；登录的价值主张 = 云备份/跨设备（「换手机也不会失去 TA」）。入口在设置顶部「账号 · 云端」。
  2. **登录方式**：Apple 登录（expo-apple-authentication → signInWithIdToken）+ 邮箱验证码（OTP 无密码，省掉忘记密码流）。手机号/微信不做（试装）；匿名账号暂不做（游客即本地，登录时再绑定）。
  3. **同步 v0 = 全量快照**：zustand persist 的整份 AsyncStorage 快照 ↔ `snapshots` 表（jsonb，RLS 仅本人），last-write-wins；登录态下 store 变化防抖 60s 自动上传；登录时云端有备份 → 弹「恢复到本机 / 用本机覆盖云端」；恢复 = 覆写 + rehydrate。含聊天与记忆，按最高敏感级（红线 #3），TLS 传输。
  4. **删除**：设置内「删除云端数据」（删 snapshots + 退出）；账号本体删除需服务端函数，正式版补（App Store 合规项）。
  5. **供应商抽象**：界面只认 `lib/auth.ts`/`lib/sync.ts` 导出——正式版若因大陆可达性迁自建/LeanCloud，只改这两个文件。
  6. **下一步（未在本次）**：Edge Functions LLM 代理（/ai/chat /image /tts，key 收回服务端 + 按 uid 限流）——回应 OPEN_QUESTIONS #9 的路径已定。
- **配置**：`.env.local` 填 `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`；Dashboard 跑 `docs/supabase-setup.sql` 建表开 RLS；Auth Providers 开 Email OTP 与 Apple。
- **影响文件**：`lib/auth.ts`（新）、`lib/sync.ts`（新）、`app/apps/settings.tsx`（账号区）、`app/_layout.tsx`（自动备份）、`docs/supabase-setup.sql`（新）、`.env.example`、`package.json`（+@supabase/supabase-js、expo-apple-authentication、react-native-url-polyfill）。

## D-055 · 2026-08-29 · 发帖调度器：TA 的 X 时间线活起来，频率遵循 MBTI（Harper 拍板）

- **决策**：
  1. **调度**（`lib/posts.ts`，与心跳同机制：启动/回前台补投）：只有缔结的 TA 发帖（D-027 口径）；每角色一只钟（`store.postSchedule`），到点生成一条并重排下一次；错过再久也只补 1 条（时间线不炸屏）；缔结后第一条不立发（铺设帖已在，隔一个周期才开始）。
  2. **频率 = MBTI 映射**（每天条数，试装数值）：ENFP/ESFP 3 · ENTP/ESTP 2.5 · ENFJ/ESFJ 2 · ENTJ 1.5 · INFP 1.5 · ESTJ/ISFP 1.2 · INFJ 1 · INTP/ISFJ 0.8 · INTJ 0.6 · ISTP/ISTJ 0.5；无 MBTI 默认 1。直觉：E 表达欲 > I，NF 爱抒发、SP 爱直播生活，ISTJ/ISTP 两天一条。间隔 ±35% 抖动防准点。
  3. **内容实装模型**（prompts §1-F）：人设 + 追法 + 羁绊记忆 + 时段 + 天气 → 一条 ≤60 字口语帖；「不 @ 她不点名，但有你们生活的影子」；深夜帖更轻更软；打字感纪律（无 emoji/话题/（））。mock/无 key/失败 = 本周期静默跳过。互动数为确定性伪随机小体量。
- **推翻**：补足 D-020/D-027 时代「静态种子帖一次性铺设、此后时间线死亡」的状态（种子铺设保留为开场存量）。
- **影响文件**：`lib/posts.ts`（新）、`content/prompts.ts`（§1-F + weatherLine 引入）、`store/app-store.ts`（postSchedule/setPostDue/addCharacterPost）、`app/_layout.tsx`。

## D-056 · 2026-08-29 · 广场偶遇也积累心动；生成照片改拍立得（Harper 拍板）

- **决策**：
  1. **广场陌生人偶遇积累心动**（修订 D-040 的「纯逛」）：外出陌生人场景与交友试聊共用同一套心动值（记在 squareChats 上，两处进度互通——广场聊过再去交友里滑到 TA，心动是接着涨的）；她每开口一句按角色节奏上涨，头部实时显示「心动 n/100」。**满 100 = TA 当场开口想交换联系方式**（产品触发器不由模型决定，D-029 纪律；prompt 明示模型不要自己张罗这件事），场景内出现 CTA「交换」→ 领养流（面对面交换联系方式，叙事天然成立）→ 缔结后这场偶遇就地升格为熟人偶遇（kind 派生，prompt/界面同步切换）。陌生人模式仍无 XP（心动与羁绊值分层不变）。
  2. **拍立得**（生成照片的统一呈现，`components/polaroid.tsx`）：外出拍的合影/拍TA 不再走对话气泡（「像她自己发的话」出戏）——**白框相纸居中呈现**，下方一行手写字（「和X的合影 · 地点」），每张带确定性小倾角；点开进暗场大图，**可分享**（expo-sharing 系统分享面板）。相册整体改**拍立得墙**（网格同框 + 同一查看器）。旧图片消息（无 polaroid 标记）仍走气泡，用户相册发的图不受影响。
- **影响文件**：`components/polaroid.tsx`（新）、`components/chat-thread.tsx`（居中渲染 + 查看器）、`app/apps/album.tsx`（拍立得墙）、`app/outing/[placeId].tsx`（心动累积/当场 offer/CTA/拍立得标记）、`lib/types.ts`（ChatMessage.polaroid）、`content/prompts.ts`（陌生人分寸改写）、`package.json`（+expo-sharing）。

## D-054 补记 · 2026-08-30 · Supabase 远程配置完成（Claude 经管理 API 执行）

- 已完成：snapshots 表 + 4 条 RLS 策略（仅本人读写）；Apple 登录启用（授权 client = host.exp.Exponent，Expo Go 原生 id_token 流）；邮箱 provider 默认开启。
- 已知限制：**免费层 + 默认邮件服务不能自定义邮件模板** → 邮箱 OTP 的邮件里只有魔法链接、没有 6 位验证码，且限流 2 封/小时。试装以 **Apple 登录为主**；要开邮箱验证码需在 Supabase 配自定义 SMTP（如 Resend 免费层）后把 Magic Link 模板加上 {{ .Token }}。设置页提示已同步。
- SUPABASE_ACCESS_TOKEN 建议用完在 Dashboard → Access Tokens 里 Revoke。

## D-057 · 2026-08-30 · 第一块自有服务端：AI 代理 Edge Function + 云端为主的同步（Harper 拍板）

- **决策**：
  1. **AI 服务端代理**（`supabase/functions/ai/index.ts`，已部署，verify_jwt 开）：唯一自有服务端组件。四个 service——qianfan.chat / qianfan.images / qianfan.tts / anthropic.messages，上游 key 收进 Supabase Secrets（QIANFAN_API_KEY / ANTHROPIC_API_KEY），客户端只带登录态 JWT 调用；按用户**每日限量**（ai_usage 表 + RLS，默认 500 次/天，AI_DAILY_LIMIT 可调——配额是防盗刷不是付费墙）。TTS 二进制流由函数包成 audio_base64。回应 OPEN_QUESTIONS #9 的试装解。
  2. **客户端三层取路**（`lib/proxy.ts`）：本地有 key → 直连（开发自测优先）；无 key 且已登录 → 代理；都没有 → mock/占位。engine（对话+completeText）、imagegen（文生图）、tts（语音）全部接入；imageKeyReady/ttsReady 的口径从「有 key」扩为「有 key 或已登录」。**分发出去的包不再带任何上游 key**。
  3. **同步升级为云端为主、本地缓存**（`lib/sync.ts`）：store 变化标脏 + 15s 防抖上传；App 退后台立即冲刷；启动/登录/回前台**对账**（reconcileNow）——云端更新且本地干净 → 静默拉云端；本地有未同步改动 → 本地覆盖云端（正在用的设备赢）；离线照常跑本地缓存，回线补同步。登录后的「恢复还是覆盖」弹窗取消（对账自动决定）。
- **配套**：tsconfig 排除 supabase/（Deno 代码不进 RN 类型检查）；ai_usage 建表与函数部署经管理 API 远程完成并验证（未登录 401、匿名拒绝）。
- **推翻**：修订 D-054 之「本地优先 + 手动/慢防抖备份」（升级为云端为主）；D-004/D-010 的「key 打包进客户端」自此有了下机通道（开发机直连仍可用）。
- **影响文件**：`supabase/functions/ai/index.ts`（新）、`lib/proxy.ts`（新）、`lib/auth.ts`（URL/ANON 导出 + 会话缓存）、`lib/engine.ts`（代理回落）、`lib/imagegen.ts`、`lib/tts.ts`、`lib/sync.ts`（重写自动同步）、`app/_layout.tsx`、`app/apps/settings.tsx`、`tsconfig.json`。

## D-058 · 2026-08-30 · 新用户流：落交友滑卡，桌面是奖励（Harper 拍板）

- **决策**（回应 OPEN_QUESTIONS #16 的「新用户落点」半边）：
  1. **流程**：你想被谁爱 → 先让 TA 们认识你（D-035 现状）→ **直接落交友滑卡**（不见桌面）→ 滑/配对/试聊 → 心动满加好友 → 缔结仪式 →（方案 B）**落桌面揭幕**：「这部手机，现在是你们的了」+ 三张模块卡逐个划过（Message：TA 的第一句话在横幅里 / 创造 / 外出），可跳过；TA 的打招呼计未读——桌面横幅本身就是「点进去」的教学。之后每次启动照常落桌面。
  2. **逃生门**：滑卡页顶部「先不滑了，随便逛逛 →」+ 返回键同效（AppScreen.onBack 覆盖）——放行桌面、不再拦。强制感是留存杀手，也防 App Store 审核被卡。
  3. **提示形态**：揭幕三卡（一次性）+ 既有的「空态即教程」语法；不做「TA 顺口介绍机制」彩蛋（Harper 明示不做——TA 不当客服）。
  4. **机制**：`store.introDone`（首次加好友或逃生门置真，门禁在桌面 Redirect）/ `introRevealSeen`（揭幕播一次）；persist v3 迁移——老存档两标记直接置真，不重走新手流；缔结后 `createBond` 打招呼计未读、领养流终点从羁绊会话改为桌面。
- **推翻**：D-020 时代「新用户默认落桌面」的落点；D-046 后「缔结直接进会话」的终点（改落桌面揭幕）。§4 首十分钟随之改写。
- **影响文件**：`store/app-store.ts`（introDone/introRevealSeen/v3 迁移/unread）、`app/index.tsx`（门禁 + IntroReveal）、`app/apps/dating.tsx`（逃生门）、`components/app-screen.tsx`（onBack）、`app/adopt/[characterId].tsx`（终点/按钮文案）。

## D-059 · 2026-08-30 · 试装分发：EAS Update（Expo Go 免打包发朋友）（Harper 拍板）

- **决策**：试装分发走 **EAS Update**（Expo 账号 harperz，项目 @harperz/everylove，channel/branch = preview，runtimeVersion 对齐 SDK 54 让 Expo Go 直开）。**发布纪律：AI key 必须剔除**（发布命令置空 EXPO_PUBLIC_ANTHROPIC/QIANFAN key 环境变量）——分发包只含 Supabase 公开配置，AI 走 D-057 服务端代理（朋友需 Apple 登录，享每人每日 500 次限流，消耗记 Harper 的千帆账单）。发新版 = 同一条命令重发；TestFlight 留作正式测试通道（需 Apple 开发者账号，D-058 讨论中已铺垫）。
- **朋友安装**：App Store 装 Expo Go → 打开分发链接 `exp://u.expo.dev/3d090463-3b93-4904-8611-b42a4d3bd664?runtime-version=exposdk%3A54.0.0&channel-name=preview`（或扫 Dashboard 更新页的 Preview 二维码）。
- **影响文件**：`app.json`（projectId/updates URL/runtimeVersion）。

## D-060 · 2026-08-31 · 共享角色池：公开的自创角色别人也能滑到（Harper 拍板）

- **决策**：创作者经济的第一块服务端基石。Supabase 表 `shared_characters`（id/owner_id/data jsonb；RLS：所有人可读含 anon、只有本人可写删）。创造表单新增第 ④ 步**「谁能遇到 TA」：私密（默认）/ 公开**——公开发布即上传共享池（需登录，未登录回落私密并提示）；编辑改私密即撤下。所有玩家的交友牌堆合入共享池（`lib/pool.ts`，5 分钟节流刷新、离线用缓存、排除自己的），同一套推荐打分（D-041 预留接口零改动）；卡面标「来自其他玩家」。**领养快照制落地**（§5）：与共享角色缔结时快照进本地，创作者更新不改写已领养实例；共享角色的配对照常 3 天过期（D-052 的不过期豁免只属于自己的创作）。审核暂缺——Harper 后续接平台；发布仍过本地真人/IP 拦截（红线最低线）。
- **影响文件**：`lib/pool.ts`（新）、`lib/types.ts`（visibility/shared）、`store/app-store.ts`（sharedPool/findCharacter/快照/TTL 豁免收窄）、`app/apps/create.tsx`（可见性步 + 发布/撤下）、`app/apps/dating.tsx`（合流/标签/配对条）、`app/apps/contacts.tsx`、`app/apps/settings.tsx`。

## D-061 · 2026-08-31 · 天气可点开：定位/搜索地区（Harper 拍板）

- **决策**：桌面天气卡可点 → `app/weather.tsx`：今日大天气 + 未来 7 天（确定性生成）；**位置**两条路——「使用当前位置」（expo-location 前台权限 + 反地理编码取城市名；被拒则引导搜索）或**手动搜索地区**（输入即设定）。城市只作天气种子与展示（`lib/weather.ts` 种子扩为「日期+城市」），**只存本机、不上传**（数据最小化）；界面注明试装天气由世界生成、正式版接真实气象（接口不变）。
- **影响文件**：`app/weather.tsx`（新）、`lib/weather.ts`（citySeed/initWeather）、`app/index.tsx`（卡片可点+显示城市）、`app/_layout.tsx`、`package.json`（+expo-location）。

## D-062 · 2026-08-31 · 登录独立界面；首次入册后强制登录（Harper 拍板）

- **决策**：登录从设置内联块升格为独立界面 `app/auth.tsx`（Apple 主打 + 邮箱验证码；设置的账号区收敛为入口 Row）。**强制点 = 第一次把人添加进通讯录之后**（两条路都算：缔结加好友 / 创造发布入册）——此时跳转 `auth?force=1`，无「先不了」，文案「TA 已经在你的通讯录里了。登录之后，换手机也不会失去 TA 和你们的故事」；之后不再重复强制（会话失效只软引导）。未配置 Supabase 的环境自动跳过。
- **推翻**：修订 D-054「无登录墙」（游客仍可滑卡/试聊到底，墙立在第一次拥有关系之后——注册的价值主张在情绪最高点兑现）。
- **影响文件**：`app/auth.tsx`（新）、`app/apps/settings.tsx`（收敛）、`app/adopt/[characterId].tsx`、`app/apps/create.tsx`。

## D-063 · 2026-08-31 · 模拟订阅 Pro/Max：槽位 1/5/∞（Harper 拍板）

- **决策**：设置「订阅计划（试装模拟，不扣费）」——**Pro：5 个羁绊槽；Max：不限量**；点击即订/退（确认弹窗），`store.plan` 持久化；槽位判定统一走 `lib/bond.ts` 的 `slotLimit/slotLimitLabel`（free 1 / pro 5 / max ∞）。槽满的领养页改为升级引导（「去看订阅」→ 设置）。真实收费（IAP/价格）待正式版（OPEN_QUESTIONS #3）。
- **影响文件**：`lib/bond.ts`（PLAN_SLOTS）、`store/app-store.ts`（plan）、`app/apps/settings.tsx`、`app/adopt/[characterId].tsx`。

## D-064 · 2026-08-31 · 杂项：滑卡文案去「TA 一定会同意」；Dock 默认收窄（Harper 拍板）

- **决策**：① 交友底部与瀑布流提示删去「——TA 一定会同意」（机制不变，话不说破）；② Dock 默认从 4 个收窄为 **通讯录 + 设置**（上限仍 4，可拖入拖出不变）；persist v4 迁移：仍是旧默认的存档自动跟随新默认。
- **影响文件**：`app/apps/dating.tsx`、`constants/apps.ts`（DEFAULT_DOCK）、`store/app-store.ts`（v4 迁移）。

## D-065 · 2026-08-31 · 真实天气：Open-Meteo 接入（Harper 拍板）

- **决策**：天气从「世界生成的假天气」升级为**真实天气**（Harper：「天气要真实的」）。数据源 **Open-Meteo**（免费、无 key、无注册）：当前温度/天气码 + 未来 7 天（forecast API），地区搜索走其 geocoding API。`lib/weather.ts` 重写：状态（城市/经纬度/实时/7 日）持久化 AsyncStorage（`everylove-weather-v2`），前台每 30 分钟节流刷新（`app/_layout.tsx`）；**同步接口不变**（todayWeather/tempNow/weatherFor/weatherLine），已设位置且拿到数据 → 真实天气，否则**回落原种子假天气**（离线/未设位置不空窗）。天气界面（D-061）改为：搜索出候选地点列表点选、「使用当前位置」（expo-location + 反地理编码）、真实 7 日预报。隐私口径不变：位置只存本机、不上传（Open-Meteo 请求只带经纬度，无任何标识）。WMO 天气码映射到原有 8 种天气条件，prompt 的 weatherLine 继续喂中文给引擎。
- **推翻**：修订 D-036/D-061 的「试装假天气、正式版再接 API」——真实天气提前落地；假天气降级为回落层。OPEN_QUESTIONS #17 的天气半问就此了结（外出付费口径半问仍开放）。
- **影响文件**：`lib/weather.ts`（重写）、`app/weather.tsx`（重写：搜索候选/定位/7 日）、`app/_layout.tsx`（initWeather + 前台刷新）。

## D-066 · 2026-08-31 · 三语 UI（中/英/日）+ onboarding 语言步（Harper 拍板）

- **决策**：全 UI 做三份（Harper：「onboarding 第一步要能选择语言，英语日语中文，同时你所有 UI 也都要做三份」）。方案：
  - **`lib/i18n.ts`**：轻量词典式 i18n，**中文原文即键**——界面写 `t('中文', vars?)`，en/ja 词典查不到时回落中文（漏词不崩，只是没翻译）；不引第三方库（i18next 等对试装是杀鸡用牛刀）。
  - **语言选择**：onboarding 新增**第 0 步**（中文 / English / 日本語，三语标题），存 `store.language`（persist）；设置内可随时改（Language · 语言 · 言語 区块）。切换即全局生效（`app/_layout.tsx` 以 `themeId-language` 作 remount key）。
  - **覆盖面**：全部 app 界面（桌面/交友/聊天/羁绊/通讯录/缔结/外出/X/相册/日历/天气/电话/创造/身份/设置/登录/onboarding/拍立得/聊天组件/AppScreen 返回），含 Alert 弹窗与 `lib/format.ts` 的相对时间（刚刚/{n} 分钟前…）；日期格式化按语言选 locale（zh-CN/en-US/ja-JP）。
  - **模型输出语言**：`content/prompts.ts` 硬规则加语言行（`CHAT_HARD_RULES_OF()` 按当前语言注入「用中文/英文/日文回复」），三种聊天模式 + 帖子回复 + 角色发帖全部生效。
  - **边界（见 OPEN_QUESTIONS #23）**：**角色台词库（content/characters.ts 的 mock 脚本）与种子人设暂不三语**——真模型输出跟随语言行，mock 引擎仍中文；恋爱类型 14 种/MBTI 提示等纯内容 chips 暂中文。内容本地化是另一场战役（日语写手到岗，#4）。
- **工程纪律**：新界面文案一律写 `t('中文')` 并同步补 en/ja 词典（`lib/i18n.ts` 尾部哨兵注释 `__EN_END__`/`__JA_END__` 前追加）；词典键 = 中文原文，改中文文案 = 改键，需同步改词典。
- **影响文件**：`lib/i18n.ts`（新）、`store/app-store.ts`（language）、`app/_layout.tsx`（setLang + remount）、`app/onboarding.tsx`（语言步）、`content/prompts.ts`（语言行）、`lib/format.ts`，及全部 `app/**` 界面与 `components/`（t() 包裹）。

## D-067 · 2026-09-02 · 生图调 prompt 脚本 `scripts/gen-image.mjs`（Harper 提出）

- **决策**：加一个零依赖 Node 脚本，输入文字 → 千帆文生图 → 图落 `scripts/out/`（已 gitignore），供在工程外快速迭代生图 prompt。**与 `lib/imagegen.ts` 同一条 API**（`POST /v2/images/generations`，同 model / size / n，同样 http→https 落盘），key 读 `.env.local` 的 `EXPO_PUBLIC_QIANFAN_API_KEY`（环境变量 `QIANFAN_API_KEY` 可覆盖），不走服务端代理。`--style` / `--portrait` 从 `content/prompts.ts` **实时读** COMIC_STYLE / COMIC_QUALITY / COMIC_RULES / PORTRAIT_COMPOSITION 追加到 prompt 尾部——改 prompts.ts 即刻反映，不另存一份副本（D-017「prompt 只在一个文件」纪律不破）。每张图旁存同名 `.txt` 记录当次 prompt 与参数。npm 入口 `npm run gen-image -- "..."`。
- **理由**：Expo Go 里调 prompt 一轮要走捏＋表单，太慢；脚本一行出图，且保证和线上同接口同参数，看到的就是用户会看到的。
- **影响文件**：`scripts/gen-image.mjs`（新）、`package.json`（gen-image）、`.gitignore`（scripts/out/）。

## D-068 · 2026-09-02 · 生图调 prompt 本地网页 + 双击启动（Harper 提出）

- **决策**：D-067 的命令行之外，加**本地网页版**——根目录 `gen-image.bat` 双击即起（或 `npm run gen-image:web`），`scripts/gen-image-server.mjs` 零依赖 Node http 服务，**只绑 127.0.0.1:3939**（key 在本机，不对外），自动开浏览器；页面 `scripts/gen-image-ui.html`（无 CDN、离线可用）：左栏写字 + 尾巴三选（不追加 / 画风尾巴 / 立绘尾巴，实时读 prompts.ts）+ size / 张数 / model + 「实际发出的完整 prompt」预览，Ctrl+Enter 生成；右栏是 `scripts/out/` 的历史墙（最新在前，含当时 prompt、耗时），每张可「回填到左边」（自动剥掉尾巴只留她写的那段）/ 复制 prompt / 点开原图。表单内容存 localStorage。CLI 与网页共用 `scripts/gen-image-core.mjs`（env 读取、prompts.ts 常量求值、调用与落盘、历史解析）；`.txt` 旁档格式（参数 JSON + 空行 + prompt）是历史墙的数据源，CLI 与网页出的图互相可见。
- **理由**：Harper 不想开 IDE 改脚本参数；网页能并排看历史图与 prompt 差异，才是「调 prompt」的工作台。
- **影响文件**：`gen-image.bat`（新，根目录）、`scripts/gen-image-server.mjs`（新）、`scripts/gen-image-ui.html`（新）、`scripts/gen-image-core.mjs`（新，从 gen-image.mjs 抽出）、`scripts/gen-image.mjs`（改用核心）、`package.json`（gen-image:web）。

## D-069 · 2026-09-02 · 删脚本引擎（mock）与 key 手填：AI 只走工程配置，失败直接露出（Harper 拍板）

- **背景**：Harper 扫码开 Metro 后发现聊天全是脚本占位。排查：`.env.local` 的千帆 key 直连正常（curl 200）；根因是 `engine` 作为用户数据被持久化并随云端快照同步——preview 分发包（D-059 刻意无 key）默认 `engine: 'mock'`，写进同一账号的云端快照（Supabase `snapshots` 表实测 `state.engine = "mock"`），dev 端启动时 `reconcileNow` 「云端较新、本地干净」静默拉回，之后 `generateReply` 见 `mock` 直接走脚本、连代理都不试。顺带发现：D-057「无 key 且已登录 → 代理」在分发包上从未生效（无 key 时默认引擎就是 mock，测试的朋友一直在聊脚本）；开发者面板手填的 key 也在同步快照里、会上云。Harper：「把所有的 mock 都删了吧现在不需要了还妨碍判断，然后把设置里的 key 输入也删了，我们都走工程配置」。
- **决策**：
  1. **脚本引擎整体下线**：`lib/engine.ts` 删 `mockReply` 与一切「失败回落脚本」链路（聊天/羁绊/外出的回落、X 回帖的 `commentReply` 回落）；`EngineId = 'anthropic' | 'qianfan'`。**角色台词库（`scriptFor`）保留**——开场白 / offer / 仪式台词 / prompt 里的风格示例仍在用，它们是产品触发器与人设内容，不是 mock。
  2. **引擎与 key 只读工程配置**：`.env.local` 的 `EXPO_PUBLIC_ANTHROPIC_API_KEY` / `EXPO_PUBLIC_QIANFAN_API_KEY`；新增可选 `EXPO_PUBLIC_AI_ENGINE=anthropic|qianfan`（不填：有 Claude key 用 Claude，否则千帆）。取路 `aiRoute()`：本地 key 直连 > 已登录走服务端代理（D-057）> 不可用（抛 `AiUnavailableError`「未配置 AI：.env.local 没有 key，也未登录」）。store 删 `engine / anthropicKey / qianfanKey` 与三个 setter，persist 升 **v5**，迁移时清掉旧存档与云端快照里的这三个字段——设备级配置与 key 不再是用户数据、不上云。
  3. **失败要看得见**：`generateReply` / `completeText` 失败原样抛错。聊天/羁绊/外出会话插一条系统消息「模型调用失败，TA 这条没回上：{原因}」（她的消息与心动/XP 照常记录；该回合不触发心动满的 offer，下一回合成功时再触发）；X 回帖失败弹窗露原因、不回帖；创造描述解析失败仍回落规则解析，但弹窗改为「模型解析失败，已用规则解析 + 原因」；发帖调度器与记忆提取失败照旧静默记 warn（后台任务，不打扰）。
  4. **设置 → 开发者**：删引擎切换与两个 key 输入框，改为只读两行「AI 引擎」「AI 取路（直连 .env.local / 服务端代理（已登录）/ 不可用）」+ 一句说明。
- **理由**：试装阶段假回复只会掩盖故障（这次就是藏了两天才被发现）；key 与引擎是设备/构建级配置，不该进用户存档更不该上云；「他一定会回」应由真模型与代理保证，而不是由脚本兜底。
- **推翻**：D-010「开发者面板手填可覆盖」「无 key 或调用失败回落 mock」；D-053「失败回落台词库」；D-057 取路第三层「都没有 → mock/占位」改为「都没有 → 抛错露出」。
- **影响文件**：`lib/engine.ts`、`lib/types.ts`、`store/app-store.ts`（persist v5）、`lib/memory.ts`、`lib/posts.ts`、`lib/imagegen.ts`、`lib/tts.ts`、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`app/outing/[placeId].tsx`、`app/apps/moments.tsx`、`app/apps/create.tsx`、`app/apps/settings.tsx`、`content/prompts.ts`（注释）、`lib/i18n.ts`、`.env.example`。
- **遗留**：云端快照里现存的 `engine: "mock"` 会在下次水合经 v5 迁移清掉；preview 分发包需重发一次 EAS Update 才带上本次改动（分发包无本地 key → 登录即走代理，D-057 本意至此才真正生效）。

## D-070 · 2026-09-02 · 生图调 prompt 工具：system / user 两段结构 + 千帆生图全参数（Harper 提出）

- **决策**：调 prompt 网页与 CLI 的输入改为 **system / user 两段**（Harper：「结构上我会有 system 和 user 两个部分」）。千帆 `/v2/images/generations` **没有 system 字段**（只有一条 `prompt`，qwen-image ≤800 字符），所以两段在发出前由 `composePrompt` 拼成一条，顺序可选：**system 在前**（默认）/ **user 在前**（= 工程 `buildPortraitPrompt` 的主体在前、画风在后）。system 框可一键载入工程当前常量（立绘 = PORTRAIT_COMPOSITION+画风三条；画风 = COMIC_STYLE/QUALITY/RULES，实时读 prompts.ts）后再改；每段与拼接后的总长都有 800 计数。同时把文档里对调 prompt 有用的接口参数露出来（不填即平台默认 = 与工程一致）：`negative_prompt`（≤500）、`seed`（固定种子才是公平比较，页面有「随机一个并固定」）、`steps`（1–50）、`guidance`（0–20，默认 4）、`prompt_extend`（**平台默认 true，会先改写 prompt 再画**；关掉才是所写即所画）；qwen-image 的 `n` 只支持 1（页面注明）。历史旁档 `.txt` 的参数 JSON 记录 system / user / order / 各参数，历史卡分色显示 user（玫瑰）与 system（蓝灰），回填时两段各回各框；老格式（整条 prompt）回填时从末尾剥工程预设作 system。**英文 prompt 已验证可出图**（qwen-image 中英皆可）。
- **影响文件**：`scripts/gen-image-core.mjs`（composePrompt/preset/buildBody/LIMITS）、`scripts/gen-image-server.mjs`、`scripts/gen-image-ui.html`、`scripts/gen-image.mjs`（--system/--system-file/--user-first/--negative/--seed/--steps/--guidance/--no-extend）。
- **备注**：D-069 为并行进行中的引擎改造（脚本引擎下线），本条编号顺延。

## D-071 · 2026-09-02 · 调 prompt 工具支持多模型（蒸汽机 Air-Image 专用端点）+ 千帆文生图模型盘点（Harper 提问触发）

- **决策**：`scripts/gen-image-core.mjs` 加模型注册表 `MODELS`（qwen-image / musesteamer-air-image：标签、单价、prompt 上限、接受的参数、备注）——`buildBody` 只带该模型接受的参数，`endpointFor` 让蒸汽机走其专用端点 `/v2/musesteamer/images/generations`（通用端点对它接受请求但不回，实测挂 5 分钟无响应）。网页 model 框改 datalist 可选两者，切换即更新 prompt 上限、置灰不支持的字段（negative/steps/guidance/n）并显示单价与耗时提示；请求体预览与服务端同口径。
- **盘点结论（2026-09-02 实测，本账号）**：能用的只有 qwen-image（0.25 元、~60 s）与 musesteamer-air-image（0.05 元、~8 s）；`ernie-image-turbo` 返回 invalid_model（文档有、账号未开通或 ID 不同）、`flux.1-schnell` 返回 model_offline、`qwen-image-2.0/3.0/2512` 千帆未上（阿里百炼独占）。**工程立绘暂不换模型**——换不换是美术方向与成本的产品决定，立为 OPEN_QUESTIONS #24。
- **影响文件**：`scripts/gen-image-core.mjs`（MODELS/endpointFor/promptLimit/buildBody）、`scripts/gen-image-server.mjs`（config 带 models）、`scripts/gen-image-ui.html`（模型选择/置灰/提示）、`docs/OPEN_QUESTIONS.md`（#24）。

## D-072 · 2026-09-02 · gen-image.bat 改纯 ASCII + CRLF（修 Harper 报告的双击报错）

- **问题**：双击 `gen-image.bat` 报 `'ttp:' 不是内部或外部命令`、`'nul' 不是内部或外部命令`、并误判「没找到 node」。原因是 cmd 的已知缺陷：批处理里执行 `chcp 65001` 后 cmd 按**字节偏移**重读文件，前后行含中文（多字节）就会读歪——`http:` 被读成 `ttp:`、`>nul` 被读成命令 `nul`，后续 `where node` 的判断也随之错乱。
- **决策**：`.bat` 一律**纯 ASCII、CRLF、不用 chcp、不写中文**（注释与提示全英文）。Node 往真实控制台打中文走 WriteConsoleW，不依赖代码页，所以服务端日志的中文不受影响。node 缺失判断改为 `where node >nul 2>&1` + `if errorlevel 1`。
- **影响文件**：`gen-image.bat`（重写）。

## D-073 · 2026-09-02 · Message 的语音与照片实装：她的语音 TA 听得到、照片 TA 看得见（Harper 提出）

- **背景**：D-030 上架了语音/图片发送，但引擎无法消费——她发语音或照片 TA 毫无反应。Harper：「语音的话你可以转文字发给我的聊天模型，图片的话你看一下怎么处理，全部你都可以在千帆上面找到最好最合适的模型用。」排查中顺带发现 D-048 的 TTS（千帆 `/v2/audio/speech` + qwen-tts）已全部 404——TA 的语音气泡其实一直静默失败。
- **选型（同一把千帆 bce-v3 key 实测）**：
  - **语音识别**：千帆 `/v2/chat` 下所有 Qwen 音频/omni 模型对本账号不存在，`ernie-5.0-thinking-preview` 拒收音频内容；千帆文档的语音识别走 **百度语音 `vop.baidu.com`**——极速版 `pro_api`（dev_pid 80001，普通话，约 1.5s）与标准版 `server_api`（1537 普通话 / 1737 英语，约 3.7s），同一把 key 直接可用，转写准确。日语不支持（→ OPEN_QUESTIONS #25）。
  - **看图**：`qwen3.5-397b-a17b` / `qwen3.5-122b-a10b` / `qwen3.5-35b-a3b` / `qwen3-vl-235b` 均能正确识别测试图、3~4s；`ernie-5.0` 12s（思考模型）；`ernie-4.5-turbo-vl-32k` 把红图说成白色（不可靠）。默认 **qwen3.5-397b-a17b**（最强，价格 0.0012/千 token 可接受），`EXPO_PUBLIC_QIANFAN_VISION_MODEL` 可换。
  - **语音合成**：千帆文档的语音合成是 **百度 `tsn.baidu.com/text2audio`**（表单，同一把 key，约 2.5s 出 mp3）；大模型音色可用（度泽言 4193 / 度嫣然 4194 / 度小贤 4115 …）。
- **决策**：
  1. **架构：文字化后交给主引擎，不换聊天模型**。语音 → ASR 文字，照片 → 视觉模型客观描述（prompts.ts §6：只写画面，画面里的人只说人数与在做什么、不描述长相——红线 #2），两者存到消息上（`ChatMessage.transcript` / `caption`），由 `messageContextText` 包成「（语音）…」「（她发来一张照片：…）」进对话上下文与记忆提取；TA 的回复仍由当前聊天引擎（deepseek/Claude）生成——人设不漂、Claude 引擎也能用、记忆库自然记住她发过什么。硬规则补一句「照片里出现的其他真实人物不评价」；输出格式补一句「像真的听到/看到那样回应，不复述描述文字」。
  2. **回合流程**（`app/chat/[characterId].tsx` / `app/bond/[bondId].tsx`）：语音/照片先上屏（`mediaStatus: 'pending'`，气泡下小字「识别中…」/「TA 在看…」），识别/看图完成后 `patchMessage` 回填、**按一次开口计心动 / XP**（修订 D-030「不计心动/羁绊值」——她开口了，只是换了种方式），再走与文字相同的 `respond()`；失败标 `failed`（「没听清」/「TA 没看清这张」）并插系统消息露出原因（D-069 纪律），TA 不回。她的语音气泡下小字回显识别文字。
  3. **录音改按 ASR 要求**：`ASR_RECORDING` = 16k 单声道 16bit wav（百度推荐 PCM/WAV），最长 59 秒到点自动停止并发送。
  4. **TTS 改百度 text2audio**（`lib/tts.ts` 重写）：音色按人称 他 4193 / 她 4194 / TA 4115，`EXPO_PUBLIC_BAIDU_TTS_PER` 可覆盖；缓存键换前缀避免与旧 qwen 缓存混淆。
  5. **代理函数**（`supabase/functions/ai`，已重新部署）：新增 `baidu.asr` / `baidu.asr_pro`（JSON 透传）与 `baidu.tts`（表单，二进制包 audio_base64），移除已死的 `qianfan.tts`。分发包（无本地 key）登录后三者都走代理。
  6. 新依赖 `expo-image-manipulator`（Expo Go 内置）：照片先缩到宽 1024、JPEG 0.75 再上传。
- **推翻**：D-030「用户发的图片/语音不计心动值/羁绊值、不触发 TA 回复」；D-048 的接口与音色（qwen-tts / Ethan·Cherry·Serena）。
- **影响文件**：`lib/media.ts`（新）、`lib/tts.ts`（重写）、`lib/types.ts`（transcript/caption/mediaStatus）、`store/app-store.ts`（patchMessage）、`content/prompts.ts`（§6 + messageContextText + 硬规则/输出格式各一句）、`lib/engine.ts`（buildTurns 去重按 messageContextText）、`components/chat-thread.tsx`（录音参数/自动停/回显）、`app/chat/[characterId].tsx`、`app/bond/[bondId].tsx`、`supabase/functions/ai/index.ts`、`lib/i18n.ts`、`.env.example`、`package.json`（expo-image-manipulator）。
- **遗留**：外出场景不发语音/照片（本就没有入口）；日语 ASR 供应商待定（#25）；识别文字暂不做二次纠错。

## D-074 · 2026-09-02 · TA 偶尔发语音 + 多语种语音通道（Whisper 协议，可插拔）（Harper 提出）

- **背景**：Harper：「让他偶尔也会给我发语音，然后现在这个模型只能识别中文？我需要日语英语也行，你看要不用 whisper。」D-073 的百度 ASR 只有中/英（及方言），百度 TTS 也只会中/英混读——目标市场是日本，这条路走不到头。
- **决策**：
  1. **TA 偶尔发语音**（`lib/tts.ts` 的 `shouldSendVoice`，`app/bond/[bondId].tsx`）：**只在羁绊会话**（语音是付费层「他在」的一部分，§2 商业承重墙；交友试聊不发）；每次回复只挑**最后一条气泡**、**2~80 字**的短句；概率随主动联系强度（高 30% / 中 18% / 低 10%），**她刚发过语音时 +40%**（礼尚往来，上限 85%）；发出即后台预热合成，点开即播；TTS 不可用或**当前通道不会说界面语言**（百度 + 日语）时不发。语音气泡沿用 D-048 形态（点按发声、可看文字），Message 列表预览「▶ 语音消息」。
  2. **多语种语音通道：OpenAI 兼容协议，可插拔**（`EXPO_PUBLIC_SPEECH_BASE_URL / _API_KEY / _ASR_MODEL / _TTS_MODEL / _TTS_VOICE_HE|SHE|TA`）：识别走 Whisper 协议 `POST {base}/audio/transcriptions`（multipart，`FileSystem.uploadAsync` 直传文件，带界面语言提示 zh/en/ja），合成走 `POST {base}/audio/speech`（mp3）。**配了就优先，没配回落百度**——OpenAI（whisper-1 / gpt-4o-mini-transcribe + gpt-4o-mini-tts）、Groq（whisper-large-v3-turbo）、硅基流动（SenseVoiceSmall 中/英/日/韩/粤 + CosyVoice2 多语种，国内直连）、阿里百炼都是这一套接口，换家只改 env，不改代码。**选哪家、谁付费仍是 OPEN_QUESTIONS #25**（Harper 不在中国大陆，不受网络限制；Claude 建议直接 OpenAI：gpt-4o-mini-transcribe + gpt-4o-mini-tts）。
  3. **代理**（`supabase/functions/ai`，已重新部署 v3）：新增 `speech.transcribe`（客户端传 base64，服务端拼 multipart 转发）与 `speech.synthesize`；服务端 Secrets 没配 `SPEECH_*` 时返回 503 `speech not configured`，客户端据此回落百度路由（`baidu.asr_pro` / `baidu.tts`）。分发包因此也能用上多语种通道，key 不进包。
  4. TTS 缓存键改为（通道 + 模型 + 音色 + 文本），换通道不串音。
- **未验证**：本机没有任何 OpenAI 兼容 key，Whisper 协议这两条通道按官方接口写、**未实测**；Harper 配上 key 后第一次发语音即验收（失败会在会话里露出原因）。
- **推翻**：D-073 的「日语暂按普通话识别」——现在日语走 Whisper 通道；D-048/D-073 的「TTS 只有百度」。
- **影响文件**：`lib/media.ts`（SPEECH_* 配置 + Whisper 直连/代理 + 通道顺序）、`lib/tts.ts`（重写：三通道 + `ttsSpeaksLang` + `shouldSendVoice`）、`app/bond/[bondId].tsx`（TA 偶尔发语音）、`supabase/functions/ai/index.ts`（speech.* + audioOrJson）、`.env.example`、`docs/OPEN_QUESTIONS.md`（#25 补记）。

## D-075 · 2026-09-02 · 调 prompt 工具：画风选项（prompt 第一行）+ 按画风自动选模型 + 新 system 文案（Harper 拍板）

- **背景**：Harper 实测「Qwen 比较多样化，蒸汽机基本只有一种画风」。
- **决策**：① 页面与 CLI 增加**画风**选项，注入为 **prompt 第一行**；选「**动漫**」自动走蒸汽机 Air-Image，其余走 qwen-image（model 框仍可手改）。② 拼接顺序固定为 **画风行 → user → system**（推翻 D-070 的「system 在前 / user 在前」可选，order 开关移除）。③ system 默认文案改为 Harper 给定：「根据以上要求生成角色立绘：人类（如果要求为非人类，则生成半人类）半身构图，正面脸，轻微侧身，直视镜头；背景简单，无前景遮挡，画面内没有任何文字 / 干净的线条，线条颜色和整体画面和谐，单幅画格、单人构图；细节干净，高清。」（`DEFAULT_SYSTEM`；「恢复默认」按钮回到它，工程立绘/画风常量仍可一键载入对比）。④ 画风初稿八条（Claude 拟）：动漫（蒸汽机）/ 少女漫·水彩（= 工程当前 COMIC_STYLE）/ 韩系清透 / 厚涂 / 国风水墨 / 写实插画 / 线稿 / 不加画风行；每条措辞页面上可直接改、按画风各自记在浏览器本地，「恢复这条画风的初稿」可还原。历史旁档 `.txt` 记 style / styleLine / user / system，历史卡多一块「画风」（琥珀色）。
- **边界**：只改调 prompt 工具，**工程 `content/prompts.ts` / `lib/imagegen.ts` 不动**——画风表与新 system 文案在 `scripts/gen-image-core.mjs`（STYLES / DEFAULT_SYSTEM），画风定稿、决定进产品时再搬进 prompts.ts（D-017 单一来源）并接进创造表单。注意新 system 文案**没有**原 COMIC_RULES 的「氛围暧昧克制、无露骨；不模仿任何真实人物长相」一句（红线 #1/#5 的 prompt 侧实现）——进产品前需补回或另行注入。
- **影响文件**：`scripts/gen-image-core.mjs`（STYLES / DEFAULT_SYSTEM / styleById / modelForStyle / composePrompt 改三段）、`scripts/gen-image-server.mjs`（config 带 styles/defaultSystem，generate 收 style/styleLine）、`scripts/gen-image-ui.html`（画风区块、order 开关移除、v3 本地存储）、`scripts/gen-image.mjs`（--art / --art-line / --list，--user-first 移除）。

## D-076 · 2026-09-02 · App 立绘接入画风选项：创造 ⑦ 八选一、动漫走蒸汽机、prompt 改「画风行 → 主体 → system」（Harper 拍板）

- **背景**：D-075 只改了调 prompt 工具，Harper「我现在生图明显还是之前的」——原意是 App 里的生图也要有画风选项。
- **决策**：
  1. **画风表进工程**：`content/prompts.ts` 新增 `PORTRAIT_STYLES`（纯字面量数组：id / label / model / line）与 `PORTRAIT_SYSTEM`（Harper 给定的 system 文案）；`Character.artStyle?: PortraitStyleId`（`lib/types.ts`），缺省 `shojo`（= 原 COMIC_STYLE，既有角色画风不变）。调 prompt 工具改为**实时读这两个常量**（`scripts/gen-image-core.mjs`，读不到回落内置副本）——工具与 App 单一来源（D-017）。
  2. **立绘 prompt 结构**：`buildPortraitPrompt` = 画风行 → 主体（外貌 + 身份气质）→ `PORTRAIT_SYSTEM`，段间空行；**最后一行保留 `COMIC_RULES`**（「氛围暧昧克制、无露骨；不模仿真人」是红线 #1/#5 的 prompt 侧实现，Harper 的 system 文案没含它，红线只能 Harper 明示才改，故保留；要去掉请 Harper 拍板）。原 `PORTRAIT_COMPOSITION` 保留常量供工具对比，立绘不再用。
  3. **模型按画风路由**：`imageModelFor(character)`——anime → `musesteamer-air-image`（`lib/imagegen.ts` 走其专用端点、不发 n；登录代理走新增服务 `qianfan.musesteamer`，`supabase/functions/ai` 加路由，**需重新部署 Edge Function**），其余 → qwen-image。
  4. **外出拍照同画风**：`buildOutingPhotoPrompt` 第一行改为角色画风行（不指定回落 COMIC_STYLE），`generateScenePhoto(prompt, character)` 模型同上——同一个 TA 立绘与照片不换画风。
  5. **创造表单 ⑦**：头像区块加「画风」八个 chip（t() 三语），提示按模型给耗时（动漫约 10 秒 / Qwen 约 1 分钟）；draft / 编辑回填 / 重置都带 artStyle；描述导入不解析画风。
- **影响文件**：`content/prompts.ts`、`lib/types.ts`、`lib/imagegen.ts`、`app/apps/create.tsx`、`app/outing/[placeId].tsx`、`supabase/functions/ai/index.ts`、`lib/i18n.ts`（en/ja）、`scripts/gen-image-core.mjs`。

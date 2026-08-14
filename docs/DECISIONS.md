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

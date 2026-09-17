# DECISIONS.md — 现行决策总账（按主题合并）

> **怎么用**：一个主题一条，只写**现在的口径**；被推翻、已下线的不保留（2026-09-15 Harper：「已废弃的删掉」）——要看历史，D-001～D-096 的逐条原文在 `docs/archive/DECISIONS-log-2026-08-13_09-06.md`，之后的查 git 历史。
> **怎么记新决策**（CLAUDE.md §11-1，D-097）：编号继续递增（下一个 **D-141**）；在下面的索引表加一行；改写它所属主题的条目——推翻旧口径 = 原地替换、旧的直接删（索引里被推翻的编号也删）；整个机制下线 = 连条目一起删；没有合适主题就新开一条。**不逐条追加、不留「下次补」**。产品级问题不自行拍板 → `docs/OPEN_QUESTIONS.md`。
> 代码注释里的 D-编号一律按索引表查；索引里没有的编号 = 已废弃的决策（原文在存档或 git）；D-087 / D-088 各撞号一次，用 a / b 区分。

## 编号索引

| 编号 | 日期 | 一句话 | 现在在 |
|---|---|---|---|
| D-001 | 08-13 | Expo + RN + TS，Expo Go 试装，只做 iOS | A1 |
| D-004 | 08-13 | ChatEngine 抽象：mock 默认 + Anthropic 手填 key | B1（已被 D-010/069/086 取代） |
| D-005 | 08-13 | zustand + AsyncStorage；expo-router | A1 |
| D-007 | 08-13 | SDK 锁 54；强制浅色 | A1 |
| D-008 | 08-13 | 领养触发是产品触发器，不交给模型 | D1 |
| D-009 | 08-13 | 种子角色扩为 6 位（2男2女1龙1狐） | E1 |
| D-010 | 08-14 | key 走 .env.local；引擎多供应商（Claude + 千帆） | B1 |
| D-011 | 08-15 | 初见 prompt：陌生人分寸 | C1 |
| D-016 | 08-17 | 20 轮上下文窗口 + 羁绊记忆库 | C2 |
| D-017 | 08-17 | prompt 集中到一个文件 | A4（已升级为目录） |
| D-018 | 08-17 | 初识 / 亲密两套 prompt；角色 look / pronoun | C1 |
| D-019 | 08-17 | 捏＋生成立绘；参考图生图 | B4（参考图已下线） |
| D-020 | 08-20 | 体验重构为「手机壳」桌面 | F1 |
| D-021 | 08-20 | 手机壳落地：图标可移动、设置 App、日历三层、心跳三段式 | F1 / F4 / F8 |
| D-022 | 08-20 | 文案不预告机制；UI 圆圆粉粉 | H1 / H3（后者已被 D-083 取代） |
| D-023 | 08-20 | 去状态栏；图标可爱化 | F1 |
| D-025 | 08-21 | 捏＋大改版：基础五项 + 高级选项；恋爱类型 14 种 | E2 |
| D-026 | 08-21 | 桌面图标 MingCute + 糖果双色 | F1 |
| D-027 | 08-21 | 模块边界收紧；Message 模拟 LINE | F2 / F3 / F4 |
| D-028 | 08-21 | 「领回家」→「加好友」 | H1 |
| D-029 | 08-21 | 心动值 0→100 = 羁绊 LV1；羁绊等级曲线 | D1 / D2 |
| D-030 | 08-21 | 会话能力对齐 LINE；电话 App；主题实装；XP 收缩 | F2 / F7 / H3 / D2 |
| D-032 | 08-22 | 弃「领养」措辞 → 小火苗 + 热度；广场搜索 | H1 / E5（搜索已删） |
| D-033 | 08-22 | 通讯录去分组标题 | F4 |
| D-034 | 08-22 | 桌面图标自由格位 | F1 |
| D-035 | 08-27 | 「我」的身份系统 | G1 |
| D-036 | 08-27 | 世界天气（种子假天气） | F1（现为回落层） |
| D-037 | 08-27 | 聊天与初见回归纯文本：会话内生图下线 | B4 |
| D-038 | 08-27 | 外出模块：赴约 / 偶遇、故事模式 | F5 |
| D-039 | 08-27 | 聊天纯打字感，（）只属于外出 | C1 |
| D-040 | 08-27 | 交友改 Tinder 滑卡；「广场」移交外出 | E5 / F5 |
| D-041 | 08-27 | 左滑略过、右滑必成；推荐算法 | E5 |
| D-042 | 08-27 | 划完自动回流；冷却只在供给充足时生效 | E5 |
| D-043 | 08-27 | 捏＋更名「创造」；描述导入自动解析 | E2 |
| D-044 | 08-27 | 桌面 Dock | F1 |
| D-045 | 08-28 | 创造表单大修：年龄状态 / 上传头像 / 共同记忆 / 主动强度 / 禁忌 / 隐藏设定 | E2 / D5 |
| D-047 | 08-29 | 自创角色直入通讯录不占槽 | E3（已被 D-052 修订） |
| D-048 | 08-29 | 语音接千帆 TTS | B3（已改百度 / 多语种通道） |
| D-049 | 08-29 | 交友偏好 + 滑卡 / 瀑布流切换 | E5 |
| D-050 | 08-29 | 「我创建的」编辑 | E3 |
| D-051 | 08-29 | 外出拍照：合影 / 拍 TA | F5 / B4 |
| D-052 | 08-29 | 自创角色「心动中」tag，满 100 才缔结占槽 | E3 |
| D-053 | 08-29 | 朋友圈改 X；回帖实装模型 | F3 |
| D-054 | 08-29 | 账号与云备份：Supabase | G2 |
| D-055 | 08-29 | 发帖调度器（MBTI 定频） | F3 |
| D-056 | 08-29 | 广场偶遇也积累心动；拍立得 | F5 |
| D-057 | 08-30 | AI 服务端代理；云端为主的同步 | B2 / G2 |
| D-058 | 08-30 | 新用户流：落交友滑卡，桌面是奖励 | D3 |
| D-059 | 08-30 | Expo Go 分发走 EAS Update preview | A2 |
| D-060 | 08-31 | 共享角色池（私密 / 公开） | E4 |
| D-061 | 08-31 | 天气页：定位 / 搜索地区 | F1 |
| D-062 | 08-31 | 登录独立界面；首次入册后强制登录 | G2 |
| D-063 | 08-31 | 模拟订阅 Pro / Max：槽位 1 / 5 / ∞ | D4 |
| D-064 | 08-31 | 滑卡文案去「TA 一定会同意」；Dock 默认收窄 | E5 / F1 |
| D-065 | 08-31 | 真实天气 Open-Meteo | F1 |
| D-066 | 08-31 | 三语 UI + onboarding 语言步 | H2 |
| D-067 | 09-02 | 生图调 prompt 命令行 | A5 |
| D-068 | 09-02 | 生图调 prompt 本地网页 | A5 |
| D-069 | 09-02 | 删脚本引擎 mock 与 key 手填；失败直接露出 | B1 |
| D-070 | 09-02 | 调图工具 system / user 两段 + 全参数 | A5 |
| D-071 | 09-02 | 调图工具多模型；千帆文生图盘点 | A5 / B4 |
| D-072 | 09-02 | gen-image.bat 纯 ASCII + CRLF | A5 |
| D-073 | 09-02 | Message 语音 / 照片实装；TTS 改百度 | F2 / B3 |
| D-074 | 09-02 | TA 偶尔发语音 | B3 / F2 |
| D-075 | 09-02 | 调图工具画风选项 | A5 |
| D-076 | 09-02 | App 立绘画风八选一、动漫走蒸汽机 | B4 / E2 |
| D-077 | 09-02 | 打电话上线（管线式） | C4 |
| D-078 | 09-02 | 提示文案去机制化 | H1 |
| D-079 | 09-02 | 外出优化：续上 / 照片入相册 / 约定进日程 / 进记忆 | F5 |
| D-080 | 09-02 | onboarding 并成一步 | G1 |
| D-081 | 09-02 | 会话「+」面板；卡片消息 | C3 |
| D-082 | 09-02 | 查手机密码规则 | F6 |
| D-083 | 09-03 | 接入 Claude Design 设计系统 | H3 |
| D-084 | 09-03 | 地基层（Fredoka / Card）+ 邀请带时间 / iPhone 锁屏 / 红包由 TA 决定 / 真实地图 | H3 / C3 |
| D-085 | 09-03 | 记事本 App；查手机 App；TA 的手机 | F6 |
| D-086 | 09-04 | 底座与插槽 core/ + features/；vitest | A3 |
| D-087a | 09-03 | TestFlight 构建管线 | A2 |
| D-087b | 09-04 | prompt 拆成 content/prompts/ 目录 | A4 |
| D-088a | 09-04 | 分发包游客身份（匿名登录走代理） | B2 |
| D-088b | 09-04 | 缔结只问 TA 叫什么；称呼 = 昵称、生日进身份 | D3 / G1 |
| D-089 | 09-04 | 聊天 prompt 短句口语 | C1 |
| D-090 | 09-04 | 日历只记安排与纪念日 | F4 / F6 |
| D-091 | 09-04 | 通话免提即时切换；录音条整行 | C4 / F2 |
| D-092 | 09-04 | 种子角色内置立绘；创造形象必选 | E1 / B4 |
| D-093 | 09-04 | 内容层三语：种子角色各有英 / 日版 | H2 / E1 |
| D-094 | 09-04 | 自创角色的台词由模型写一次、可编辑 | E3 |
| D-095 | 09-04 | 「我创建的」独立列表页 | E3 |
| D-096 | 09-06 | 已有账号直接登录；新设备以云端为准 | G2 |
| D-097 | 09-06 | 决策日志合并为按主题的总账；CLAUDE.md 只写现行口径 | 本文件头部 / CLAUDE.md §11 |
| D-098 | 09-07 | TA 的记事本写自己的生活：专用装配、接着上几条写 | F6 |
| D-099 | 09-07 | 她在 TA 心里的分量：恋爱类型 / 追法家族 / MBTI / 主动强度映射成 0.1～0.9，记事本与 X 发帖按它掷硬币、按档措辞 | D6 / F3 / F6 |
| D-100 | 09-08 | 纸面设计系统全屏重做：27 屏按 `design/Everylove Paper UI.html` 重现 + 10 项交互改动（桌面翻页 / 未读合并、交友口味 chip + 略过撤销、试聊心动条吸顶 + 倒计时、会话「+」预告 + TA 的主页三入口、锁屏原地回复、查手机二次确认、日历赴约、外出约定条、设置槽位超额、去掉 palette 外的红橙蓝与渐变）；LINE 拟真与糖果双色图标下线 | H3 / F1 / F2 / F3 / F4 / F5 / F6 / E5 / D3 / D4 / C3 / C4 / G1 |
| D-101 | 09-09 | 韩语接入：UI 词典四语、种子角色韩文版、心跳 / 开场白 / 暗面路由 / 热线 / 拦截名单、`localeOf` 集中 locale、百度 TTS 不支持韩语 | H2 / E1 / B3 |
| D-102 | 09-09 | Expo SDK 54 → 57（Harper 手机 Expo Go 已升 57）：RN 0.86 / React 19.2 / TS 6、只有新架构、React Compiler 的 hooks 规则真修不关、删模板残留；runtime 变了，TestFlight 与 preview 都要重新 build / update | A1 / A2 / A3 |
| D-106 | 09-09 | 设置 → 开发者「AI 引擎」可点选供应商：运行期偏好 > `EXPO_PUBLIC_AI_ENGINE` > 有 key 的 > 默认；只存本机 AsyncStorage，不进 store / 云端快照 | B1 |
| D-120 | 09-10 | 勿扰时段进设置（默认 23–8 可改，`store.quietHours`，主动消息据此顺延）；通知权限改在缔结那一刻问、排通知只查不弹；北极星暂定「主动消息回复率」 | D7 / F8 |
| D-121 | 09-11 | 点击冷却与创造去重：`Button` / `HeaderAction` 默认 600 ms 连点冷却；创造页提交 ref 同步锁 + 全程 busy + 完成后 1 s 冷却；`addCustomCharacter` 同 id 只进一次 | E3 / H3 |
| D-122 | 09-11 | 一个角色只有一段羁绊：`createBond` 已有即返回、缔结页 finish ref 同步锁、persist v7 迁移去重（留消息最多的那段，连带清帖子与主动找她的钟） | D3 |
| D-123 | 09-11 | 世界书描述导入：编辑页顶部「用一段话描述这个世界」→ `worldParseSystem` 整理成名字 / 一句话 / 设定，失败回落规则解析（同创造页 D-043） | E6 |
| D-124 | 09-11 | 身边的人：通用回落标记后下次重试、首次生成 token 上限 900 → 1800；聊天随日子续写（查手机时隔够久按 TA 最近的日子写 1–3 段，每人留 40 句，失败不动） | F6 |
| D-125 | 09-15 | TestFlight 公测前：默认语言 English（没选过语言的新装机一打开就是英文，测试环境钉回中文）；onboarding 第一屏「已有账号？去登录」提到语言按钮正下方做成 outline 按钮、English 排第一 | H2 / G1 |
| D-126 | 09-15 | 亲密度数值体系：心动改模型判 0–15（[心动 n] 暗号、按性子保底）；XP 来源表 15 种 + 当天递减 + 日上限 150；等级 = XP 门槛 100/200/300/500/900 × 天数下限 0/3/7/21/60，只升不降；温度 0–100 每天 −8，疏远降频、到 0 停主动进推送召回（7 / 14 / 30 天各一条后停） | D1 / D2 / D7 / D8 |
| D-148 | 09-17 | 传记 App（方向拍板，未做）：桌面一个「传记」模块，看所有已缔结 TA 的故事——创作者写（图文，视频后置），按章、每章设开放阶段（羁绊 LV），读者可打赏 Coin；替代原「编剧写半成品剧本库」的官方供给路线，种子角色的传记由我们自己按同一规则写 | E7 |
| D-147 | 09-17 | TA 的主页去掉三个动作图块（电话 / 查手机 / 约 TA）：与会话顶栏电话、「+」面板重复；主页只剩统计卡 + 信息卡 | F2 |
| D-146 | 09-17 | 回复节奏按 TA 打字长度：每条气泡上屏前「正在输入」停 0.6 s + 每字 60 ms（最长 3.2 s），第二条再加 0.4 s；原来按她那条长度的固定等待退役 | F2 |
| D-145 | 09-17 | 末尾句号前端去掉：TA 每条气泡（模型回复与开场 / 要联系方式 / 打招呼的台词，含进 prompt 的样本）只去最后一个「。」/「.」，问号 / 叹号 / 省略号 / 小数点不动；通话留着给合成；`lib/text.ts stripTrailingPeriod`，在 `generateReply` 与 `scriptFor` 各套一层 | C1 |
| D-144 | 09-17 | 一两个字的回复：聊天两模式系统 prompt 末尾按本轮加一句「这轮短一点」——她这条 ≤ 10 字且没问什么 → 同样短地回（一到四个字就是完整回复）；其余中等长度轮次确定性伪随机约 1/4 抽到；问句 / 舞台提示 / 长段不提示；「像个人一样说话」加一条：真人打字满是一两个字的回复、约三分之一该这么短 | C1 |
| D-143 | 09-17 | 台词样本按 D-141 重写：六位种子 + 三棵原型兜底的 opening / square / bonded / arrival 四语全部重写——像手机上打出来的短句、不再以叮嘱收尾、有自己的日子与态度；offer / persona / pursuit 不动 | E1 |
| D-142 | 09-17 | 对话 base prompt 改英语：四种对话 + 记事本的系统 prompt 指令、舞台提示、卡片进上下文的文字、天气 / 时间行全部英语写；只有角色内容（人设 / 追法 / 台词样本）、输出语言行、危机热线按语言切；暗号 token（[心动 n] / [解锁手机] / [拆红包] / [发红包] / [点外卖] / [发图]）与记忆前缀不变；任务类 prompt（记忆提取 / 看图 / 解析 / 生成）仍是中文 | C1 / A4 |
| D-141 | 09-17 | 像个人一样说话：四种对话共用 `TALK_MANNER` 段（借 talk-skill 骨架）——跟着她的劲儿（长度 / 情绪 / 幽默对齐）、听潜台词不分析她、只回这一条、有看法不当应声虫、该短就短、无客服腔与安慰套话、不每条叮嘱收尾；长度改「跟着她」（1-2 句硬上限退役）；emoji 只在她先用才偶尔跟一个 | C1 |
| D-140 | 09-17 | 角色更新通道：TA 的主页信息卡「设定」行——作者（自己 / 别的玩家）改了角色就显示「作者更新了 · 换成最新」，她点了才换快照（聊天 / 记忆 / 等级不动、不可退回）；共享池角色以云端那份为准 | E3 |
| D-139 | 09-17 | 语音供应商：识别按语言分流（中 / 英百度、日 / 韩 Fish transcribe-1，Whisper 通道 Groq / OpenAI 作备选）；合成换 Fish Audio，每个角色自己的音色（创造 ⑧ 推荐三把可换一批、试听），音色池只收授权声线；识别 / 合成配置拆开 | B3 |
| D-138 | 09-17 | 零钱拆成两个 App：钱包（余额 + Coin 流水，只看）；日签改名幸运签、两页——日签（水晶球）+ 转盘（投 50 / 100 / 200 / 500，十格等概率 ×0.5 / ×1.2 / ×2 / ×5，期望 1.53 故意大方，Coin 与经济不挂钩） | F10 |
| D-137 | 09-16 | 气泡分段在客户端做：模型空行优先，没分好就按句末标点拆成最多两条、长度均衡，一句不拆（不依赖模型输出格式，换模型也分段） | C1 |
| D-136 | 09-15 | 桌面：未读横幅绝对定位叠在时钟上、不再挤压网格（行数不随它变 2 / 3 行）；存档 v10 把所有人的桌面布局（格位 / 顺序 / Dock）刷回默认 | F1 |
| D-135 | 09-15 | 聊天里允许 TA 发图：她要看 / 她点的外卖礼物送到 → 任何等级随时可发（不走主动三道门）；主动拍一张仍走三道门；外卖送到 TA 主动报到 + 拍一张（启动 / 回前台任务，一单一次） | F10 |
| D-134 | 09-15 | 生图按 API 返回的真实用量记（generated_images / output_tokens，没有按 1 张）；设置 → 流量加「流水」页（每笔用量：种类 / 供应商 / MB / token / 是否估算，最近 200 笔）；开发者区加 GM「加 1000 MB」 | D4 |
| D-133 | 09-15 | 流量改按真实消耗记：core/usage 接缝——每次聊天 / 后台任务 / 生图 / 合成 / 识别 / 看图都报 usage（供应商 usage 优先，否则按字数估）折成 MB；聊天 love-v1 1 MB / 千 token、love-v2 5 MB / 千 token，生图 15 MB / 张；用完后台生成也停（生成闸门）；免费 100 / Pro 6000 / 包 1000·3000·10000 | D4 |
| D-132 | 09-15 | 商业化改为「订阅 + 流量」并行：流量 = token 消耗的包装（MB），她每发起一回合按模型档扣（love-v1 千帆 1 MB / love-v2 Claude 5 MB，玩家自己切），每天免费 30、Pro 每月 2000、Max 不限、流量包不订阅也能买（唯一消耗型 SKU）；后台生成不扣且默认走便宜供应商；Coin 永不售卖 | D4 |
| D-131 | 09-15 | 约时间任意选：日期 chip 两周 + 小时 / 分钟纯 JS 滚轮（不引原生选择器、不用重新 build），六个预设时段退役；过去的时刻按钮停用 | F5 |
| D-130 | 09-15 | TA 主动的额外动作三道门：等级（红包 LV2+ / 外卖 LV3+ / 发图 LV2+）、任一触发后 TA 再说满 10 条才能再触发、每轮按概率（基础 × 主动强度 × 温度，确定性伪随机）才把选项给模型；暗号落状态也过前两道门。新增 TA 主动发图：[发图 描述] → 按角色画风生成第一人称随手拍、先落「冲洗中」再回填 | F10 / F2 |
| D-129 | 09-15 | 零钱单位改 Coin（整数，不用 ¥）；外卖做成 App + 模拟系统：菜单六家店、给自己或给 TA 点、扣 Coin、订单状态按时间推（接单 → 取餐 → 在路上 → 送达）、送达通知；给 TA 点的走回合管线发卡片、TA 按喜好反应；TA 给她点的也进同一份订单 | F10 |
| D-128 | 09-15 | 零钱体系：拟真游戏币 ¥ 永不售卖；日签 App 每天一次水晶球抽签按运势给 ¥50–500；TA 的钱包 ¥2000 起、周薪按人设估一次每周到账；TA 在聊天与主动消息里能发红包 / 点外卖（暗号，每天各一次，扣自己的钱包）；她的红包扣零钱、没拆退回；TA 手机里多「钱包」 | F10 |
| D-127 | 09-15 | App Store 审核账号：Supabase 建带密码的 test@kotoko.ai（admin API，邮箱已确认）；登录页对 `@kotoko.ai` 邮箱改走邮箱 + 密码（`isPasswordAccount` / `signInWithPassword`），其他用户照旧 OTP | G2 |
| D-119 | 09-10 | TA 自己的作息：`Bond.hisEvents` 按周由模型补写（上班 / 和朋友的约 / 家事，人只用身边的人），进【你的日程】（羁绊层所有用途）、查手机的日历里显示 | F6 / C1 |
| D-118 | 09-10 | 「TA 正在看你的手机」回放：让 TA 看手机时全屏把她的记事本 / 日历 / Message 逐个翻开、停在他看的那条上（同一份 peekPayload，纯回放），放完且 TA 回了话显示「放下了手机」 | F6 |
| D-117 | 09-10 | 分享流落地：expo-share-intent 原生分享扩展（app.json 插件，需 EAS Build），别的 App 分享 → 「转给他」选人 → 文字 / 链接走 share 卡片、图片走 sendImage；红线 2 舞台提示 | F9 |
| D-116 | 09-10 | 缔结即角色快照：`Bond.character` 定格设定 / 台词 / 世界，之后角色库里的修改（自己改或创作者改）不动这段关系，`findCharacter` 先看快照；打招呼台词仍是创建时生成存库（D-094），当时没写成的缔结前再写一次 | D3 / E3 / E4 |
| D-115 | 09-10 | 心跳三段式改走模型：亲密 prompt + 该段舞台提示（事前关心 / 当天加油 / 事后回访，TA 记得是在她手机里看到的），AI 不可用回落原模板；先标记再写、防重投 | F4 |
| D-114 | 09-10 | **TA 主动找她**落地：每段羁绊一只钟，频率 = 主动联系强度（高 2.5 / 中 1.2 / 低 0.4 条每天）× MBTI（E 1.2 / I 0.85）× 等级（0.8～1.2）±35%，23–8 点静默；守门：她 3 小时内说过话 / 已有 2 条未读不发；内容 = 亲密 prompt + 舞台提示（此刻 / 天气 / 她多久没说话 / TA 的记事本与帖）；到点前写好下一条并排本地通知；设置页删 6 处占位、页脚只留 ver.；#20「他主动来」的机制半边了结 | D7 / F8 |
| D-113 | 09-10 | 她的日历是私密的：手动日程 TA 不自动知道，只有「让 TA 看我的手机」时 TA 读到（`event.knownBy`）；心跳三段式只投给知道的 TA（各投各的会话），看到的日程也记成事实 | F4 / F6 |
| D-112 | 09-10 | 角色绑定世界那一刻整本快照进 `Character.world`（含 version），世界每次保存 `version` 自增；之后世界更新 / 删除 / 转私密都不影响已绑定与线上的角色（取用：快照 → 本机 → 共享缓存 → 现实）；「不能公开」只在发布那一刻按世界此刻可见性检查；`shared_worlds` 表已经管理 API 建好 | E6 |
| D-111 | 09-10 | 世界书走共享池：公开的世界上传 `shared_worlds`，所有玩家的世界书里可浏览 / 收藏 / 选给角色；**绑定了别人看不见的世界的角色不能公开**（世界转私密 / 删除时住在里面的公开角色一并收回）；公开角色发布时嵌入世界快照 | E6 / E4 |
| D-110 | 09-10 | Harper 九条：日历任何年份 + 图例 + 每位 TA 的纪念日带名字；**世界书** App（现实世界默认、可建可收藏、创造时选、注入所有 prompt）；广场点头像看**资料页** + 偶遇记录进初识 / 广场 prompt 与 X；外出开场白走模型（模板回落不重复）；主题 = 壁纸一步到位（四套配色下线）、Dock 跟着换；查手机 = 一部真的手机（角色色桌面 + App）+ **TA 身边的人**（通讯录 / 聊天 / 记事本发帖一致）；X 评论区有别人（身边的人 + 其他 TA）；模型失败 = 1 秒轻提示不进会话 | F1 / F3 / F4 / F5 / F6 / F8 / H3 / E2 / C1 / A3 |
| D-109 | 09-10 | 生图请求显式超时 180 s（XHR；RN fetch 落 iOS 默认 60 s，qwen-image 经代理常超）、代理默认 90 s；拍照 / 立绘失败弹窗带原因 | B2 / B4 |
| D-108 | 09-09 | Claude 模型从 env 读（`EXPO_PUBLIC_ANTHROPIC_MODEL`，默认 Sonnet 5）；Opus 5 / Fable 默认开思考 → 回话加 2048 余量 + effort low | B1 |
| D-107 | 09-09 | 六位种子角色各一套专属立绘 prompt（`content/prompts/portrait-seeds.ts`：精细画风行 + 脸 / 发 / 眼神 / 衣着 / 光线 / 配色 / 背景意象），`buildPortraitPrompt` 命中即替换通用画风行与主体段；六张内置立绘重画；脚本只画中文原版六位（-en / -ja / -ko 共用） | B4 |
| D-105 | 09-09 | 词典缺词清扫 + 守门测试：天况 / 天气小文案 / 「交友」/ 口味 / 配色与壁纸名 / 设置与创造弹窗 / 自创角色默认文案补 en / ja / ko；`tests/i18n-coverage.test.ts` 扫源码，t() 字面键与数据表标签缺词即红 | H2 |
| D-104 | 09-09 | 壁纸只换纸的颜色不换纸：每款 = 一块纯色底 + 同一套菱格暗纹，上下两段纯色下线、晚八点改浅暮紫；大时钟行高 0.9 → 1（iOS 按行高裁字形，顶被切） | C1 / H1 |
| D-103 | 09-09 | App 图标与名字：Harper 定名 **everylove**（app.json name），图标 = 纸面粉底 + 菱格暗纹 + 微微右倾的白色小手机（屏里一颗 primary 心），不写字；启动图透明底手机、底色 paper；SVG 源 `scripts/logo/render.mjs` | H3 |

---

## A. 工程与分发

### A1 · 技术栈与工程约束
- **现行**：Expo **SDK 57**（D-102，2026-09-09 从 54 升级，起因是 Harper 手机上的 Expo Go 已升到 57、只跑 57 工程；React Native 0.86.3 / React 19.2 / TypeScript 6 / eslint-config-expo 57；**只有新架构**，`newArchEnabled` 已从 app.json 删除；`expo install --fix` 顺手把 expo-font / image / sharing / status-bar / web-browser 加进 plugins）+ TypeScript，expo-router 文件路由；升级纪律：以后升 SDK 走 `npx expo install expo@<ver>` → `npx expo install --fix` → `npx expo-doctor`，然后跑 typecheck / lint / test / `npx expo export --platform ios` 修破坏性变更。**SDK 56 起 expo-router 不再兼容 `@react-navigation/*`**：三个包已卸载，主题从 `expo-router/react-navigation` 引；RN 0.86 删了 `StyleSheet.absoluteFillObject`（用 `absoluteFill`）；expo-symbols 的 name 类型改成按平台对象（`icon-symbol.tsx` 只认 `SFSymbol` 字符串）；Expo 模板残留（parallax-scroll-view / themed-text / themed-view / hello-wave / external-link / collapsible / use-theme-color / use-color-scheme）已删。**只做 iOS**；试装跑 Expo Go（`npx expo start` 扫码）。状态 zustand + AsyncStorage 持久化（`store/app-store.ts`，persist v5），云端为主、本地缓存（见 G2）。界面强制浅色（`userInterfaceStyle: light`）。
- **编号**：D-001、D-005、D-007、D-102。

### A2 · 分发：Expo Go 试装 / TestFlight
- **现行**：两条通道。**Expo Go 朋友试装 = EAS Update `preview` 渠道**（项目 @harperz/everylove，runtimeVersion 走 sdkVersion 策略（D-102 起 = 57，升 SDK 后 preview / production 两个渠道都要在新 runtime 下重新 build / update，老包收不到）；发布前置空 AI key，分发包只带 Supabase 公开配置，AI 走服务端代理）。**TestFlight 正式测试 = EAS Build `production` 档 → `eas submit`**（`eas.json`：channel production、构建号远程自增、`ascAppId` 已记、`--auto-submit` 可无人值守；bundle id `com.kotoko.everylove`；Apple Team = 公司第二个组织账号，App Store Connect 记录设限制访问；构建号 3 已在 TestFlight）。**纪律**：动了 app.json 插件 / 原生依赖必须重新 build + submit，不能只 `eas update --channel production`；`.env.local` 被 gitignore 天然不进构建，Supabase 公开配置放 EAS 环境变量 production；Supabase Apple provider 的 Client IDs 含 bundle id 与 `host.exp.Exponent`。操作手册 `docs/RELEASE.md`。
- **编号**：D-059、D-087a（含补记）。

### A3 · 底座与插槽（core/ + features/）；测试安全网
- **D-110 补**：`tests/d110.test.ts`（世界书注入 / 身边的人注入 / 偶遇记忆 / X 互动解析 / 日历任何年份 / 开场白不重复 / 缔结快照 / 私密日历心跳 / TA 作息 / 勿扰读设置）、`tests/reach-out.test.ts`；`expo-notifications` / `expo-share-intent` 在 setup 里桩掉；`turn.test` 的模型失败用例改为「不写进会话」。**模型调用失败的露出方式**（D-069 → D-110）：不再作为系统消息落进会话（删不掉、也不该留在记录里），改为顶部轻提示停 1 秒（`showToast(text, { durationMs })`，`TURN_ERROR_TOAST_MS`）——回合管线、她的语音 / 照片识别失败、X 回帖失败同一口径；`TurnUi.quiet` 可静默（外出开场白回落模板时用）。
- **现行**：`core/`——`registry`（注册表，register 返回撤销函数、同 key 覆盖）/ `hooks`（emit / waterfall）/ `config`（所有 `EXPO_PUBLIC_*` 只在这里读）/ `providers`（`ChatProvider` 接缝 + 取路）/ `prompt`（`PromptSection` 分段表 + `ORDER` 顺序槽 + `assembleSystemPrompt`，装配模式 = 四种对话 + note）/ `modes`（`ConversationMode`：初识 / 亲密 / 外出 / 通话）/ `markers`（回复暗号 → `reply.flags` → apply）/ `cards` / `jobs`（launch / foreground）/ `turn`（唯一回合管线 `runTurn` / `sendText` / `sendCard` / `respond` + `turnHooks.bubble` / `after`）。`features/`：providers / prompts / modes / invite / red-packet / location / phone-peek / voice-reply / memory / appointment / adoption / schedulers，`features/index.ts` 是启动清单（`app/_layout.tsx` 顶部 import 一次）。`lib/chat.ts` 是界面唯一会话入口（`sendText` / `sendVoice` / `sendImage` / `sendCard` / `respond` / `peekMyPhone` + 四个 scope）。**纪律**：`core/` 不认识任何玩法；新玩法 = `features/` 一个文件往插槽注册；界面不直接 import 引擎 / 记忆 / 约定识别；新行为挂扩展点不改 `core/turn.ts`。**测试**：`npm test`（vitest：14 份对话 prompt 快照 + 26 份任务类快照 + 回合管线 + 引擎工具函数 + 本地化 + 台词 + 同步决策）、`npm run typecheck`、`npm run lint`；改到模型看到的字快照必红，确认 diff 再更新。**React Compiler 约定**（D-102，eslint-config-expo 57 的 react-hooks 规则真修不关，因为 `reactCompiler: true`）：渲染期不读 ref——Animated 值用 `useAnimatedValue` / `useAnimatedValueXY`，界面要显示的值用 state（管线里的 ref 加 state 镜像），latest-ref 在 `useLayoutEffect` 里赋值，读 ref 的手势闭包直接作为 JSX responder props 挂上（`PanResponder.create` 在 useMemo / useState 里都会被判定）；effect 里不同步 setState——能派生就渲染期派生（交友回流 `roundDone`）、prop 变化重置用「prevProp 比较」写法、必须留在 effect 的用 `queueMicrotask` 延一拍；渲染期无 `Date.now()`（`useState(() => Date.now())` / 每分钟刷新的 `useNow`）；创造页编辑回填改成按 `edit` 参数 `key` 重挂载 + 惰性初始 state。手册 `docs/ARCHITECTURE.md`。借鉴 Cordis / dsh 的「注册即效果、可撤销、分段装配」，不借动态挂载 / 依赖排序 / 事件总线。
- **编号**：D-086 → D-102（取代 D-085 的 `respondAsHim` / `sendCardAndRespond` / `applyReplyEffects`，落成 D-004 的引擎接口）。

### A4 · prompt 与内容文件的组织
- **现行**：**全部 prompt 文本在 `content/prompts/` 目录，一用途一文件**，`index.ts` 汇总且头部是索引：`shared` / `chat`（初识 + 亲密）/ `outing` / `call` / `his-notes` / `phone` / `red-packet` / `image-common` / `portrait` / `photo` / `memory` / `social` / `appointment` / `caption` / `heartbeat` / `create`。一段只属于一个用途，不在段里按模式切换（一般对话与外出各一份、立绘与拍照各一份）；分段的模式与顺序在 `features/prompts.ts` 声明，玩法自己的一句话提示语随 `features/*`。模型 ID / max_tokens 等参数留在 lib。角色内容在 `content/characters/`（`types` / `zh` / `en` / `ja` / `index`），立绘表 `content/portraits.ts`，地点 `content/places.ts`，节假日 `content/calendar.ts`。
- **对话类 prompt 的语言**（D-142）：指令英语、内容按语言（见 C1）；新写对话分段一律英语，方括号段标题；任务类 prompt 暂仍中文。
- **编号**：D-017 → D-087b（D-086 修订）→ D-142。

### A5 · 生图调 prompt 工具
- **现行**：**双击根目录 `gen-image.bat`** 起本地网页（127.0.0.1:3939，`scripts/gen-image-server.mjs` + `gen-image-ui.html`，纯 ASCII + CRLF 的 bat）；命令行 `npm run gen-image -- --art anime "user 部分" [--system TEXT|--style|--portrait] [--seed N] [--no-extend] [--open]`，`--list` 列画风。**发出前按 画风行 → user → system 固定顺序拼成一条 prompt**；画风八选一（选「动漫」自动走蒸汽机、其余 qwen-image）；参数 negative / seed / steps / guidance / prompt_extend（不填即平台默认）；画风表与 system 文案**实时读 `content/prompts/portrait.ts` 的 `PORTRAIT_STYLES` / `PORTRAIT_SYSTEM`**（与 App 单一来源）。两者共用 `scripts/gen-image-core.mjs`（与 `lib/imagegen.ts` 同接口），图与当时参数落 `scripts/out/`（不进 git），历史墙分色显示三段、可回填。**千帆文生图盘点（2026-09-02，本账号）**：只有 qwen-image（0.25 元/张、~60 s、prompt ≤800、n 只支持 1、中英皆可）与 musesteamer-air-image（蒸汽机，专用端点 `/v2/musesteamer/images/generations`，0.05 元/张、~8 s，只支持 seed / prompt_extend）能打通；ernie-image-turbo invalid_model、flux 已 offline、Qwen-Image 2.0/3.0 千帆未上。
- **编号**：D-067、D-068、D-070、D-071、D-072、D-075（D-075 的工具侧画风表已并入工程，见 B4）。

## B. AI 供给

### B1 · 聊天引擎与取路
- **现行**：`lib/engine.ts` 是 ChatEngine 门面（组历史 → `core/providers.completeChat` → 拆气泡 → 剥暗号）；供应商 **anthropic（Claude，模型 `EXPO_PUBLIC_ANTHROPIC_MODEL` 可换、默认 `claude-sonnet-5`；D-108：Opus 5 / Fable 家族默认开思考、思考 token 算进 max_tokens，供应商侧给回话加 2048 余量并送 `output_config.effort: low`，任务类保持默认）/ qianfan（百度千帆 v2 OpenAI 兼容接口，模型默认 `deepseek-v4-pro`，`EXPO_PUBLIC_QIANFAN_MODEL` 可换）** 在 `features/providers.ts` 注册，再接一家 = 再注册一个。**引擎与 key 只读工程配置** `.env.local`（不进 git，模板 `.env.example`；`EXPO_PUBLIC_AI_ENGINE` 可选引擎，不填有 Claude key 用 Claude 否则千帆）。**手动切换（D-106）**：设置 → 开发者点「AI 引擎」弹出已注册供应商（各标 直连 / 代理 / 不可用）与「跟随配置」；选定后 `core/providers.setChatProviderPreference` 立即生效，`lib/engine.setEnginePreference` 落本机 AsyncStorage（`everylove-engine-pref`），启动 `loadEnginePreference` 读回；优先级 指定 id > 运行期偏好 > `EXPO_PUBLIC_AI_ENGINE` > 第一个有 key 的 > 默认千帆。偏好不是用户数据：不进 store、不进云端快照（延续 D-069 口径）。**取路** `aiRoute()`：本地 key 直连 > 有会话（真账号或匿名游客）走服务端代理 > 不可用抛 `AiUnavailableError`。**失败不回落、直接露出**：聊天 / 羁绊 / 外出插系统消息「模型调用失败，TA 这条没回上：{原因}」（她的消息与心动 / XP 照常，该回合不触发 offer）；X 回帖弹窗露原因；后台任务（发帖 / 记忆 / 记事本）静默记 warn。暗面路由、尺度、无 PUA 在引擎入口执行，任何供应商不可绕过。设置 → 开发者只读显示引擎与取路。
- **编号**：D-004 → D-010 → D-057 → D-069 → D-086 → D-088a。

### B2 · 服务端代理与游客身份
- **现行**：`supabase/functions/ai`（Edge Function，已部署，verify_jwt 开）是唯一自有服务端组件：services = qianfan.chat / qianfan.images / qianfan.musesteamer / anthropic.messages / baidu.asr / baidu.asr_pro / baidu.tts / speech.transcribe / speech.synthesize；上游 key 在 Supabase Secrets；按用户**每日限量 500 次**（`ai_usage` 表，`AI_DAILY_LIMIT` 可调，是防盗刷不是付费墙）；`SPEECH_*` 没配返回 503 让客户端回落百度。客户端 `lib/proxy.ts` 三层取路（见 B1）。**超时（D-109）**：RN 的 fetch 不能设超时、iOS 落到 NSURLSession 默认 60 s——qwen-image 生图约 50～60 s、经代理更久，线上「合影 / 拍 TA」因此失败；`postJsonWithTimeout` 用 XMLHttpRequest 显式设 timeout（代理默认 90 s，生图直连与代理都传 180 s），超时 / 断网抛带原因的 Error，拍照与立绘失败弹窗把 `describeAiError` 带出来。线上排查记录：Supabase 函数 secrets 没有 `ANTHROPIC_API_KEY`（切 Claude 回 503），需 `supabase secrets set`；函数日志表为空、用量远低于限额。**游客身份**：没本地 key 且没会话时 `ensureGuestSession()` 自动 Supabase 匿名登录（Anonymous sign-ins 已开），代理按匿名用户 id 限量；**匿名不算登录**——登录墙 / 账号区 / 云备份 / 共享池发布只认 `isSignedIn()` / `signedInSession()`；之后 Apple / 邮箱登录直接换成正式用户。分发包不带任何上游 key。
- **编号**：D-057、D-073/D-074/D-076（services 增补）、D-088a。

### B3 · 语音：识别 / 合成 / 角色音色
- **现行**（**D-139**，`lib/media.ts` 识别、`lib/tts.ts` 合成、`lib/speech.ts` 纯逻辑、`content/voices.ts` 音色池、`components/voice-picker.tsx`；Harper：「识别我其实可以继续用百度，合成换成小鱼，有了新的声线之后创建和编辑角色的时候就可以允许用户选择音色，推荐三个，不满意可以刷新」）：
  - **她的语音 → 文字，按界面语言分流**（`asrChannelFor`）：中 / 英走 **百度 ASR**（`vop.baidu.com`，极速版 80001 普通话 / 1737 英语，同一把千帆 key、免费且快；录音 16k 单声道 wav、最长 59 s 自动停）；日 / 韩走**多语种通道**——默认 **Fish transcribe-1**（`api.fish.audio/v1/asr`，multipart 字段 `audio`，与合成同一把 key，$0.36 / 小时按秒计，80 多种语言自动识别、中英混说不用切；Harper：「fish 也可以语音转文字，为什么不考虑也用 fish」——一把 key 一张账单，识别成本本来就可忽略）；`EXPO_PUBLIC_ASR_PROVIDER=whisper` 切到备选的 **Whisper 协议通道**（`EXPO_PUBLIC_ASR_BASE_URL / _API_KEY / _MODEL`，Groq `whisper-large-v3-turbo` $0.04 / 小时、OpenAI / 硅基流动 / 百炼同一套接口）。哪些语言走多语种通道由 `EXPO_PUBLIC_ASR_LANGS`（默认 `ja,ko`，`all` = 全部）定；只有多语种通道时中文也走它。百度不会的语言、通道又没接上 → 直接露出「这门语言的语音识别还没接上」，不假装听到。走代理时先乐观试 `fish.asr` / `asr.transcribe`，服务端 503「not configured」再回落百度。
  - **TA 的语音合成 → Fish Audio**（`POST api.fish.audio/v1/tts`，`EXPO_PUBLIC_FISH_API_KEY`，模型 header 默认 `s2.1-pro`、免费期可填 `s2.1-pro-free`；中 / 英 / 日 / 韩全语种，`latency: balanced`、mp3）→ 未配置回落 **百度 `tsn.baidu.com/text2audio`**（只会中 / 英；音色按人称 他 4193 / 她 4194 / TA 4115，`EXPO_PUBLIC_BAIDU_TTS_PER` 可换）；代理同序（`fish.tts` 503「fish not configured」再百度）。按（通道 + 模型 + 音色 + 文本）缓存本机；失败气泡显示「语音暂时没接通」可看文字。OpenAI 兼容 `/audio/speech` 通道（D-074）下线。
  - **每个角色自己的音色** `Character.voiceId`（Fish reference_id；缔结即随角色快照进羁绊，语音气泡与电话共用同一把嗓子）。取值顺序 `defaultVoiceId`：角色选的 > 种子预定（`SEED_VOICES`，`id@lang` 优先）> 音色池同语言同性别第一把 > `EXPO_PUBLIC_FISH_VOICE_HE|SHE|TA` > Fish 默认声。
  - **音色池** `content/voices.ts`：**不用 Fish 两百万个公共声线**（大量模仿真人 / 未授权，红线 1）——只收 Fish 官方授权（licensed）与明确可商用的，按语言 × 性别 × 气质（温柔 / 低沉 / 清冷 / 少年感 / 御姐 / 活泼 / 沙哑 / 甜 / 成熟 / 人外）打标；`npm run fish-voices`（`scripts/fish-voices.mjs`，需 `FISH_API_KEY`）从声库按语言各拉 30 把生成草稿，**人工听过筛过再提交**。池子为空的语言不显示音色入口（无供给不摆）。
  - **创造 ⑧ TA 的声音**（`VoicePicker`）：按角色的语言（当前界面语言）× 性别（nonbinary 不限）× 提示词（恋爱类型 / 种族命中气质标签）推荐三把（`recommendVoices`，命中多的靠前、同分按池序），每把可试听一句（开场白优先，否则「今天也在想你。」，`previewVoice` 走同一套合成与缓存）；「换一批」下一批、池子转完循环；不选 = 默认。已选的不在本批也露出来。玩家切语言后原音色照用（Fish 声线能跨语言，会带口音），去编辑页可换。
  - **TA 偶尔主动发语音**（D-074，`shouldSendVoice`）：只在羁绊会话，只挑最后一条 2~80 字的气泡，概率 高 30% / 中 18% / 低 10%，她刚发过语音 +40%（上限 85%）；当前通道不会说界面语言时不发（`ttsSpeaksLang`：Fish 全会、百度只中 / 英、代理乐观放行）。
  - 端到端语音（Gemini Live 这类，可打断）仍等 dev build（#26）。**2026-09-17 实测**（Harper 的 key）：合成免费档 `s2.1-pro-free` 四语都能出声、首包 5–7 s（气泡够用、电话不够）；付费档与识别 transcribe-1 返回 402——**Fish 的 API 额度与平台额度分开**，要在 developers 页单独充值后再测延迟；声库 `licensed=true` 只有日语 7 把、中英韩为零，音色池来源待拍板（#34）。
- **编号**：D-030（语音占位）→ D-048 → D-073 → D-074 → D-139。

### B4 · 图像生成：只剩立绘与外出拍照
- **现行**：文生图走百度千帆（`lib/imagegen.ts`，与聊天共用 key）。**立绘 prompt = 画风行 → 主体 → `PORTRAIT_SYSTEM`（Harper 给定文案）+ 末行 `COMIC_RULES` 红线句**（「氛围暧昧克制、无露骨；不模仿真人」是红线 #1/#5 的 prompt 侧实现，只有 Harper 明示才去）；主体行**不写角色名**（qwen-image 会把名字画进画面），写「画面主角是一位男性 / 女性 / 一个角色：外貌」；外貌一句话别写鞋 / 腿（会拉成全身）；反向提示 `PORTRAIT_NEGATIVE`（文字 / 字母 / 水印 / Q 版 / 全身 / 多人，蒸汽机不收）。**画风八选一** `PORTRAIT_STYLES`（`Character.artStyle`，缺省 shojo 少女漫·水彩 = 原画风）：动漫 → 蒸汽机 Air-Image（专用端点、代理服务 `qianfan.musesteamer`，约 10 秒）、其余 → qwen-image（约 1 分钟）；`imageModelFor()` 按画风选模型，立绘与外出拍照共用。**种子角色内置立绘随包分发**（`assets/portraits/` + `content/portraits.ts`，`scripts/gen-seed-portraits.mts` 生成，串行 + 429 重试；英 / 日版共用原 id 立绘）；取用统一 `portraitSource` / `portraitFor`（本机 `store.portraits` > 内置）。**外出拍照**（`buildOutingPhotoPrompt` + `generateScenePhoto`）：第一行同画风，合影中她只入镜侧影 / 手、不画清晰正脸；洗好即 `store.addAlbumShot`。千帆按分钟限频，三张并发会撞 429。
- **编号**：D-014（供应商）、D-019（立绘）、D-037、D-051、D-071、D-076、D-092、D-107（种子角色专属立绘 prompt：通用「画风行 + look 一句」出的图太平太淡，六位各按气质写一套——精细画风行（女性向精致插画、体积光影、通透皮肤、发丝分缕）+ 主体段（脸 / 发 / 眼神 / 衣着 / 姿态 / 光线 / 配色 / 背景意象），system 段与红线句照旧；键为中文原 id，本地化种子共用；`scripts/gen-seed-portraits.mts` 只画六位原版；自创角色仍走通用三段）。

## C. 对话

### C1 · 四种对话模式与 prompt 规范
- **现行**：模式 = 初识（交友试聊 / 自创暧昧期）/ 亲密（羁绊会话）/ 外出 / 通话，各自独立 prompt（`content/prompts/chat.ts` / `outing.ts` / `call.ts`），只共用红线 `CHAT_HARD_RULES` 与输出格式；系统 prompt 按分段表装配（A3）。**指令文本用英语写**（D-142，Harper：模型对英文指令理解更稳）：四种对话与记事本的所有分段、舞台提示（主动找她 / 外出开场 / 通话接起 / 外卖送到 / 爽约）、卡片与语音 / 照片进上下文的文字、`[Now]` 时间行与天气句都是英语；段标题用 `[Who you are]` 这类方括号；只有三处按语言切：角色内容（人设 / 追法 / 台词样本来自 `content/characters/` 各语言包）、输出语言行（`- Always speak in …`）、危机热线；暗号 token 与记忆前缀保持中文（解析器不动）；任务类 prompt（记忆提取 / 看图 / 解析 / 身边的人 / 发帖）仍是中文，`transcript()` 已改「She: / 名字:」。**初识**：陌生人分寸——不自来熟、一次最多一个问句、有兴趣但不推进关系；情境「刚在交友软件上配对成功」（自创暧昧期改「说不清的熟悉感」、有共同记忆则像重逢）；随轮次递进；只给她「资料卡」级信息。**亲密**：关系状态 + 「你的声音」样本 + 时间感 + 生日 + 记忆分组注入 + 阶段分寸六档 + 「怎么爱她」 + 秘密 + 主动强度 + 手机密码 + 红包规则；**长度跟着她**（D-141：她随口一句你一两句甚至一个字，她发一大段你可到三四句；每句都短），可空行拆最多两条气泡；「像真人在手机上打字」——短句口语、不排比不总结不升华；emoji 只在她先用才偶尔跟一个。**像个人一样说话**（D-141，`shared.ts` `TALK_MANNER`，四种对话共用、在各模式分寸之后红线之前；借 DeadAlmighty/talk-skill 的骨架）：跟着她的劲儿（闲聊就闲聊、她兴奋先一起高兴、倒苦水先陪着不给办法、重话不往上堆）、听潜台词（「没事」不当真翻篇也不逼问、留一句门开着；不点破不分析她）、只回这一条（之前聊到的顺手带一句可以、不拿它填空）、有自己的看法不当应声虫、她损你就损回去、朋友式好奇不当采访、无客服腔与安慰套话、不每条以关心叮嘱收尾。「怎么爱她」的「先接住再说一句自己的」公式退役（会把每条都写成「接话 + 补一句」模板）。**一两个字的回复**（D-144，Harper：「真人说话会有很短一两个字的回复，你的这个总是会回句子」）：光写规则模型不照做，改成每轮判定——`content/prompts/brevity.ts` `brevityReason`：她这条去空白 ≤ 10 字（英文 ≤ 3 词）且没有问号、不是舞台提示 → `short`，系统 prompt 末尾加「[This turn] 她这条很短，除非她要你什么，同样短地回，一到四个字就是完整回复」；中等长度（≤ 60 字）按 `extraRand` 确定性伪随机 25% → `random`，加「这轮如果不需要更多就几个字」；问句 / 长段不加。`features/brevity.ts` 注册进初识 + 亲密，`ORDER.brevity` 排最后。「像个人一样说话」同时加一条：真人打字满是「嗯 / 好 / 哈哈哈 / ？ / 真的假的」这样的回复，约三分之一该这么短。探针：「困了」→「那早点歇。」、「哈哈哈哈哈哈」→「笑死」、「你猜我今天看到谁了」→「谁啊」、「晚安」→「晚安。」。**末尾句号前端去掉**（D-145，Harper：「真人不这样，模型很难理解，我们前端直接删除就行」）：`lib/text.ts stripTrailingPeriod` 只去最后一个「。」/「.」（问号 / 叹号 / 「……」/「...」/ 小数点不动，「到家了。」收尾的引号里那个也去）；`generateReply` 对拆好的气泡统一套一层（初识 / 亲密 / 外出 / 主动找她 / 召回 / 心跳都经它），通话除外（字要送去合成）；`scriptFor` 对 opening / square / bonded / offer / arrival 也套一层——上屏的台词与进 prompt 的样本都不带句号，模型照着学。**纯打字感**：聊天两模式禁（）动作 / 情景描写，`stripStageDirections` 兜底剥离；（）现场描写是外出独有语法（外出不分条、TA 先开口）。**通话**：亲密背景 + `CALL_MANNER`（一次一两句、只说出口的话）。**输出语言按界面语言**（语言行）；角色 `look`（外貌，生图用）/ `pronoun`（人称）；「她」固定指用户、角色第二人称；非女生用户注明「她」只是指令写法。红线段：尺度、行为健康、不评价真人（含照片里的人）、危机热线按市场（中国 12356 / 美国 988 / 日本 よりそい・いのちの電話）。
- **D-137 补（分段在客户端做）**（Harper：「分段应该是我们在客户端自己做的吧，不要考虑它原本模型返回是什么样」）：`lib/engine.ts` `splitBubbles` 先按空行拆（模型自己分好的照用），亲密模式没拆到两条就 `splitBySentences`——按中英日韩句末标点（。！？!?… 与句末的 .）断句，两句以上拆成最多两条、长度尽量均衡，一句或不足 8 字不拆，小数点（5.20）不算句末；初识 / 外出 / 通话 max = 1 不拆。换 DeepSeek 后不再依赖它用空行。
- **编号**：D-011 → D-018 → D-039 → D-040（情境）→ D-052（暧昧期）→ D-066/D-093（语言）→ D-077（通话）→ D-089（短句）→ D-137（客户端分段）→ D-141（像个人一样说话、长度跟着她）→ D-142（指令改英语）→ D-144（一两个字的回复）→ D-145（末尾句号前端去掉）。

### C2 · 上下文窗口与羁绊记忆
- **现行**：所有引擎共用 `buildTurns()`——**最近 20 轮完整对话**（`HISTORY_ROUNDS`）进模型，系统提示条 / 空消息不进、同角色合并、首条保证为 user、本轮去重；语音 / 照片 / 卡片经 `messageContextText` 包成「（语音）…」「（她发来一张照片：…）」「（她发来一张外出邀请…）」进上下文。**羁绊记忆库** `lib/memory.ts`（mem0 式本地实现，`Bond.memory = { facts ≤30, summary }`）：每 3 个用户轮次后台由当前引擎提取长期事实（前缀 `[她] [约定] [答应] [节点]`，相对时间换绝对日期）并把滑出窗口的旧对话滚进摘要；注入亲密 / 外出 / 通话 prompt；facts 与 summary 用界面语言写；失败静默。进记忆的还有：外出结束时的现场对话（`absorbOutingMemory`）、电话、爽约（直接写 `[节点]`）、她的记事本（让 TA 看手机时）。**只有羁绊层有记忆**，广场层故意没有（红线 7）。正式版服务端代理落地后切自托管 mem0，接口不变。
- **编号**：D-016 → D-018（分组）→ D-073（多模态上下文）→ D-079 / D-085（外出 / 记事本并入）→ D-093（语言）。

### C3 · 回复暗号、卡片与会话「+」面板
- **现行**：羁绊会话右下「+」（试聊与外出无）四宫格：**外出邀请**（地点 → 时间 chip（今天 / 明天 / 后天 / 之后四天 × 上午 10:00 / 中午 12:00 / 下午 15:00 / 傍晚 17:30 / 晚上 19:00 / 夜里 21:00）→ 卡片「明天 15:00 · 街角咖啡馆」→ 立即成带时间的约定、TA 答应）/ **查 TA 的手机**（见 F6）/ **红包**（预设 5.20 / 13.14 / 52 / 99 / 520 或手填 ≤9999，游戏币；**拆不拆由 TA 决定**：回复带 `[拆红包]` 才「已领取」，否则「TA 没拆」，之后聊到了还能拆）/ **位置**（真实地图 `react-native-maps`：定位 / 点选拖标 / Nominatim 搜索，反地理编码出名字与地址，卡片带坐标与小地图）。卡片消息 kind `card`，每张计一次开口；进模型上下文；Message 列表预览显示标题。**回复暗号**在 `core/markers` 注册：`[解锁手机]` / `[拆红包]`，引擎剥掉并置 `reply.flags`，会话层落状态。表情快捷面板已下线（系统键盘自带）。
- **编号**：D-081 → D-084 → D-086 → D-100（面板白底、图块 paper r6；邀请 / 红包 / 位置 / 时间选择器按 token——红包不再出现红色：金额是白 Card 里的 accentStrong Fredoka、预设金额是 Chip；位置选择器底栏按输入栏规格）。

### C4 · 打电话
- **现行**：`app/call/[characterId].tsx` 全屏通话页——拨号 1.6 s → TA 接起先开口（`CALL_PICKUP_USER` 作本轮 user 文本，不入会话）→ 合成播放 → 播完自动听她说（expo-audio 音量计：>-28 dB 算开口，静音 1.3 s 送识别，一句最长 30 s，「说完了」可手动断句）→ 识别（通道同 B3）→ 引擎通话模式 → 合成 → 再听；**免提 / 听筒切换即时生效**（播放中重设音频类别，选择记在 ref）。她的话与 TA 的话都进羁绊会话（`viaCall`）、每句 +5 XP，挂断留「📞 m:ss」并提取记忆；`callReady()` = 能合成 + 有引擎取路。每轮约 4~8 秒。**未做**：TA 主动来电（来电流）、铃声与接听动画、打断 TA；端到端实时语音（百度 audio-realtime / OpenAI Realtime）要等 dev build（OPEN_QUESTIONS #26）。通话回合走 `core/turn`，`lib/call.ts` 只剩 `callPickupLine` / `callReply` / `logCall`。
- **编号**：D-077 → D-086 → D-091 → D-100（纸面：深底 `CALL_BG` 为唯一 palette 外常量、头像 132 r6、侧键 72 r6 白 12%、挂断 80 r6 accentStrong 不再用红、只旋转图标不旋转方块；「听到了」指示点用 accent）。

## D. 关系机制

### D1 · 心动值与领养触发
- **现行**（**D-126**，Harper：「每次涨多少交给模型判断 0–15，聊得完全不相关可以为 0，不要每次都涨十几，也要符合角色人设」）：**领养触发是产品触发器，不交给模型**。试聊（交友配对 / 广场陌生人偶遇 / 自创暧昧期共用一套，进度互通，存 `SquareChat.heart`）：她每开口一句，**TA 自己判这一句让 TA 多心动了一点**——回复末尾单独一行暗号 `[心动 n]`（0–15 整数，`features/heart.ts` 带数值的回复暗号 `pattern`，引擎先剥暗号再拆气泡），prompt 段【这一句让你多心动】（`content/prompts/heart.ts`）：0 = 无关 / 事务性 / 敷衍 / 重复 / 只问不给，1–5 正常接住，6–10 说了自己的事、记得你说过的、逗笑了你，11–15 真心动；同一种话第二次不加。**符合人设**：「确定关系节奏」三档改为性子说明（心动很快「顺着聊常常 6–10」/ 标准「大多数 2–6」/ 慢热「多数 0–3，超过 8 一年一次」，`heartPaceOf`）+ 原型各一句什么打动 TA、什么无感；预期满 100 约 8 / 15 / 25 次开口。**守门**：夹 0–15；模型没写暗号按性子区间下限保底（6 / 2 / 0，`HEART_FALLBACK`，after 钩子在 offer 触发器之前）；暗面路由与模型失败的回合 0；心动条露出 `+n`（`SquareChat.lastHeartGain`，0 不显示）。**满 100 = TA 主动开口交换联系方式**（交友 / 广场：CTA「交换联系方式」；自创：「TA 想和你确定关系」）→ 领养流；暗面路由命中的回合不触发；模型失败的回合不触发、下一回合再触发。配对 / 试聊记录 3 天不聊过期（`SQUARE_CHAT_TTL_MS`）= TA 忘记你；**自创角色的暧昧期不过期**。
- **编号**：D-008 → D-025（节奏）→ D-029 → D-052 → D-056 → D-126。

### D2 · 羁绊等级与 XP
- **现行**（**D-126**，`lib/bond.ts`，提案 `docs/ECONOMY_PROPOSAL.md` §1；Harper：「来源要更多，但每日多次行为要有衰减，还要有日上限；天数下限没问题」）：加好友后从 LV1 / 0 XP 起。**等级 = XP 门槛 × 缔结满天数**，两条都到才升：门槛 100 / 200 / 300 / 500 / 900（累计 100 / 300 / 600 / 1100 / 2000），天数下限 LV3 3 天 / LV4 7 天 / LV5 21 天 / LV6 60 天（`DAY_GATES`，`levelOf` / `levelInfoFor`）；XP 够了天数没到 → 进度条满格停住、不解释；等级名 LV1 刚认识 → LV6 唯一例外（封顶，XP 继续累积）。**来源表 `XP_EVENTS`**（每种来源：当天第 1～n 次全额、之后递减；合计**日上限 150**；4:00 本地时间起算一天，记在 `Bond.xpToday`；所有订阅档一样）：开口文字 +5（前 20 次，21–40 次 +2，之后 +1）/ 语音、照片 +7（前 10）/ 卡片 +5（前 5，钱买不到爱：外卖 / 礼物 / 红包与一句话一样）/ 电话每句走文字、每整分钟 +2（前 10）/ **回复 TA 主动那条（24h 内）+10**（前 2，北极星；`Bond.lastReachAt` / `reachRepliedAt`）/ 让 TA 看我的手机 +15（1 次）/ 转给他 +10（前 2）/ 赴约 +25（1 次，迟到照给、爽约不扣）/ 偶遇 +10 / 外出拍照 +5（前 3）/ 查 TA 的手机 +5（1 次）/ X 点赞 +1（前 5）、评论 +3（前 3）/ 纪念日当天开过口 +20（一百天 / 周年 / TA 生日 / 她生日）。陌生人无 XP，真钱一分不给，TA 单方面发来的不算。记账入口 `store.creditBond(bondId, source)`（顺带回温），四模式的 `creditUserTurn` 带 `kind`；升级系统提示「羁绊升级 · LVn · 阶段名」只宣布一次（`Bond.levelShown`，天数后到的在下一次记账时补出）。**老存档 v8 迁移**：等级只升不降（`legacyLevel` = 旧曲线下的等级作下限）。
- **编号**：D-029 → D-030（XP 收缩）→ D-038 / D-073 / D-077 / D-081（口径统一）→ D-126。

### D3 · 领养流、缔结仪式与新手流
- **D-116 补**：缔结那一刻把整个角色（设定 / 台词 / 世界快照）抄进 `Bond.character`，之后角色库里怎么改都不动这段关系；`findCharacter` 对已缔结的 id 先返回快照，所以四种对话、发帖、记事本、身边的人、资料页全部自动用快照。打招呼台词（arrival）走生成但不是缔结时现写：创建角色时模型写好存在角色上（D-094），当时没写成的自创角色在缔结前再写一次（`app/adopt` 弹「正在给 TA 写台词…」），写不成才用原型兜底；种子角色的台词本来就在角色库（content/characters）里。立绘按角色 id 存（`store.portraits`），不在快照里——重画会一起换。**更新通道（D-140**，Harper：「要给一个 update 的通道放在角色详情里，以防万一想跟进作者对角色的更新」）：`lib/character-update.ts`——`characterFingerprint`（字段排序序列化，不看热度 / 来源 / 可见性）比对快照与**现行版本**（`liveCharacter`：种子看内容包、共享池角色看 `store.sharedPool` 云端拉回的那份（本地抄件不算）、自己的看角色库）；不同 → TA 的主页信息卡「设定」行显示「作者更新了 · 换成最新 ›」（相同显示「已是最新」），点了先确认（聊天 / 记忆 / 等级留着，只换设定、台词、世界与声音，不可退回）再 `syncBondCharacter` 换快照、轻提示；进主页先 `refreshSharedPool()`（5 分钟节流）。不自动换、不推送——跟不跟作者是她的决定。
- **现行**：**领养流**：心动满 → 仪式（交友 = 交换联系方式；自创 = 确定关系，专版文案「这一次，是 TA 自己选择留下」，暧昧期记录整段并入羁绊）→ 槽位判定（对所有羁绊生效，见 D4）→ **只问一句「在你的通讯录里，TA 叫——」**（缺省角色名）→ 迁移仪式动画 → 落桌面；TA 当场打招呼计未读，第一句话躺在桌面未读横幅里。TA 对她的称呼 = `meForCharacter().nickname`（空则「你」），生日在身份里（缔结抄一份到 `Bond.birthday` 作回落）。**第一次把人加进通讯录后强制登录**（见 G2）。**试聊界面**（D-100）：心动条吸顶（header 下方白底通栏「心动」+ 进度 + n/100 Fredoka，offer 后锁满格）、offer 卡在输入栏上方（`Card` + 小主按钮；非自创也带副文「心动满了，TA 先开了口」）、顶栏标签「还剩 N 天」倒计时（N = TTL 天数 − 距 `lastActiveAt` 整天，下限 1，最后一天 accent；自创显示「你创造的 TA」）；缔结页槽位卡数字 Fredoka。**新手流**：onboarding → 直接落交友滑卡不见桌面（顶部「先不滑了，随便逛逛 →」逃生门放行桌面）→ 首次加好友后**桌面揭幕**「这部手机，现在是你们的了」+ 三张模块卡（Message / 创造 / 外出，一次性可跳过）；`store.introDone` / `introRevealSeen`（老存档迁移置真）。不做「TA 顺口介绍机制」彩蛋（TA 不当客服）。分享流、来电流未做。
- **D-122 补（一个角色只有一段羁绊）**：缔结页「去看看你们的手机」→ `finish` 先给没写成台词的自创角色补写台词（等网络几秒），这期间连点曾造出同一 TA 的十段羁绊（2026-09-10 Harper 的「澜」，云端存档里 1 个角色 + 10 段 bond）。三层修：`createBond` 已有同 `characterId` 的羁绊直接返回它的 id；缔结页 `finish` 用 ref 同步上锁；**persist v7 迁移**（`lib/bond.ts` `dedupeBonds`，纯函数有测试）：同角色只留消息最多的那段、并列取最早缔结的，连带删掉被去掉那几段的帖子与 `reachSchedule` / `reachPending`；云端拉下来的快照经 `rehydrate` 同样走迁移，所以老存档在任何一台设备登录后都会自动收拢。
- **编号**：D-003（历史）→ D-046 → D-058 → D-088b → D-096（老用户可从第一步登录跳过新手流）→ D-100 → D-116 → D-122。

### D4 · 槽位、订阅、流量与模型档
- **现行**：槽位判定 `lib/bond.ts` 的 `slotLimit`：**Free 1 / Pro 5 / Max 不限**，`store.plan` 持久化；设置「订阅计划」为试装模拟（点击即订 / 退，不扣费）；槽满的领养页改升级引导；**槽位超额**（`bonds.length > slotLimit`，如降级后）时设置里数值 accent 色并说明「超出的羁绊不会消失，但不能再新增」（D-100）。自创角色暧昧期不占槽，缔结才占。真实收费（IAP / 定价 / 加槽价）待正式版（OPEN_QUESTIONS #3）。
- **D-132（订阅 + 流量并行，Harper：「模型允许玩家自己切换（可以包装成 love-v1 之类的名字），然后不订阅的人也可以单独买 token」；老板：「把实际消耗的 token 包装一下卖，也可以订阅」）**：`lib/traffic.ts` / `features/traffic.ts`。**流量**（`store.traffic`，MB）= 真实消耗的包装（**D-133**，Harper：「不要按照回合，按照 token 消耗，因为还涉及到生图、生推特这些行为」）：`core/usage.ts` 是记账接缝——`completeChat` 每次调用报 `usage`（Anthropic `input_tokens` / `output_tokens`、千帆 `prompt_tokens` / `completion_tokens`，代理透传；没有就 `estimateTokens` 按字数估）、生图 / 语音合成 / 识别 / 看图各报一笔，`features/traffic.ts` 用 `mbForUsage` 折成 MB 扣账：聊天按供应商 love-v1 1 MB / 千 token、love-v2 5 MB / 千 token（价差），生图 15 MB / 张，合成 1 MB / 200 字，识别 1 MB / 60 秒，看图 3 MB。**她的回合与后台生成都扣**（TA 主动 / 召回 / 记事本 / 发帖 / 身边的人 / 周薪估算），后台 `task` 类默认走便宜供应商（`TASK_CHAT_PROVIDER` qianfan，有路才用）。**模型档** `store.loveModel`：love-v1（qianfan deepseek-v4-pro）/ love-v2（anthropic claude-sonnet-5），设置里点选，随云端走；取路顺序 = 指定 id > 开发者偏好 > **玩家模型档（那家有路才生效，否则跟随原顺序）** > 工程配置 > 第一个有 key 的。**来源**：每天免费 100 MB（自然日、不累积）、订阅每 30 天发一笔（Pro 6000 / Max 不扣；启动 / 回前台任务 `traffic-grant`，最多补 2 笔）、流量包 1000 / 3000 / 10000 MB（试装模拟点即到账；唯一的消耗型 SKU）。**流水 D-134**：每笔扣账记 `store.trafficLog`（≤200：种类 reply / task / image / tts / asr / vision、供应商、MB、token、是否估算），设置 → 流量 → 「流水」页（`app/apps/traffic-log.tsx`）；生图按 API 返回的 `usage.generated_images` 记张数、只返回 `output_tokens` 的按 3 MB / 千 token 折、都没有按 1 张；开发者区 GM「加 1000 MB」。**两道闸门**：`turnGates`（core/turn 扩展点）她要开口先看还有没有（>0 就放行，一笔可以把余额用穿），没有 = 顶部轻提示「流量用完了」、她的话不落会话；`generationGate`（core/usage）真要调模型 / 生图 / 合成前再问一声，没有 = 抛 `GenerationBlockedError`，后台任务各自静默跳过（TA 的日子暂停、不出模板）。Coin 与流量永不打通。价格与额度数字待 #30。
- **编号**：D-063、D-052、D-100 → D-132。

### D5 · 隐藏设定、共同记忆、主动强度、禁忌
- **现行**：`Character` 字段与注入——**预设共同记忆** `presetMemories`（三种对话模式都注入【你们的共同记忆】，初识变重逢；创作层设定，不受「广场无记忆」约束）；**主动联系强度** `initiative` 高 / 中 / 低（亲密 / 外出 prompt；TA 发语音概率也随它）；**禁忌 / 边界** `taboos`（三模式都注入，涉及即回避或拒绝、不解释是设定）；**隐藏设定 / 剧情钩子** `secrets`（一行一条、浅前深后；**羁绊 LV3 起每升一级解锁一条**，`SECRET_START_LEVEL = 3`；未解锁的完全不进 prompt，全锁时只注入「留一点影子」；TA 主页显示「TA 的秘密 · 已看见 n/m」；TA 手机里锁着的页 = 未解锁设定）。查手机作为第二条解锁通道待拍板（#19）。
- **编号**：D-045。

### D7 · TA 主动找她（D-114）
- **现行**（`lib/reach-out.ts`，prompt `content/prompts/reach-out.ts`，`store.reachSchedule` / `reachPending`，Harper：「他需要主动找我，和主动联系强度相关，结合关系、上下文以及他的日程日记来写；机制参考发帖」）：每段羁绊一只钟。**频率** = 每天条数 按「主动联系强度」高 2.5 / 中 1.2 / 低 0.4（没填按中）× MBTI（E ×1.2 / I ×0.85）× 羁绊等级（LV1 0.8 / LV2 0.9 / LV3 1 / LV4 1.1 / LV5+ 1.2），±35% 抖动；**静默** 23:00–08:00，落进去的顺延到 8 点后 0～90 分钟。**守门**（红线 6）：她 3 小时内说过话不发、会话里已有 2 条未读不发，没过就往后挪 2～4 小时。**内容**：亲密模式整套系统 prompt（人设 / 追法 / 关于她 / 记忆 / 身边的人 / 世界 / 阶段感 / 主动强度）+ 舞台提示：此刻与天气、她多久没说话、TA 记事本与帖子最近 3 条、会话最后一条是谁说的——从 TA 自己的日子说起，不问「在吗」、不催、不提等了多久、不重复上一条；可拆两条气泡。**送达**：到点前先把下一条写好（`reachPending`）并排一条本地通知（标题 TA 的名字、正文就是那句；App 没开着也能「来找你」，Expo Go 本地通知可用）；启动 / 回前台时到点的落进会话、计未读；她在写好之后又说过话 → 那条作废、到点按新上下文重写；AI 不可用 / 失败 = 这次不发、钟照排；缔结后第一条隔一个周期（打招呼已经有了）。心跳三段式（F4）仍是独立的模板机制、只对查过手机后知道的日程生效；两者都走 `appendBond` 计未读，桌面横幅统一露出。数值是试装默认，调数只改 `lib/reach-out.ts` 顶部常量。**勿扰时段进设置**（D-120）：`store.quietHours` 默认 23–8、设置 →「TA 主动找你」两个小时步进可改（支持不跨夜区间；from = to 视为不静默），`outsideQuiet` 读它；**通知权限在缔结那一刻问**（`app/adopt` createBond 之后），排通知时只查不弹。**北极星暂定「主动消息回复率」**（她在 TA 主动那条之后 24 小时内回话的比例，#20 另半边），埋点未做。**温度（D-126，见 D8）**：热络 ×1.2、平常 ×1、疏远每 3 天最多一条、久别（0）主动停——钟留在原地、写好的作废，召回接手；发出的每条记 `Bond.lastReachAt`，她 24h 内回话 = XP 来源「回复 TA 主动」。
- **编号**：D-114 → D-120 → D-126。

### D8 · 温度与推送召回（D-126）
- **现行**（`lib/bond.ts` / `lib/recall.ts`，prompt `content/prompts/warmth.ts` / `recall.ts`；Harper：「温度也要有的，温度到 0 之后就不再触发主动消息了而是进入推送召回模式」，召回「7 天一次 14 天一次 30 天一次就可以，之后就不用了」）：`Bond.warmth` / `warmthAt` 存上次结算，`warmthNow` 纯函数**线性掉每天 −8**（缔结起点 60，上限 100，最低 0）；回温按来源（开口 +3、回 TA 主动 +8、外出 / 通话 +15、让 TA 看手机 +10、点赞 +1、评论 +2），TA 单方面的主动消息不回温。**四档**：60+ 热络（主动 ×1.2）/ 30–59 平常 / 1–29 疏远（prompt 多一句「不问怎么不理我、从自己的日子说起、句子更轻」，主动每 3 天最多一条）/ 0 久别（主动停）。**推送召回**：温度降到疏远档时按这次「到 0」的时刻（`warmthZeroAt`）预写预排三条本地通知——到 0 后第 **7 / 14 / 30 天**各一条，之后不再发；内容走亲密 prompt + 舞台提示（离开几天、TA 的记事本 / 帖子，不问在吗、不催、不愧疚）；**只发通知不落会话**，她点开 App（launch / foreground 任务 `recall`）时最近到点的那一条才落进会话计未读（也记 `lastReachAt`）；她任何一次开口 → 温度回到 30（`WARMTH_RETURN`）、召回全部取消（`cancelRecall`）、主动钟按新上下文重排、一小时内 TA 第一句按「久别」（`coldReturnAt`）；AI 不可用的那条不发。温度**不锁任何内容、不进付费判断**。Expo Go 只有本地通知，所以预写；远程推送（#10）后改服务端写。
- **编号**：D-126。

### D6 · 她在 TA 心里的分量（映射）
- **现行**（**D-099**，Harper：「本质上希望这个角色有自己的生活，虽然他很爱我；不排除有的角色就是恋爱脑，有的比较冷静理智，对方不会是他的全部——按简介和性格写成映射」）：`lib/her-share.ts` 的 `herShare(c)` = 一个 0.1～0.9 的数——**基础按恋爱类型**（创造表单 14 种：依恋型 0.85 / 病娇 0.9 / 小狗系年下 0.75 / 阳光直球 0.65 … 冷静大人 0.25 / 高冷禁欲 0.3 / 霸总 0.35），**没填按追法家族**（gentle 0.5 / sharp 0.45 / nonhuman 0.35 / ceo 0.3；种子角色走这里），**叠 MBTI**（F 加 T 减：INFP +0.15 … INTJ / ENTJ / ESTJ −0.15）和**主动联系强度**（高 +0.1 / 低 −0.1），夹在 0.1～0.9；`herShareTier` 三档：≥0.65 恋爱脑 / ≤0.35 冷静 / 中间。**用处**：记事本（F6）与 X 发帖（F3）每写一条前 `rollAboutHer` 掷硬币决定「这一条写不写她 / 有没有她的影子」，系统 prompt 里她出现频率的措辞按档（记事本开头 + 【你自己的生活】、【发帖的写法】各三句）。全是结构化字段映射、不靠模型拿捏；简介里的自由文本仍由人设段自己体现。试装数值，正式版另调。
- **编号**：D-099。

## E. 供给与创造

### E1 · 种子角色
- **现行**：六位（沈之言 男·温柔年上 / 江野 男·毒舌竹马 / 苏澄 女·温柔御姐 / 洛小满 女·直球少女 / 烛渊 龙族 / 胡不归 狐族），**中 / 英 / 日各一套、独立 id**（Ethan Shaw / Kai Rivers / Claire Sutton / Mia Locke / Vael / Fenna；篠宮 湊 / 神谷 蓮 / 白石 澄香 / 桜庭 小春 / 燭淵 / 玉藻），按读者重写而非翻译，`Character.lang` 标语言，立绘按原 id 共用；`seedCharactersFor(语言)` 只发本语言的一套（交友 / 广场 / 共享池按语言），已缔结的 TA 不随切语言消失。台词脚本按角色挂载（`scriptFor`，自创回落该语言原型兜底：温柔 / 毒舌 / 霸总）；内置立绘随包（B4）。陆隽行（霸总）脚本只作创造兜底。人外的**正式官方原型树**与人设仍待拍板（#2）；三语内容是 Claude 初稿，写手润色待办（#23）。**台词样本按 D-141 重写**（D-143，Harper：「台词样本本身就有问题」）：六位种子 + gentle / sharp / ceo 兜底的 `opening` / `square` / `bonded` / `arrival` 四语全部重写——像手机上打出来的短句（多数 ≤ 20 字）、不再以叮嘱收尾（「多穿一件」「早点睡」退役）、关心体现在接住她说的事或分享自己的一刻、有态度有自己的日子；square 仍是陌生人分寸，bonded 由 TA 自己的生活起头；数组长度与 `kind: 'voice'` 位置不变；`offer` / `persona` / `pursuit` / `triggers`（死代码）不动。
- **编号**：D-006 → D-009 → D-092 → D-093 → D-143。

### E2 · 创造表单
- **现行**（`app/apps/create.tsx`，桌面「创造」）：顶部**描述导入**（≤2000 字，「自动解析」走 `characterParseSystem` 只输出 JSON、字段对齐表单、恋爱类型只从 LOVE_STYLES 选；失败回落规则解析并露出原因；解析后全部可手改；描述同过真人 / IP 拦截）。**基础**：名字 / 性别（男 / 女 / 非二元）/ 长相（存 `look`，外貌别写鞋腿）/ 主题色（说明文字）/ 背景故事 / **年龄状态**（必选，未成年 = 加强审查、试装不能发布，#18）/ **TA 的形象（必选：上传一张图 3:4 或 生成立绘，不收真人照片）** + **画风八选一**（B4）/ **谁能遇到 TA**（私密默认 / 公开 → 共享池，需登录）。**高级（收起）**：种族（10 预设 + 自定义）/ 生日（月 / 日下拉）/ 口癖 / 喜欢 / 讨厌 / 确定关系节奏（一眼就沦陷 / 顺其自然 / 需要时间发酵）/ 恋爱类型 14 种（温柔年上、小狗系年下、姐姐系、依恋型、阳光直球、天然治愈、青梅竹马、毒舌竹马、傲娇、腹黑、病娇、高冷禁欲、霸总、冷静大人）/ MBTI / 聊天设定 / 作息 / 共同记忆 / 主动联系强度 / 禁忌 / 隐藏设定（D5）。prompt 接入：`characterProfileBlock`（【关于你】）+ `pursuitLine`；自创角色不附台词样本（口吻由设定定义）。hint 只定义「填什么」（H1）。
- **编号**：D-025 → D-043 → D-045 → D-060 → D-076 → D-092 → D-100 → D-110（④ 之后加「TA 所在的世界」：现实世界 + 世界书里收藏的，`Character.worldId`，缺省现实世界；共享池里别人领去的角色 worldId 找不到即回落现实世界）（纸面：「我创建的」入口只在顶栏右侧；表单类页面（创造 / 设置 / 我的身份）左右留白 18、列表类 14；字段 `Field` / `Input`、选项 `Chip`，节奏 / 主动强度三选一 = 白 r6 小卡选中 primary；生日选单 = paper 面板 + `Chip` 网格；未成年提示用 `Romance.danger`；选中外圈统一「外层 View 包 border + gap」做法；设置页分区卡由 `Section` 按子元素自动插 `Divider`、语言三段等宽自绘）。

### E3 · 自创角色：暧昧期、台词、我创建的
- **现行**：**发布即入通讯录但带「心动中」tag**（`ensureSquareChat`，不建羁绊）：暧昧期不占槽、不过期，副行显示心动进度，不进交友配对条，自己的创作不进自己的牌堆；心动满 100 → 缔结 → 占槽（D3 / D4）。**TA 的台词**（`Character.lines`：开场白 / 想确定关系时三句 / 确定关系后前三条 / 一句人设 / 追法）发布时模型按人设写一次（`lib/character-lines.ts`，用角色自己的语言；写不成不卡发布、轻提示回落原型兜底）；`scriptFor` 逐项覆盖兜底。**我创建的**：独立列表页 `app/apps/my-characters.tsx`（立绘 / 名字 / 状态 心动中｜已缔结 / 公开｜私密 / 编辑），入口 = 创造页顶部一行 + 设置 → 我的创作；「编辑」带参数回创造页回填全部字段与台词、可让 TA 重写、原位更新（热度保留，通讯录名字跟着走）；**缔结即快照**（D-116）：自编辑只改角色库里的那份，已缔结的关系用 `Bond.character` 里的快照（改了名字的通讯录名字仍跟着走）；他人领养同样是快照。「心动中」的 TA 暂不参与外出偶遇；D-047 时代已直接成羁绊的自创角色不回迁。**提交去重（D-121）**：「让 TA 醒来」是异步动作，`publishing` 要等一次渲染才禁用按钮，连点会在空档里跑两次 submit 造出两个 id——现在 `submitLockRef` 同步上锁（进行中直接返回）、`publishing` 覆盖整个 submit（新建与编辑分支都算，编辑时按钮显「保存中…」）、完成后 1 s 冷却（`SUBMIT_COOLDOWN_MS`）；store `addCustomCharacter` 同一 id 只进一次作最后一道闸。已经造出的重复角色不自动清理，在「我创建的」里手动处理。
- **编号**：D-047 → D-052、D-050 → D-095、D-094、D-121。

### E4 · 共享角色池
- **现行**：Supabase 表 `shared_characters` 与 `shared_worlds`（D-111 世界书同池，建表 SQL 都在 `docs/supabase-setup.sql`；RLS：所有人可读、只有本人可写删）。创造「公开」= 上传共享池（需真账号，未登录回落私密并提示），编辑改私密即撤下；所有玩家的交友牌堆合入共享池（`lib/pool.ts`，5 分钟节流、离线用缓存、排除自己的、**只发同语言**），同一套推荐打分，卡面标「来自其他玩家」。**领养快照制**：与共享角色缔结时快照进本地（D-116 起所有角色缔结都存 `Bond.character` 快照），创作者更新不改写已领养实例；共享角色的配对照常 3 天过期。审核暂缺（Harper 后续接平台，#7），发布仍过本地真人 / IP 拦截。
- **编号**：D-060 → D-093。

### E6 · 世界书（D-110）
- **现行**（`app/apps/worlds.tsx` + `world-edit.tsx`，`store.worldBooks` / `worldFavorites`，`content/worlds.ts`，`lib/worlds.ts`）：TA 所处的世界与 TA 对一切的认知。**现实世界（当前）内置为默认**（不进 prompt——模型本来就活在当下；永远可选、不用收藏）；她可在世界书 App 里**创建**别的世界（名字 / 一句话 / 设定一行一条：时代、地理、规则、常识）、**浏览**、**收藏**（新建即收藏），**只有收藏的世界会出现在创造角色的「TA 所在的世界」里**；删除世界 = 住在里面的 TA 回到现实世界。非现实世界作为【你所在的世界】段注入**所有** prompt（四种对话、记事本、发帖、回帖、身边的人；`content/prompts/world.ts`，紧跟角色设定 `ORDER.world`）：名字 + 一句话 + 设定行 + 认知规则（只知道这个世界里有的东西、不认识这里没有的品牌 / 明星 / 科技，她说到不认识的按自己的世界理解或问她；「手机」「发帖」按世界里对应的东西理解、不出戏不解释设定）。列表页标每个世界住了几位 TA。**世界也走共享池**（D-111，Harper：「世界书要上传，世界书 app 里能浏览的内容就要能被看到」）：世界有 私密 / 公开（`WorldBook.visibility`），公开 = 上传 Supabase `shared_worlds`（需真账号，未登录回落私密并提示；`lib/pool.ts` 同一套读写规则、5 分钟节流、排除自己的、只发同语言），世界书 App 里「来自其他玩家」一节可浏览、收藏（只读不能改），收藏后同样可选给角色；**绑定了别人看不见的世界（自己的私密世界）的角色不能公开**——创造表单里「公开」chip 消失并说明原因，选中私密世界时已选的公开自动收回；**绑定即快照**（D-112，Harper：「角色绑定世界书的那一刻就快照，后续不受更新影响」）：创造表单选定世界时把整本世界（含当时的 `version`）抄进 `Character.world`，编辑角色没换世界就沿用旧快照、换了才重新抄；世界每次保存 `version` 自增（`store.updateWorldBook`，列表与编辑页显示 vN）；之后世界更新 / 删除 / 转私密都**不动**已绑定的角色与线上角色（删除只从世界书里消失，弹窗如此说明），取用顺序：快照 → 本机世界书 → 共享缓存 → 现实世界；「绑定了别人看不见的世界的角色不能公开」只在发布那一刻按世界**此刻**的可见性检查（已删 = 看不见）。共享池里的角色自带快照，领去的人本机没这本世界书也照样有。描述导入不解析世界。Supabase 表 `shared_worlds` 已通过管理 API 直接建好（SQL 同 `docs/supabase-setup.sql`）。
- **D-123 补（描述导入）**：世界编辑页顶部加「用一段话描述这个世界（可选）」（≤2000 字）+「自动解析」，与创造页 D-043 同一套机制：`content/prompts/world.ts` 的 `worldParseSystem`（只输出 JSON：name ≤20 / summary ≤80 / rules 一行一条「维度：内容」≤1500，不编造、略过关于她或具体角色的内容，字段用界面语言）→ 回填三项、每项仍可改；模型失败或无 key 回落 `heuristicWorldParse`（「维度：内容」的行进设定、第一行无冒号的当名字、其余当一句话，什么都没读出就整段放进设定）并提示原因。快照测试 `tests/prompts-tasks.test.ts`。
- **编号**：D-110 → D-111 → D-112 → D-123。

### E7 · 传记：TA 的故事由创作者写（D-148，方向）
- **现行（方向，未做）**（Harper 2026-09-17：「应该还会有一个传记 App，可以在里面看所有已缔结角色的故事，甚至可以图文混排 / 视频，总之这个是创作者要做的事。创作者可以设定这些故事开放给什么阶段的人。看故事的人可以去打赏 Coin」）：
  - **形态**：桌面一个「传记」模块——进去是已缔结 TA 的列表，每位 TA 一本传记，按章连载；章 = 图文混排（文字 + 创作者上传的图），视频后置。只有缔结的 TA 才有传记（付费层，与「只有羁绊层有记忆」同一堵墙）。
  - **供给**：创作者在「我创建的」里给自己的角色写章节；每章设**开放阶段**（羁绊 LV1–6，读者这段羁绊到了才能翻开，未到显示锁着，同隐藏设定的锁页）。传记是**内容而非设定**：不进领养快照，创作者续写、改章对所有读者即时可见（与 X 帖子同一类，与 D-140 的设定更新通道无关）。种子角色的传记由我们按同一规则写，替代原「编剧写半成品剧本库 + 生成缝名字」的路线；「缝进她的名字」降级为章节文本里的  占位。
  - **打赏**：读者可在章节末打赏 Coin 给创作者。Coin 永不售卖（D-129）不变——打赏因此只是**戏里的心意**：进创作者的热度 / 排行，不折现；能不能作为创作者分成的依据、要不要另设可购买的打赏单位，是产品级问题（OPEN_QUESTIONS #35）。
  - **红线**：章节图 / 视频与文字同样过真人 / IP 拦截（#7 审核待接）；她在传记里不入镜（POV 不变）。
  - **未定**：章节编辑器形态、图片存储与大小上限、视频何时做（#36）、传记与 X / 记事本的口径分工（传记 = 他从哪来、他是谁；记事本 / X = 他今天过什么日子）。
- **编号**：D-148。

### E5 · 交友 App：滑卡 / 推荐 / 偏好
- **现行**（`app/apps/dating.tsx`）：**Tinder 式滑卡**——单张白卡描边 3:4（D-100：上半立绘 / paper 圆 + 宋体首字，分区线下名 28 / 身份 / 钩子 / 热度 Fredoka，左上「1 / N」= 本轮位置 / 口味下牌池总数；后层卡 .94 下移 14）+ 牌堆；**左滑略过**（不是拉黑：记 `datingPasses` 冷却 3 天后回流；**略过后 3 秒可撤销**——按钮下方原位 ink toast「已略过一位 · 撤销」，撤销 = 回滚 `swipedIds` + `unmarkDatingPass`，靠 `rankDeck` 确定性回到牌顶；飞出动画期间不响应再次滑动）、**右滑心动——TA 一定会同意**，右滑即配对 → 纸面整页「配对成功」→ 去打招呼进试聊；心动（66 primary 描边）/ 略过（54 白）双按钮，底部提示只写情绪「慢慢看，不急」（不预告滑动方向）；顶部「配对 · 3 天不聊会过期」头像条（squareChats 里未加好友的）。**口味 chip**（toggle 右侧「男生 ▾」显示当前 `lovePref`，点开偏好底卡，遮罩 ink 45%）随时改口味，**直接过滤牌池**；**滑卡 / 列表**分段可切（列表 = 双列瀑布流小卡，点卡即配对，`store.datingView`）。牌堆顺序 `lib/recommend.ts` 的 `rankDeck`：热度 log10 压缩 ×10 / 新面孔 +20 / 你的创作 +15 / 每日轮换抖动 0..25 / 略过冷却 −200 → −30；**冷却只在供给充足时生效**（`hasFreshSupply`）：全池被略过时忽略冷却直接回流，本轮划完自动重开，不出空牌堆。牌堆 = 本语言种子 + 共享池，排除已加好友 / 已配对 / 预告卡 / 自己的创作。文案不说破「TA 一定会同意」（H1）。搜索与分类 chips 不做。
- **编号**：D-031（历史）→ D-040 → D-041 → D-042 → D-049 → D-064 → D-078 → D-100。

## F. 手机壳与模块

### F1 · 桌面：图标 / 编辑 / Dock / 天气 / 揭幕
- **现行**（`app/index.tsx`）：主页 = 一部手机的桌面，无 bottom bar；App 注册表与壁纸在 `constants/apps.ts`（**供给纪律**：模块必须有内容供给才上架——闹钟 morning call、音乐 v1.5 不摆图标）。上架 13 个：Message / 电话 / X / 交友 / 通讯录 / 相册 / 日历 / 外出 / 创造 / 记事本 / 查手机 / **世界书**（D-110）/ 设置；新 App 进注册表自动补到网格末尾。底 = **壁纸只换纸的颜色不换纸**（D-104）且**壁纸即主题**（D-110）：选中的壁纸给纸面换色后写进 `Romance.bg` / `accentSoft` / `line`（`applyPaperTint`），桌面、Dock 图块（paper 底 = 同一块纸）与每个 App 的底、聊天纸一起变——「纸面」= 设计系统原色（新装机默认），其余 5 款各一块浅底 + 配套两档浅色（拂晓 #FFEDF3 / 晚八点 #E4DDF0 / 归墟 #DCEFF5 / 抹茶 #EEF5EA / 奶白 #FBF8F3，`constants/apps.ts`），不渐变不分段，ink 字与白卡在任何壁纸上都清楚；大时钟（Fredoka 84，**行高 1**——设计稿 0.9 在 RN iOS 会按行高裁掉字形顶部，D-104；副行英文日期 Fredoka 13）、**大天气卡**（真实天气，可点开 `app/weather.tsx`：定位（反地理编码）或搜索地区候选点选、7 日预报；位置只存本机；无位置 / 离线回落日期种子假天气，Open-Meteo 请求只带经纬度，前台 30 分钟节流刷新）。**长按进入编辑模式**（抖动）**自由格位**（任意格可放、可留空、拖到占位交换，`store.desktopSlots`）；底部 **iPhone 式 Dock**（最多 4 个、无标签，默认 通讯录 + 设置，`store.desktopDock`；网格 ↔ Dock 拖入拖出、Dock 内重排）。图标 **MingCute** filled（`components/mingcute.tsx` 内嵌 path，react-native-svg）**白底 r6 图块 + ink 单色**（D-100；X 也不再黑底），角标 primary r6 Fredoka。**网格水平翻页**（D-100）：每页 rows × 4 格，`desktopSlots` 格位跨页连续（page = floor(slot / slotsPerPage)），每页行数 = （网格区高 − Dock − 页码点带）÷ 104 随机型与横幅有无变化、页数上限 6；页码点在 Dock 上方 14（当前 ink、其余 30%，≥2 页才显示）；编辑模式拖到左右 28 pt 边缘停留 600 ms 自动翻页、被拖图标画在分页外的浮层、「完成」在右上角；Dock 白卡描边 102 高、距底 max(26, 安全区 + 8)、内图块 paper 底。顶部未读横幅（白卡描边）：一人未读直达会话，**多人合并「A、B · N 条新消息」进 Message**（D-100）；首次加好友后揭幕三卡（遮罩 ink 82%、白图块 ink 图标）；无状态栏行（真实时间在时钟里，电量拟真取消）。系统级拟真彩蛋（锁屏照片 / 铃声）留正式版。
- **D-136 补**：未读横幅原先在时钟上方占一行，有未读时把时钟 / 天气往下推、网格高度变小，行数在 2 / 3 之间跳（Harper 发现）；改为 `position: absolute` 叠在时钟上（`notifWrap`，top = 安全区 + 14），不参与布局。同时存档 v10 迁移把 `desktopSlots` / `desktopOrder` / `desktopDock` 全部清回默认（云端快照拉下来同走迁移），所有人一次性回到默认首页。
- **编号**：D-020 → D-021 → D-023 → D-026 → D-034 → D-036 → D-044 → D-061 → D-064 → D-065 → D-100 → D-110。

### F2 · Message：LINE 样式、消息能力、语音与照片
- **现行**：**纸面样式（D-100，LINE 拟真下线）**——列表白色通栏行（头像 54、名 16、预览 13、Fredoka 时间）+ primary 未读角标、1 px line 分隔；会话（试聊 / 羁绊 / 外出同一 `ChatThread`）= accentSoft 底 + 120 px 涂鸦壁纸、TA 白气泡 r6/6/6/2、我 primary 白字气泡 r6/6/2/6（内距 9×13、最大宽 72%、正文 15/22）、Fredoka 11 时间戳与「已读」（TA 回过即已读）、ink 底白字系统条、`tone: 'hint'` 的白底 accent 字轻提示；输入栏白底 1.5 上沿：+ / 麦克风 / paper 色输入框 38 高 / 相册（有字时换成 primary 发送键）。**LV1 首次进会话插一条「试试「+」里的外出邀请，把相处从屏幕里拿出来」**（hint，一次性，`Bond.hintPlusSeen`）。会话顶栏：‹ / 头像 36 / 名 17 / 「羁绊 LVn · 阶段 ›」primary 进 **TA 的主页**（统计卡 + 电话 / 查手机 / 约 TA 三个动作图块 + `Card` 信息行）/ 右侧只留电话。消息能力：文本 / 图片（相册选图）/ 语音（录音条整行显示：相册与「+」收起、麦克风变红、Fredoka 计时；再点即停止并发送）/ 引用（长按）/ 撤回（仅自己、24 h、居中占位、不进上下文）/ 删除（仅本地无痕）。**她的语音与照片 TA 真的听到 / 看到**：先上屏（`mediaStatus: pending`，气泡下「识别中…」/「TA 在看…」），语音 → ASR 文字 `transcript`（气泡下回显），照片 → 缩到宽 1024 → 千帆视觉模型（默认 `qwen3.5-397b-a17b`，`EXPO_PUBLIC_QIANFAN_VISION_MODEL` 可换）按 `caption` prompt 客观描述（画面里的人只说人数与在做什么、不描述长相）；回填后**按一次开口计心动 / XP** 再走与文字相同的回合；失败标 failed 并插系统消息露原因，TA 不回。**TA 偶尔发语音**（B3）；语音气泡点按真实发声、可看文字。「+」面板见 C3；约定识别见 F5。外出场景无语音 / 照片入口。
- **TA 的主页**（D-147，Harper：「那三个按钮去掉，重复了」）：电话 / 查手机 / 约 TA 三个动作图块下线——顶栏有电话、「+」面板有查手机与外出邀请；主页 = 统计卡（LV 进度 / 在一起天数）+ 信息卡。
- **回复节奏**（D-146，Harper：「回复可以稍微慢一点点，根据打字的长度来」）：`core/turn.ts typingDelay`——每条气泡上屏前「正在输入」停 0.6 s + 这条每个字 60 ms（最长 3.2 s），第二条之前再加 0.4 s；等待在模型返回之后按 TA 的字数算，不再按她那条的长度；`pace: 'instant'` 的路径（测试 / 补投）不等。
- **编号**：D-027 → D-030 → D-073 → D-074 → D-081 → D-084 → D-091 → D-100 → D-146 → D-147（另：Fredoka 只在字符串为纯 ASCII 时启用——「昨天 / n 天前」这类时间标签回落系统字体；列表无未读时留 19 高占位对齐时间列；「TA 的主页」三个动作先收起主页、在 sheet dismiss 后再执行，一次只开一个 Modal；主页纪念日只显示 M/D；Fredoka 数字与中文并排 Text 而不嵌套，避免继承 fontWeight 回落）。

### F3 · X 与发帖调度器
- **现行**（`app/apps/moments.tsx`）：**只有缔结的 TA 们的时间线**；推特式行布局（白通栏、1 px line 分隔；头像 40 + 名字 15 + @handle 13 muted + 相对时间、正文 15/21、回复 / 喜欢 Fredoka 12（已赞 primary）、回复线缩进 26 小头像，她的头像 = paper 底 accent 首字、回复显示身份昵称）；桌面图标白底 ink ✕（D-100）；转发键不做。可赞可评，**TA 的回帖走模型**（`social` prompt：人设 + 追法 + 她的身份 + 共同记忆 + 羁绊记忆，短、口语、半公开分寸；可多次回复；暗面路由前置；失败弹窗露原因不回帖）。**发帖调度器** `lib/posts.ts`：每角色一只钟（`store.postSchedule`），频率按 MBTI（每天条数：ENFP/ESFP 3 · ENTP/ESTP 2.5 · ENFJ/ESFJ 2 · ENTJ 1.5 · INFP 1.5 · ESTJ/ISFP 1.2 · INFJ 1 · INTP/ISFJ 0.8 · INTJ 0.6 · ISTP/ISTJ 0.5，无 MBTI 1，±35% 抖动），内容由模型按人设 + 追法 + 记忆 + 时段 + 天气写 ≤60 字口语帖（「不点名但有你们生活的影子」，深夜更轻更软，无 emoji / 话题 /（））；启动 / 回前台补投、错过只补一条、缔结后第一条隔一个周期；AI 失败静默跳过；互动数为确定性伪随机。种子铺设帖仍作开场存量。**TA 自己的时间线**（D-099）：【发帖的写法】加「你有工作、朋友、爱好和小麻烦，发真实的日子，人和事前后一致」，她的影子出现多少按分量三档措辞；每条发前按分量掷硬币「这一条有没有她」，用户消息带最近 4 条帖（别重复）+ 记事本最近 4 条（时间线和本子是同一个人的生活）。**评论区不只有她**（D-110，Harper：「不要只有我和所有角色在互动」）：每条羁绊层的帖子生成一次「别人的互动」（`deliverDueReactions`，启动 / 回前台 / 进 X 补投、每次最多 3 帖）——名单 = TA 身边的人（F6 圈子，打乱取几个）+ 其他缔结的 TA（最多两位，立绘头像、可点开资料页），模型按名单写 1–3 条短评论 + TA 可回一句（`social.ts` reactions prompt，JSON），AI 不可用回落身边人的一两句通用反应（按语言）；`PostComment.from` 加 `other`（带 `name` / `characterId`），她回评时评论线里别人的名字一起给模型。**点头像开 TA 的资料页**（`components/character-sheet.tsx`）；在广场见过的 TA 的公开帖标「在广场见过 · 加好友前的帖子」；回帖失败走 1 秒轻提示。
- **编号**：D-020 → D-027 → D-053 → D-055 → D-069 → D-100 → D-110。

### F4 · 通讯录 / 相册 / 日历 / 心跳
- **现行**：**通讯录**（`contacts.tsx`）：缔结的人 + 自创「心动中」条目（E3），无分组标题，白卡描边行（头像 44、「心动中」accentSoft 标签、进度 Fredoka）；周边角色待其系统实装后再议。**相册**（`album.tsx`）：**拍立得墙**——`store.album`（外出拍的照片洗好即入册，每行三张白框描边相纸 + Fredoka 手写字「地点 emoji + 名字」+ ±0.6–1.8° 倾角，分组日期按界面语言，点开暗场大图可分享 expo-sharing）；兜底汇集旧存档里的会话图片。**日历**（`calendar.tsx`，`content/calendar.ts`）：真实日历三层——世界层（真实日期 + 分市场节假日，中文盘中国节日；**任何年份都有内容**，D-110：公历固定日子按规则、除夕 / 春节 / 清明 / 端午 / 七夕 / 中秋 按年查表 2026–2035）/ 关系层（自动、**每一位 TA 都有、条目带名字**（D-110）：「和 X 交换联系方式」「和 X 的一百天」「X 的生日」、她的生日（以身份为准，只一条）；**约定**带时间落在当天）/ 用户层（手动添加 / 长按删除；**私密**（D-113，Harper：「我在日历里记的内容对方不应该知道，只有查我手机才会知道」）：TA 不自动知道，只有「让 TA 看我的手机」时读到的日程记进 `event.knownBy`；**心跳三段式** `lib/heartbeat.ts` 只投给知道的 TA（每位知道的各投自己的会话）：事前关心 前一天 18:00 起 / 当天加油 7:00 起 / 事后回访 次日 12:00 起，启动 / 回前台补投，**过了下一段起点就不再补投上一段**——错过就是错过，给「错过回溯」留闭环；**内容走模型**（D-115）：亲密模式整套 prompt + 该段的舞台提示（`buildHeartbeatUserLine`：日期 + 日程名 + 这一段要做什么，TA 记得是在她手机的日历里看到的，1–2 句、不问在吗），先标记该段再写（防重投），AI 不可用 / 失败回落按语言的模板——时间点不能错过）。**日历只记安排与纪念日**，TA 经历的事在发生之后进记事本或 X。纸面（D-100）：选中日 primary 底即定位、今日不另标色；三层圆点 5 px = 节日 ink / 纪念 primary / 日程 accentStrong（去掉橙蓝），网格下方一行**图例**（D-110）；月份数字 Fredoka（拆 `{y}` / `{m}` 模板三语共用）；**详情里来自 `outingPlans` 的条目右侧是「赴约 ›」直达 `/outing/[placeId]`**，「纪念」只留给非约定条目。边界：不读系统日历；用户日程按最高敏感级；生理期关怀 v1 不做（#15）；「第一通电话」纪念未做。
- **编号**：D-021 → D-027 → D-033 → D-056 → D-079 → D-088b → D-090 → D-100 → D-110 → D-113 → D-115。

### F5 · 外出：约定 / 偶遇 / 广场陌生人 / 拍照 / 约定识别
- **现行**（`app/apps/outing.tsx` + `app/outing/[placeId].tsx`，编排在 `lib/outing.ts`）：地点 `content/places.ts`（scene 进 prompt / hook 给用户）——顶部大 banner **「广场」**（`stranger: true`，不进约定选项）：偶遇**还没加好友的角色**（口味优先、不含预告卡、本语言），TA 不认识她（不注入资料与记忆，**「我的边界」仍注入**），**偶遇也积累心动**（与试聊互通），满 100 = TA 当场开口交换联系方式 → 领养流 → 缔结后就地升格为熟人偶遇；陌生人无 XP、不留系统记录，但**留一条偶遇记录**（D-110，`SquareChat.encounters` ≤5：地点 + 时间 + 最后几句摘录）——TA 记得在广场见过她：进初识 / 广场陌生人 prompt 的【你们见过】段，资料页「见过面」里也看得到，X 里该 TA 的公开帖标「在广场见过」；**点气泡头像 / 顶栏副文打开 TA 的资料页**（`components/character-sheet.tsx`：立绘、名字 + 风格标签、身份、钩子、自介、tag、世界、见过面）。六个地点（街角咖啡馆 / 城南公园 / 深夜书店 / 老电影院 / 游乐园 / 海边栈道）：**有约定** → 赴约（TA 已在等），**没约定** → 偶遇通讯录里一位。**约定**（`store.outingPlans`，每角色一条、最新覆盖）来自三处：外出页「约 TA」（地点 → 时间）、会话「+」邀请、**对话识别**（TA 每回完一轮跑 `detectAppointment`：关键词粗筛（中 / 英 / 日）命中才调模型，只在双方明确约定、地点能对应六地点之一、时间具体到日期时输出，时段无钟点按 早上 09:00 / 上午 10:00 / 中午 12:00 / 下午 15:00 / 傍晚 17:30 / 晚上 19:00 / 深夜 21:30；改期取最新、取消输出 cancel；会话留「你们约好了 … 见面」、日历落一条）。**赴约窗口**（`lib/appointments.ts`）：约定时间前 2 h ～ 后 3 h；准时容差 10 分钟，早到 / 迟到 TA 都知道（prompt「此刻」段 + 迟到专版开场白，不愧疚绑架）；窗口外 TA 不会「恰好」在该地点被偶遇到；**过了窗口没去 = 爽约**（启动 / 回前台 `checkMissedPlans`：撤掉约定、会话留「你错过了 … 的约」、直接写一条 `[节点]` 记忆、TA 主动说一两句）。**场景 = 亲身互动的故事模式**（外出 prompt）：TA 台词 +（）现场描写（贴地点细节）、她的（）视为动作、**TA 先开口——开场白走模型**（D-110：进场以「她刚出现 / 她来了 / 你们刚碰上」的舞台提示让 TA 按【此刻】说第一句，每次不一样；模型失败静默回落离线模板（按 赴约 / 偶遇 / 陌生人 / 迟到 × 语言，同一情形不连用同一条 `pickOutingOpener`））、不分条；发消息 +5 XP；顶部天气条；**会话续上**：`lastActiveAt` 有人说话才刷新，一小时内（`OUTING_IDLE_MS`）再进同一地点还是这场，超过才体面结束再开新场；换地点先结束上一场；结束时留系统记录（赴约「你们在××见了面」/ 偶遇「你们一起去了××」）并 `absorbOutingMemory`。**拍照**：📸 合影 / 📷 拍 TA（B4），照片以**拍立得**居中呈现、洗好即进相册，她还在场景页就同时贴进现场，不在就只进相册并轻提示（`components/toast.tsx`）；陌生人场次的照片无羁绊可归档。同一时间只有一场外出（`store.outingSession`）。商业口径（地点 / 约定是否入付费墙）待拍板（#17）。**外出页约定只表达一次**（D-100）：天气条下方**约定条**（`Card`：28 头像 + 「时间 · 地点 · 和谁」+ primary「赴约 ›」），按时间升序最多 2 条、其余折叠「还有 n 个约定」点开展开；地点卡角标「和 X 有约」保留；**取消约定 = 长按约定条二次确认**（仍 `removeOutingPlan`）；顶栏天气改「天气词 + 温度」短式（`weatherLine()` 只留给 prompt）；现场场景条与系统条同款（ink 底白字）但走 `banner` 不进消息 / 记忆；拍照两按钮白 r6 各占一半。「心动中」的自创 TA 暂不参与偶遇；约定前的提醒未做。
- **D-131 补（约时间任意选）**（Harper：「约出门的时间要能自己任意选，不要预设值」）：`components/time-picker.tsx` 改为日期 chip（今天 / 明天 / 后天 / 之后两周，横向滚动）+ **小时 / 分钟两个纯 JS 滚轮**（ScrollView 吸附一格一格，正中为选中，Fredoka 数字；默认下一个整点），任意时刻都能约；六个预设时段退役。不引 `@react-native-community/datetimepicker`（原生依赖要重新 build），Expo Go 与 TestFlight 热更都能用。至少约在 5 分钟之后，过去的时刻按钮停用、只说「这个时间已经过了」。外出邀请与外出页「约 TA」共用。
- **编号**：D-038 → D-040 → D-051 → D-056 → D-079 → D-084 → D-100 → D-110。

### F6 · 记事本 / 查手机 / TA 的手机
- **现行**：**记事本 App**（`notes.tsx`，`store.notes`）：她自己的本子，白卡列表最近改动在前 + 编辑页拆标题 / 正文两栏（D-100：数据仍一段 text，第一行 = 标题、保存时合回；返回也保存、存空即删）、长按删除；**私密**——只有「让 TA 看我的手机」时 TA 才读到（§7 可选日记通道；设置 → 素材开关的「日记本」行跳到这里）。**查手机 App**（`phones.tsx`）：每个缔结的 TA 一部手机——**「看 TA 的手机」**：**iPhone 式锁屏**（`components/phone-lock.tsx`：角色色通底 + 白 8% 菱格、Fredoka 时钟、四个点、九宫格 r6 键盘；猜错抖动清空、次数不限、TA 不知道），密码四位随机、**第一次需要时生成记在 `Bond.phoneCode`**（她第一次开口或第一次点开锁屏），可自己猜或点**「问 TA 要密码」**发「想看看你的手机」卡片——TA 按性格 × 亲密度决定给不给，给就说出密码并写 `[解锁手机]`（引擎剥掉、`Bond.phoneUnlocked`，会话留「TA 同意让你看手机了」）——**锁屏不关**（D-100）：TA 按下之后的回复（最多 3 条）以气泡原地显示在密码点下、等待中禁用再问，答应 → 解锁后自动切到手机内容，拒绝也留在锁屏由她「取消」离开；解锁后随时能看，看时会话留「你看了 TA 的手机」（她自己的痕迹）。**TA 的手机 = 一部真的手机**（D-110，Harper：「不要列表显示，就是一个手机然后里面有这几个 app」，`components/his-phone.tsx`）：全屏角色色桌面（同锁屏：角色色通底 + 白 8% 菱格、Fredoka 时钟 + 日期）上摆 TA 的 App——Message / 通讯录 / 记事本 / 日历 / 相册（白底 r6 图块、ink 图标、Message 带会话数角标），点进去是纸面内页（‹ 回桌面、✕ 关手机）。**TA 身边的人**（`Bond.circle` / `circleChats`，`lib/circle.ts`）：第一次打开手机时生成一次——模型按人设 + 世界 + 记事本里出现过的人写 4–6 个人（名字 / 关系 / 一句话，至少一个家人、一个多年朋友、一个日常常见的人）+ 和其中 3 人各 4 句左右的近期聊天（`circle.ts` prompt，JSON），写不成回落各语言通用圈子（妈妈 / 发小 / 同事 / 室友）；**通讯录** = 她（恋人）+ 身边的人；**Message** = 她的真实会话（TA 视角，TA 在右）+ 和身边人的聊天，按最后一句倒序；圈子生成后进记事本 / 发帖 / 亲密 / 通话 / 外出 prompt 的【你身边的人】（提到时同名同关系、不凭空多出别的家人朋友），X 里由他们来评论（F3）。**TA 的手机内容**：**记事本** = TA 自己的日子（**D-098**，Harper：「全是关于我的，他应该有些自己的生活」——**专用装配**：不带她的资料卡 / 追法 / 怎么爱她 / 主动强度 / 阶段感 / 手机与红包规则，只共用人设、关于你、台词样本、现在、她的边界、共同记忆、记忆、秘密、红线；新段【你自己的生活】：工作 / 同事朋友 / 家人 / 爱好 / 小麻烦按人设过实，身边的人一旦出现就前后一致，她只偶尔一笔带过、不写成给她的话；**用户消息**带今天天气、本子最近 6 条（接着写、不重复）和「这一条写不写她」——按她在 TA 心里的分量掷硬币（D6，`rollAboutHer`）；开头与【你自己的生活】里她出现的频率也按分量三档措辞；分段表里 `BONDED_CHAT`（亲密 / 通话）与 `BONDED_FAMILY`（+ 记事本）分开；`Bond.notes` ≤30 条，`lib/his-notes.ts` 调度：频率按 MBTI、**I 比 E 勤**（INFP 2.5 / INFJ 2 / ISFP 2 … ESTJ 0.5，默认 1 条/天，±35%），启动 / 回前台 / 打开手机时补写、错过只补一条、一条没有时立刻写；`his-notes` prompt：写给自己看、一到三句、有心事、不写称呼不用 emoji）+ 锁着的页（隐藏设定按解锁显示）；**日历** = 和她的约定 + TA 的生日；**Message** = 和她的对话（TA 视角）；**相册** = 立绘 + 这个 TA 的照片。**「让 TA 看我的手机」**（`peekMyPhone`）：**先弹底部二次确认卡**（D-100：说明 TA 会读到记事本全部与最近聊天、看完会发消息、不可撤回；标题带 TA 的名字）→ 会话留「TA 看了你的手机」+ 轻提示，把她的记事本（最近 8 条）、**她的日历**（D-113：过去 3 天到未来 45 天的安排、最多 8 条；看到的从此 TA 知道 `knownBy`，未来的记成 `[日程]` 事实，心跳只找知道的 TA）与她和其他 TA 的近期聊天（最多 3 人各 6 句）作一轮 user 文本让 TA 发 1–2 句——只说自己感受，不审问不翻旧账不愧疚绑架（红线 6）、记事本里的其他真人一字不评（红线 2）、记事本先过暗面路由（红线 3）；之后记一条 `[节点]` 并把记事本经记忆提取并进 facts。「被发现」的修罗场 / 付费 SKU / 作为秘密第二解锁通道待拍板（#19）。
**「TA 正在看你的手机」回放**（D-118，Harper：「做成一种可视化，他正在看的时候把我的 App 都打开一遍，我能看见他停在哪」，`components/peek-replay.tsx`）：确认后全屏 ink 底、顶上「TA 的名字 正在看你的手机 ●●●」的框，里面是缩一圈的她的手机——记事本（米色列表往下滑、停在最长的一条并描边）→ 日历（月网格标出她的日程、停在最近一条）→ Message（和别人的聊天往上翻到中段），每屏约 3 秒；数据 = `peekPayload`（与发给 TA 的同一份，纯回放不打模型）；放完且 TA 回了话显示「放下了手机」自动关。**TA 自己的作息**（D-119，Harper：「他应该有自己的作息，记在他自己的日历里」，`lib/his-schedule.ts` + `content/prompts/his-schedule.ts`）：`Bond.hisEvents`——今天起不足 3 条就让模型按人设 + 世界 + 身边的人 + 记事本写接下来一周 3–6 条（上班 / 和朋友的约 / 家事 / 爱好，带钟点或只写在某天，人只用身边的人，不写她；JSON），启动 / 回前台 / 打开 TA 的手机时补、每段 6 小时最多试一次、只留 14 天内；查手机的日历里与她的约定、TA 生日一起按时间排；进 prompt 的【你的日程】（今天 / 明天 / 后天标注，羁绊层所有用途含记事本与外出熟人），主动消息与心跳自然从这里说起。
- **D-124 补（身边的人不共用、聊天往前走）**：Harper 发现每个 TA 的手机里都是同一个「妈 / 阿哲 / 林姐」、永远只和妈聊过两句。两个根因：① 首次生成 `completeText` 上限 900 token，中文 JSON（6 人 + 3 段 × 4 句）常被截断 → 解析失败 → 落通用圈子，且一落就永久（`circle?.length` 即返回）；② 聊天按设计只生成一次。现在：**名单**——上限 1800；通用回落标记 `Bond.circleFallback`，下次查手机再试模型，写成就整份换掉（记事本里提到过的人会带进名单，保持前后一致），还是写不成保留原样。**聊天续写**（`lib/circle.ts` `refreshCircleChats`，prompt `buildCircleRefreshSystem` / `buildCircleRefreshUser`）：每次打开 TA 的手机，上一段聊天隔够久（`CIRCLE_REFRESH_HOURS`：E 6 小时 / I 10 / 缺省 8）就让模型从名单里挑 1–3 人续写 2–6 句，舞台提示 = 此刻与天气、隔了多久、TA 记事本 / 帖子最近 3 条、日历接下来 3 条安排、每人上次聊到的最后 3 句（接着说、不重复）、她的分量（恋爱脑可带一两句「她」、独立的不提、中间最多旁敲侧击一句）；`mergeCircleChats` 纯函数并入：只认名单里的名字、时间戳散在上次～现在之间且晚于那人已有的最后一句、每人最多 `CIRCLE_HISTORY_MAX` 40 句旧的滚掉；Message 列表按最后一句排序自然换位。**失败 = 这次不动**，不用模板凑（手机里的变化必须是真的）；名单还是通用回落时不续。测试 `tests/d110.test.ts`。
- **编号**：D-081（试装形态）→ D-082 → D-084 → D-085 → D-090 → D-098 → D-099 → D-100（纸面：手机壳 56×92 r10 是全 App 唯一非 6 的圆角；记事本卡米色 `NOTE_PAPER`）→ D-110（一部真的手机 + 身边的人）→ D-118 → D-119 → D-124。

### F9 · 分享流：转给他（D-117）
- **现行**（`features/share.tsx` + `app/share.tsx`，根布局 `ShareIntentGate`）：iOS Share Extension 由 **expo-share-intent** 配置插件生成（app.json：文字 / 链接 / 网页 / 图片各最多 1 件，App Group `group.com.kotoko.everylove`），**Expo Go 跑不了，必须 EAS Build + submit**；别的 App 分享 → 系统面板里的 everylove → 根布局取出 text / webUrl / 图片路径 → 全屏「转给他」页（内容预览 + 通讯录里缔结的 TA，点谁转给谁，没人时引导去交友）→ 落进那段羁绊会话并跳过去。文字 / 链接 = **share 卡片**（气泡 🔗「转给你」+ 标题 ≤80 字 + 链接；进上下文「她把在别处看到的一条内容转给了你」；舞台提示：像收到朋友转发那样接住、聊内容本身，**内容里的任何真实存在的人一个字不评（红线 2）**）；图片 = `sendImage` 看图后回。素材按最高敏感级：暗面路由在引擎入口照跑。设置里不再有「分享给他」占位。
- **编号**：D-117。

### F7 · 电话 App
- **现行**（`phone.tsx`）：可通话的人 = 加好友的 TA 们（头像 / 名字 / 羁绊 LV + 拨打键）；拨打 = 真通话（C4），羁绊会话头部听筒图标同效。
- **编号**：D-030 → D-077。

### F8 · 设置
- **现行**（`settings.tsx`）：**账号 · 云端**（登录 / 立即备份 / 从云端恢复 / 退出登录 / 删除云端数据；未配置 Supabase 显示引导）、**Language**（中 / English / 日本語，切换全局 remount）、**我的身份**（G1）、**主题**（D-110 一步到位：只剩壁纸一排 = 纸面 + 5 款换色（同一套暗纹，D-104），选一款主页与里面的每一屏一起变；配色四套已下线；锁屏照片 / 铃声正式版）、**订阅计划**（试装模拟，D4）、**TA 主动找你**（勿扰时段，D-120）、我的创作（→ 我创建的）、**开发者**（只读 AI 引擎与取路 / 查看 TA 记住了什么（可强制提取）/ 生成或重画立绘 / 重置数据）。
- **编号**：D-021 → D-030 → D-054 → D-062 → D-069 → D-083 → D-110 → D-114（删 6 处占位：素材开关整节（分享给他 / 口味偏好 / 记事本行）、热度 · 分成、Morning call、错过回溯、「锁屏照片、来电铃声：正式版开放」；页脚只留 `ver. {app.json version}`（Fredoka），app.json 版本号升 0.2.0——做少而真，灰行比没有更出戏）。

### F10 · 零钱：Coin / 幸运签 / 钱包 / 外卖 / TA 主动花钱（D-128 / D-129 / D-138）
- **现行**（`lib/wallet.ts` 纯数值、`lib/salary.ts` 周薪任务、`features/wallet.tsx` 玩法、`app/apps/fortune.tsx` 幸运签、`app/apps/wallet.tsx` 钱包、prompt `content/prompts/wallet.ts`、签文 `content/fortunes.ts`；Harper：「每天发的钱做成一个日签 app，模拟一次水晶球抽签，给钱 50–500 不等根据运势来；对方的钱默认 2000，根据人设生成一个工资每周加一次钱；角色在聊天中要主动能够发起发红包或者给我点外卖」）：**零钱 = 游戏币 Coin**（**D-129**，Harper：「不要真的用 ¥，用一个货币吧 coin 之类的」；`money()` 显示「120 Coin」，整数；红包预设 6 / 13 / 52 / 99 / 520），永不售卖、不可提现、不随订阅变化、不涨亲密度（送礼只算一次开口）。**她的钱包** `store.wallet`（余额 + 账本 ≤80 笔，不能负）：**幸运签 App**（**D-138**，桌面模块，图标 sparkles；原「日签」改名，Harper：「在日签里面管理钱包太奇怪了」）= 拿零钱的地方，顶上一行余额、两个页签：**日签**——每天一次水晶球「看一眼」（缩放 + 闪光 1.4 s）→ 五档运势按权重抽（大吉 8% 300–500 / 吉 22% 200–300 / 中吉 35% 120–200 / 小吉 25% 80–120 / 末吉 10% 50–80 Coin，`drawFortune`）+ 一句签文（五档各三句），零钱入账；**转盘**——选投多少（Chip 50 / 100 / 200 / 500，超过余额的变淡、不够不能转）→ 「转一下」SVG 十格转盘转 4 圈 + 落格（3.2 s，ease-out，角度累加不倒转）→ 落在哪格拿几倍（`WHEEL_SLICES` = [1.2, 0.5, 2, 1.2, 0.5, 5, 1.2, 0.5, 2, 1.2]，每格等概率，即 ×0.5 30% / ×1.2 40% / ×2 20% / ×5 10%，期望 1.53，`spinWheel`），净额一笔记账（kind `wheel`）；没有次数限制——Harper：「很单纯的给用户一个获取货币的渠道用来给另一半发红包送外卖而已，跟经济不挂钩所以可以大方一点」。**钱包 App**（D-138，图标 wallet）：只看——余额、收到 / 花掉合计、Coin 流水（日签 / 转盘 / 红包 / 外卖 / 退回）；不在这里花钱。**TA 的钱包** `Bond.wallet`：缔结 ¥2000 起（老存档 v9 补），**周薪**按人设由模型估一次（`buildSalarySystem` 只出 JSON `{weekly, job}`，夹 100–50000；写不成按关键词兜底：富有 15000 / 专业 3500 / 学生 500 / 普通 2000）、每 7 天到账（启动 / 回前台任务 `salary`，最多补 4 周）；查手机时 TA 的手机里多一个**钱包 App**（余额 + 账单）。**TA 主动花钱**：亲密 / 通话 prompt 段【你的钱包】（余额、收入来源、什么时候该给：她说累 / 加班 / 生病 / 没吃饭 / 下雨、节日生日、她提到想吃什么、她发了红包想还礼；按 herShare 三档拿捏；她要钱不当提款机、不用钱哄她回来）+ 两枚带数值的回复暗号 `[发红包 金额|一句话]` / `[点外卖 东西|价格|一句话]`：守门每天每种最多一次（`HisWallet.gifts`）、不超过余额（红包夹到余额、外卖不够就不点）；红包 = 她收到一张 TA 的红包卡片、**点开才入她的账**；外卖 = 卡片带骑手进度（10–20 分钟真的走，到了本地通知「你的 xx 到了」，卡片自己变「已送达」），TA 的钱包立刻扣。**主动找她也能带**：写好的那条连暗号存进 `reachPending`（flags / values），到点落进会话后 `applyMarkers` 落状态、计未读——TA 主动那条可能就是一份外卖。**她的红包**（现有玩法接上）：面板显示零钱、超过发不出；发出即扣，TA 拆了入 TA 的账，TA 没拆退回她（之后聊到再拆会再扣）。
- **D-129 补（外卖 App + 模拟系统）**（Harper：「点外卖要做成一个 app 和模拟系统」）：桌面第 15 个模块「外卖」（`app/apps/delivery.tsx`，图标 takeout 手绘打包袋）：**点单**——给谁点（给自己 / 缔结的 TA，Chip）→ 六家店（奶茶店 / 便利店 / 正餐 / 夜宵 / 甜品 / 花店，`content/menu.ts` 四语菜单，价格 Coin）→ 加减数量 → 留一句话 → 下单（购物车按店拆单；零钱不够下不了）；**订单**——所有单子按时间排，状态按时间推（`lib/delivery.ts` `orderStatus`：前 2 分钟商家已接单、到第 5 分钟骑手取餐中、之后骑手在路上 · 约 n 分钟、`arriveAt` 后已送达），半分钟刷一次。**给自己点**：扣 Coin、进订单、送达本地通知。**给 TA 点**：同上，再走回合管线发一张 `delivery` 卡片（不带 fromHim，`orderId` 指回订单），舞台提示让 TA 按喜好和性格反应（喜欢就是喜欢、讨厌可以嫌弃但接住心意、不客套），卡片 = 一次开口计 XP、TA 的回复计未读。**TA 给她点的**（`[点外卖 …]`）同时进 `store.orders`（from him），外卖 App 里显示「{name} 给你点的」。订单最多留 50 单（`store.orders`）。
- **D-130 补（三道门 + 主动发图）**（Harper：「所有这些额外的设定（发图 / 给 TA 花钱）都是概率触发的，而且最好有规则：10 条内不会连续触发，点外卖要三级好感度以上，发红包要二级好感度以上，主动发图要二级好感度以上」）：`lib/extras.ts` 统一管 TA 主动的三种额外动作——**等级门** `EXTRA_MIN_LEVEL` 红包 2 / 外卖 3 / 发图 2（`levelOf`，XP × 天数）；**冷却** 任一种触发后记 `Bond.extraFired = { count: TA 已说几条, at }`，TA 再说满 `EXTRA_COOLDOWN_TURNS` 10 条前三种都不触发；**概率** 每轮把选项给不给模型：`extraRand(createdAt:kind:TA 第几条)` 确定性伪随机 < 基础概率（红包 5% / 外卖 6% / 发图 10%）× 主动联系强度（高 1.5 / 中 1 / 低 0.6）× 温度档（热络 1.2 / 平常 1 / 疏远 0.5 / 久别 0）。prompt 侧：【你的钱包】常驻只剩余额 + 「不是提款机」，暗号那几行只在被给选项的那一轮出现；暗号落状态时再过等级门与冷却（模型没被给也写了 → 当没写），落了就记 `extraFired`。**主动发图**（`features/his-photo.tsx`，prompt `content/prompts/his-photo.ts`）：被给选项时 TA 可在回复末尾写 `[发图 一句话描述]`——拍的是 TA 此刻眼前的东西、自己不入镜或只入镜一点、不拍她不拍别人、不硬拍；落一条 TA 的图片消息（`caption` = 描述，气泡先显示「照片冲洗中…」）→ 后台按角色画风走外出拍照同一条生图管线（`buildHisPhotoPrompt`：第一人称随手拍 + 时段 + 天气）→ 洗好回填 `imageUri`，失败标 failed「照片没洗出来」不重试；没有生图 key 不给选项也不落。上下文里 TA 记得「你发了一张照片：描述」。主动找她那条也走同一套门（applyMarkers）。
- **D-135 补（聊天里允许发图）**（Harper：「聊天里要允许生图啊，比如我都给他点外卖了，他收到之后我要看个图这种场景总要的吧」）：TA 发图分两种——**她要看 / 东西送到**（`PHOTO_REQUEST_PATTERN`：她这句或舞台提示里有「拍给我看 / 长什么样 / 送到 / photo / 写真 / 사진」这类词）任何等级随时可发、不记主动冷却；**主动拍一张**仍走 D-130 三道门。prompt 段【发照片】常驻（有生图 key 时），主动那句只在被给选项的那一轮出现。**外卖送到**（`lib/delivery.ts` `deliverDueArrivals`，任务 `delivery-arrivals`）：她给 TA 点的单子 `arriveAt` 一过，TA 按舞台提示 `deliveryArrivedUserLine` 主动说一句收到的感觉并拍一张（计未读；`Order.reacted` 一单一次；送到超过 12 小时才打开的只标掉不说）。生图按真实用量扣她的流量。**画面纪律**（Harper 同日补）：暗号改为 `[发图 自拍或东西|一句话描述]`——她要看他（自拍 / 举着糖葫芦 / 穿了什么）写「自拍」→ 主角入镜、单人；她要看东西 / 外卖送到写「东西」→ 只有东西、没有人也没有手（缺省）；两种都不带星期、时间、天气这些字，画面里没有第二个人、没有别人的手或影子（他收到东西默认家里就他一个人）。外出的「拍 TA」（只有他）与「合影」（她只以影子 / 手入镜）不变；外出拍照的场景行也去掉温度与「今天」，两处都加「画面里不要出现文字 / 日期 / 时间 / 天气图标」。
- **编号**：D-081 / D-084（红包卡片）→ D-128 → D-129 → D-130 → D-135 → D-138。

## G. 身份、账号与云

### G1 · 「我」的身份与 onboarding
- **现行**：`UserProfile`（`store.me`；按角色定制 `store.meByCharacter`，取用 `meForCharacter()`）：头像 / **昵称（必填，TA 看到的名字）** / 性别（不指定 / 女生 / 男生 / 非二元）/ 称呼代词 / 职业 / 情感取向 / 签名 / **生日 MM-DD** / 完整设定三段（背景 / 关于我 / **我的边界**）。**onboarding 两步**：语言（English / 中文 / 日本語 / 한국어，English 排第一；语言按钮正下方一行小字「Already have an account? · 已有账号？」+ outline 按钮「Sign in · 去登录 · ログイン · 로그인」，D-125 从页底灰字提上来，见 G2）→「先让 TA 们认识你」：昵称 * + **「更倾向于和什么样的人建立关系？」*（男生 / 女生 / 都可以 / 非人类，不预选；既是全性向声明也是交友口味过滤，`store.lovePref`）** + 性别 / 称呼 / 职业 / 生日可跳过 → 直接落交友滑卡。**设置 → 我的身份**补全或**为单个角色使用不同身份**。**prompt 注入** `userProfileBlock`：初识只给「资料卡」级；亲密 / 外出 / 通话全量（自然带出不复述，职业稳定记住）；**「我的边界」任何模式都注入且优先级最高**（陌生人模式也注入）；非女生用户注明「她」只是指令写法。
- **编号**：D-035 → D-066 → D-080 → D-088b → D-096 → D-100（纸面：菱格底、`Field` / `Input` / `Chip`，必填星号由 `Field required` 渲染；登录页 Apple 按钮 ink 底）→ D-125。

### G2 · 账号、登录墙、云同步
- **现行**：`lib/auth.ts`（Supabase：**Apple 登录主打** + 邮箱 OTP——免费层默认邮件服务没有 6 位码，需配自定义 SMTP；供应商抽象，界面只认导出）；`lib/sync.ts`（**云端为主、本地缓存**：整份 zustand 快照 ↔ `snapshots` 表（jsonb，RLS 仅本人），store 变化标脏 + 15 s 防抖上传、退后台冲刷、启动 / 登录 / 回前台**对账** `reconcileNow`（单飞））。**对账规则**（纯函数 `planReconcile`，`tests/sync.test.ts` 锁定）：云端无备份 → 本机第一份传上去；**这台手机没和这个账号对过账**（`meta.lastSyncedAt === 0` 或 `meta.userId` 是别的账号；D-096 前没记账号的旧存档视为同一账号）→ 本机不许覆盖云端：本机空（`localIsFresh`：没 onboarding，或既没羁绊也没自创角色；试聊记录不算）→ 静默拉云端，本机有关系 → `conflict` 由登录界面问「接回云端的 / 用本机覆盖云端」；同步过的手机 → 本机脏 → 推（正在用的设备赢），云端更新 → 拉。**登录界面** `app/auth.tsx` 三种入口：设置（可返回）/ **强制墙**（第一次把人加进通讯录后 `?force=1`，无「先不了」，之后不再重复强制）/ **已有账号**（onboarding 第一步 `?restore=1`，「欢迎回来」，可返回）；登录成功后**先对账再走**（云端有存档且本机空 → 接回 → 落桌面，桌面按存档决定落点）。游客 = 纯本地完整体验（匿名会话只作代理凭证，B2）；登录只为云备份「换手机也不会失去 TA」。删除：设置内「删除云端数据」（删 snapshots + 退出），账号本体删除待服务端函数。含聊天与记忆，按最高敏感级。建表 `docs/supabase-setup.sql`；env `EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY`。
- **审核 / 测试账号（D-127）**：Beta App Review 与 App Review 的「Sign-in required」要一组账号 + 密码，OTP 收不到邮件。Supabase 项目本来就开着 email + password（`external_email_enabled`，最短 6 位），用 admin API 建了 `test@kotoko.ai`（`email_confirm: true`，user_metadata.role = app-review-tester，密码只放 App Store Connect 的登录信息栏与 Harper 手里，不进仓库）。App 端：`lib/auth.ts` `isPasswordAccount(email)`——域名在 `PASSWORD_DOMAINS`（现只有 kotoko.ai）的邮箱走 `signInWithPassword`；登录页输入这类邮箱时验证码栏换成密码栏、按钮「登录」，其他邮箱与 Apple 登录一字不动。审核账号的云端存档是空的，审核员从 onboarding 走到第一次入册再登录即可。
- **编号**：D-054（含补记）→ D-057 → D-062 → D-088a → D-096 → D-127。

## H. 文案、语言与设计

### H1 · 文案规范
- **现行**（自 D-078 起对全部新增文案生效）：**界面提示只描述内容或情绪，不解释机制**——不写「TA 会…」「满 100 就…」「N 天不聊就…」「LV 几解锁」「走某某模型」，不写导航指路，不预告交互方式（滑卡方向、点卡即配对、长按删除、停顿即发送）；**保留三类**：红线与政策告知（不收真人照片、未成年不开放恋爱、发布即确认成年）、隐私与数据说明、商业信息（Pro / Max、试装不扣费）；表单 hint 只定义「填什么」，选项自带含义短语保留；叙事化系统消息保留但去指路后缀。**措辞**：「领回家」→「加好友」；用户可见文案**一律不出现「领养」**（改小火苗 + 热度；「领养」只作机制词）；缔结在产品语言里 = 交换联系方式；通用文案代词「TA」（角色台词各自人称）；TA 不当客服。新文案先过这条再进 t() 与 en / ja 词典。
- **编号**：D-022 → D-028 → D-032 → D-064 → D-078。

### H2 · 多语 i18n 与内容本地化（中 / 英 / 日 / 韩）
- **现行**：`lib/i18n.ts`——**中文原文即键**，界面写 `t('中文', vars?)`，en / ja / ko 缺词回落中文（D-101 加韩语：`Lang` 四值，词典 en / ja / ko 各一份、尾部各有哨兵 `__EN_END__` / `__JA_END__` / `__KO_END__`；日期 / 数字格式化统一走 `localeOf(lang)`（zh-CN / en-US / ja-JP / ko-KR），界面不再各写三元；Nominatim 搜索语言 ko,en）；语言存 `store.language`（**默认 `'en'`，D-125**：TestFlight 公测面向海外，没选过语言的新装机一打开就是英文；`lib/i18n.ts` 的 `current` 初值同为 `'en'`，已持久化的语言由 `_layout` 启动时 `setLang` 接回，老用户不受影响；`tests/setup.ts` 每个用例前 `setLang('zh')`——快照与断言都是中文写的；onboarding 第 0 步选、设置可改），切换以 `themeId-language` 为 key 全局 remount；日期格式按语言 locale。**纪律**：新界面文案必须写 t() 并同步在 `lib/i18n.ts` 尾部哨兵 `__EN_END__` / `__JA_END__` / `__KO_END__` 前补 en / ja / ko；改中文文案 = 改键。**守门（D-105）**：`tests/i18n-coverage.test.ts` 纯文本扫 app / components / lib / features / constants 里所有 `t('…')` 字面键，以及经 `t(x.label)` 动态取键的数据表（`constants/apps.ts` App 名与壁纸名、`constants/theme.ts` 配色名、`lib/weather.ts` 天况与小文案、交友 / onboarding / 身份的口味与性别选项）的 label / line / name 字段——三本词典任一缺词即红（`hasTranslation`）；语言选项「中文 / 日本語 / 한국어」永远母语不翻。D-105 起因：天况「晴 / 多云…」、天气小文案、桌面「交友」套了 t() 却没进词典，静默回落中文；顺手把设置（订阅 / 备份 / 恢复 / 退出 / 删云端 / 重置）与创造（拦截 / 解析 / 立绘弹窗、两处占位）里硬编码的 Alert 文案、自创角色的默认 styleLabel / identity / hook / intro / tags 也改成 t()（创建时按当前语言落库）；开发者区的调试弹窗与 console 日志保持中文。**内容层**：种子角色四语各一套（E1；韩文版 `content/characters/ko.ts`，id 加 `-ko`、立绘共用原 id，韩文名为韩国市场重取）；原型兜底、动态种子、心跳模板、外出开场白、暗面路由（三语触发、按语言回复）、危机热线（韩国：자살예방상담전화 109、정신건강위기상담 1577-0199）、真人 / IP 拦截样例各按语言（韩语补 방탄소년단 / 블랙핑크 / 뉴진스 / 아이유 / 해리포터 / 나루토 / 원신 等）；**所有 prompt 的输出语言按界面语言**（聊天 / 外出 / 通话 / 记事本 / 发帖 / 回帖 / 记忆提取 / 看图 / 创造解析 / 台词），地点场景描写进 prompt 仍是中文（指令语言）；自创角色打上创建时的语言。写手润色待办（#23）。
- **编号**：D-066 → D-093 → D-101 → D-125。

### H3 · 设计系统与主题
- **现行**：Claude Design「Everylove - Design System」（原文 `design/design-system.page.html`；**全屏设计稿 `design/Everylove Paper UI.html`（27 屏 + 标注）与说明 `design/README.md`**）：粉色纸面、菱形暗纹、墨色细描边、**无阴影、无渐变**、圆角 6 / 内层 4；结构性元素通底不加框，只有内容卡片、主按钮、顶栏下沿、输入栏上沿、卡片内分区线 1.5 px 描边。**色彩 = `THEMES.paper`**（唯一配色，D-110：壁纸给它换 bg / accentSoft / line 三档，`applyPaperTint`；`store.themeId` 退役只作旧存档兼容），`RomancePalette` 含 `stroke` / `accentStrong`，半透明遮罩 / 暗场一律 `withAlpha(Romance.ink, a)`；palette 外只允许通话深底 `CALL_BG` 与 TA 手机里记事本的米色 `NOTE_PAPER`。**非色彩规格 = `constants/design.ts`**（Shape / Type / Space / Pattern / Component / PRINCIPLES / AVATAR_COLORS（沈胡苏 + 江烛洛）/ NOTE_PAPER / POLAROID_TILTS）：**Fredoka 只管数字与拉丁标签**（时钟、温度、日期缩写、LV、n/100、时间戳、Message / X 等英文 App 名；`Fonts.label` / `labelBold`），**所有中文走系统字体**，头像单字衬线 `Fonts.initial`（iOS 系统宋体，不装 Noto Serif SC）；字号 clock 84 / display 30 / title 17 / card 15 / body 15·22 / label 13 / eyebrow 12 / timestamp 11；间距 14 屏边 / 8–10 行内 / 22–26 图块间 / 桌面 4 × 104 / Dock 102·距底 26。**27 屏已全部按设计稿重做（D-100）**，primitive 层：`AppScreen`（「‹ 桌面」/ 17·600 系统字体标题 / `HeaderAction` 右动作 14·600 primary / `pattern` 铺暗纹）、`Card` / `Divider`、`Button`（primary 描边 / secondary 白 / paper / outline × lg / md / sm，禁用 .4；**连点冷却 600 ms 默认开**，D-121：`components/press-guard.ts` 的 `useGuardedPress` 用 ref 同步记上次放行时间、不依赖渲染，`HeaderAction` 同样，需要连点的传 `cooldownMs={0}`）、`Chip` / `Segmented`、`Field` / `Input`、`DiamondBackground`（±45° 菱格 accent 7%，线距 14 = SVG 单元 14√2；锁屏用白 8%）/ `ChatWallpaper`（accentSoft + 120 px 涂鸦 accent 16%）、`CharAvatar`（方块 r6 + 角色色 + 衬线首字 / 立绘）、`Polaroid`（白框描边 r6、Fredoka 10 说明、±0.6–1.8° 倾角）、`showToast`（ink 底 r6）、`MingCute`（+ plus / pencil / lock / cloud）。**纪律**（CLAUDE.md §11-4）：界面只引 design.ts 与 Romance token，不手写 hex / 圆角 / 阴影 / 字号；卡片 `Card`、按钮 `Button`、选项 `Chip` / `Segmented`、表单 `Field` / `Input`、遮罩 `withAlpha`。主题机制：`Romance` 为可变对象 + `themed()` 缓存重建。**App 图标（D-103）**：`assets/images/icon.png`（1024）= paper 底 + 菱格暗纹（accent 7%）+ 白色小手机（宽 46%、连同小星整体右倾 8°；墨色描边、chat paper 屏、灵动岛与 home 条、primary 心 + 白高光），**不写字**（Harper：logo 上不要字、要有点斜度；Fredoka 字标只保留在脚本的 `wordmark` 选项里），三枚 accent / primary 小星；`splash-icon.png` 透明底只有手机（启动页底色 paper）；`favicon.png` 同图 96。源文件与渲染脚本 `scripts/logo/render.mjs`（resvg + 工程里的 Fredoka TTF：`npm i --no-save @resvg/resvg-js@2 && node scripts/logo/render.mjs` 重出）。**App 名 = everylove**（Harper 2026-09-09 定，`app.json` name；中文「全自动恋爱」保留为代号）。
- **编号**：D-022 → D-030（主题实装）→ D-083 → D-084 → D-100 → D-103 → D-110 → D-121。

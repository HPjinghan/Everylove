# 全自动恋爱（代号 everylove）· 试装

> 自己捏人的乙女游戏：进来捏一个人，他全自动和你恋爱，不用你主动。
> 产品文档见 `CLAUDE.md`，决策日志见 `docs/DECISIONS.md`，待拍板见 `docs/OPEN_QUESTIONS.md`。

## 跑起来（iPhone + Expo Go）

1. 手机装 **Expo Go**（App Store，需支持 SDK 54 的版本）。
2. 电脑和手机连同一个 Wi-Fi。
3. 项目目录下：

   ```bash
   npm install
   npx expo start
   ```

4. 用 iPhone 相机扫终端里的二维码，在 Expo Go 中打开。
   局域网不通时改用 `npx expo start --tunnel`。

## 试装怎么玩（首十分钟闭环）

主页是一部手机的桌面（D-020/D-021）：图标长按可拖动换位，壁纸在「设置 → 主题」换；有未读时桌面顶部有横幅直达会话。

1. 首启回答「你想被谁爱？」→ 进桌面 → 打开「缘分」（交友 App）。
2. 点任意角色卡即聊，他先开口；你发到第 4 句，他会开口要你的联系方式。
3. 走完缔结仪式（起名 → 迁移动画 → 「他晚上八点来找你，要听得见吗？」）。
4. 他先走。晚上八点整，本地通知准时响——他说到做到。
   等不到晚上：「我的 → 开发者 → 让他 3 分钟后来开门」。

## 开发者选项

（入口在桌面「设置」）

- 对话引擎：脚本引擎（离线可跑）/ Claude / 千帆（DeepSeek）；key 推荐填 `.env.local`（模板 `.env.example`），面板手填可覆盖。有千帆 key 时同时启用生图（初见甩图、漫画显影、立绘）。
- 让 TA 3 分钟后来开门 / 让 TA 送一张漫画（测试）。
- 查看 TA 记住了什么（记忆库，可强制提取一次）。
- 为 6 位种子角色生成立绘（测试，后台逐个）/ 重画首个羁绊角色的立绘。
- 重置全部数据：清空所有羁绊与聊天，回到首启。

## 捏＋（自创角色）

基础：名字 → 性别（男/女/非二元）→ 长相 → 背景故事 → 立绘（可选，约 1 分钟）。高级选项（收起）：种族、生日、口癖、喜欢/讨厌、确定关系的节奏、恋爱类型（14 种）、MBTI、聊天设定、日常作息——全部进对话与生图 prompt。有立绘的角色，之后每一格画面都以立绘为参考图生成，长相与穿着保持一致。

## 工程速览

| 位置 | 内容 |
| --- | --- |
| `app/index.tsx` + `app/apps/` | 手机壳桌面 + 8 个模块（Message/朋友圈/缘分/通讯录/相册/日历/捏＋/设置） |
| `constants/apps.ts` | 桌面 App 注册表与壁纸（供给纪律在这里执行） |
| `lib/heartbeat.ts` | 日历心跳三段式：事前/当天/事后，错过不补投 |
| `content/characters.ts` | 种子角色 + 全部台词脚本（产品灵魂所在） |
| `content/prompts.ts` | 全部 prompt：初识/亲密两套对话 prompt、生图（立绘 / 甩图 / 漫画）、记忆提取——改 prompt 只动这里 |
| `lib/engine.ts` | ChatEngine 抽象（暗面路由/尺度/无 PUA 在入口锁死；20 轮上下文窗口） |
| `lib/memory.ts` | 羁绊记忆库：长期事实 + 滚动摘要，后台提取、注入亲密模式 prompt |
| `lib/imagegen.ts` | 千帆生图：立绘、初见甩图、漫画显影；有立绘走参考图编辑 |
| `lib/arrivals.ts` `lib/notifications.ts` | 八点开门：投递 + 本地定时通知 |
| `store/app-store.ts` | zustand + AsyncStorage：搭话记录（3 天过期）、羁绊、动态 |

SDK 锁定 Expo 54，只做 iOS。新增设计决策必须当次写入 `docs/DECISIONS.md`（见 CLAUDE.md 工作规则）。

图标：[MingCute](https://github.com/mingcute-design/mingcute-icons)（Apache-2.0，`components/mingcute.tsx` 内嵌所用 path）。

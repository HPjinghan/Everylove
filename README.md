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

1. 首启回答「你想被谁爱？」→ 落广场。
2. 点任意角色卡即聊，他先开口；你发到第 4 句，他会开口要你的联系方式。
3. 走完缔结仪式（起名 → 迁移动画 → 「他晚上八点来找你，要听得见吗？」）。
4. 他先走。晚上八点整，本地通知准时响——他说到做到。
   等不到晚上：「我的 → 开发者 → 让他 3 分钟后来开门」。

## 开发者选项（我的 tab）

- 对话引擎：默认脚本引擎（离线可跑）；可切 Claude API 并粘贴自己的 key（仅存本机，试装专用）。
- 重置全部数据：清空所有羁绊与聊天，回到首启。

## 工程速览

| 位置 | 内容 |
| --- | --- |
| `app/` | expo-router 路由：五 tab、广场试聊、领养仪式、羁绊会话、onboarding |
| `content/characters.ts` | 种子角色 + 全部台词脚本（产品灵魂所在） |
| `lib/engine.ts` | ChatEngine 抽象（暗面路由/尺度/无 PUA 在入口锁死） |
| `lib/arrivals.ts` `lib/notifications.ts` | 八点开门：投递 + 本地定时通知 |
| `store/app-store.ts` | zustand + AsyncStorage：搭话记录（3 天过期）、羁绊、动态 |

SDK 锁定 Expo 54，只做 iOS。新增设计决策必须当次写入 `docs/DECISIONS.md`（见 CLAUDE.md 工作规则）。

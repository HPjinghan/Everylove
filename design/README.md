# Handoff: Everylove · 纸面设计系统全屏重做 + 交互改动

## Overview
把 Everylove（Expo / React Native 恋爱手机壳 App，repo `HPjinghan/Everylove` master）的全部 27 屏按「纸面」设计系统重做，并附 10 项交互改动。目标：把 `constants/design.ts` + `constants/theme.ts` `THEMES.paper` 已落地的 token 真正应用到每一屏（现状：token 在，界面还没按它改，见 DECISIONS D-083），同时实现标注里的交互改动。

## About the Design Files
本包里的 `.html` 是**用 HTML 画的设计参考**（Claude Design 的原型），不是要直接搬进产品的代码。任务是**在现有 Expo / React Native 代码库里重现**这些界面：沿用 `AppScreen`、`Card`、`CharAvatar`、`ChatThread`、`MingCute` 等已有组件与 `themed(() => StyleSheet.create(...))` 模式，样式值取自 `constants/design.ts`（Shape / Type / Space / Pattern / Component）和 `Romance`（`THEMES.paper`）。

打开方式：直接双击 `Everylove Paper UI.html`（自包含、离线可开）。画布可拖动缩放；每个手机屏右侧的「标注 · FOR CLAUDE CODE」是该屏交互改动的实现说明；没有标注的屏只做样式迁移。

## Fidelity
**High-fidelity**。颜色、字号、间距、圆角、描边都是最终值；按像素重现，但用代码库里的组件与 token 引用（不要写死 hex，全部走 `Romance.*` / `Shape.*` / `Space.*`）。

## Design Tokens（= `THEMES.paper` + `constants/design.ts`）
颜色
- paper `#FFD6E7` → `Romance.bg`：屏幕底色、输入框、Dock 图块、次按钮
- primary `#E8578A` → `Romance.accent`：主按钮、未读角标、我的气泡、选中态、文字动作、日历选中日
- accent `#C2185B` → `Romance.accentStrong`：唯一强调色，数据高亮、心动条文字、暗纹与壁纸线条、通话挂断键（`danger`）
- ink `#4A2B36` → `Romance.ink` / `Romance.stroke`：正文、描边、图标、系统提示条、页码点
- muted `#A97F8D` → `Romance.sub`：次级文字、时间戳、未选中、占位符
- surface `#FFFFFF` → `Romance.card`：卡片、图标图块、对方气泡、输入栏
- chat paper `#FBE4EC` → `Romance.accentSoft`：聊天流底、锁屏预览块、心动中标签底
- line `#F3C4D5` → `Romance.line`：通栏列表的 1px 分隔（Message / X）、标签底
- faint `#C9A9B6` → `Romance.faint`：锁着的秘密、禁用值
- 角色头像色（`AVATAR_COLORS`）：沈 `#3E5C6B` · 胡 `#A8354D` · 苏 `#7A4257`；设计稿新增 江 `#2F6B5E` · 烛 `#8A4B2B` · 洛 `#6B5B8E`
- 记事本纸色（仅 TA 的手机里的记事本卡）`#FFFBEA`，字 `#5B4A2E`

形状（`Shape`）
- radius 6（卡片、图块、按钮、气泡、角标、日历选中日、锁屏键）；radiusInner 4（分段选中块、小标签）；radiusTail 2（气泡尾角）；手机外壳 44
- stroke 1.5px ink，只给：内容卡片、主按钮、顶栏下沿、输入栏上沿、卡片内分区线。图标图块 / 次按钮 / 分段控件 / 气泡 / 角标 / 输入框一律无描边
- 无任何阴影。层级 = paper 底 → 白色图块 → 描边卡片

字体（`Fonts`）
- Fredoka 600 / 500（`Fonts.labelBold` / `Fonts.label`）：**只用于数字与拉丁标签**——时钟 84/0.9/ls-2、温度、日期缩写、LV、n/100、时间戳 11、Message / X 等英文 App 名
- 系统字体（`system-ui`）：所有中文——屏幕标题 17/600、卡片标题 15/600、正文 15/22、标签 13/500、说明 12、脚注 11
- Noto Serif SC 600：仅角色头像单字

间距（`Space`）
- 屏幕左右 14；卡片内距 10×12；行内 8–10；大按钮 / Dock 图块之间 22–26
- 桌面网格 4 列 × 行高 104，图块 60，标签 12/500 距图块 6；Dock 高 102，距底 26
- Match 卡 342 宽 3:4，后层 scale .94 下移 14；气泡内距 9×13，最大宽 72%
- 状态栏 54；顶栏内距 8/14/10，左右槽位 70

图案（`Pattern`）
- 桌面 / 交友 / onboarding / 登录 / 缔结底：paper + 菱格 `repeating-linear-gradient(45deg, rgba(194,24,91,.07) 0 1px, transparent 1px 14px)` ×2（±45°）。RN 里用 `react-native-svg` 画 14px 平铺 pattern
- 聊天流底：`#FBE4EC` + 120px 平铺 SVG 涂鸦（心、环、钻石、十字），accent 线 1.4px、opacity .16。SVG 源见 HTML 里 `background-image:url("data:image/svg+xml,...")`
- 锁屏底：角色色通底 + 白色 8% 菱格（同上，颜色换成 `rgba(255,255,255,.08)`）

## Screens / Views（按代码路径）
每屏共同结构：`AppScreen` 顶栏透底、居中中文标题 17/600、左「‹ 桌面」14/500、右动作 14/600 primary、下沿 1.5px ink。

1. **Onboarding** `app/onboarding.tsx` — 合并版单步表单。标题 30/600、提示 14 muted；字段标签 14/600 + 说明 11 muted；输入框白底 r6 内距 11×14 无描边；chips 白底 r6 8×14，选中 primary 底白字 600；主按钮 primary + 1.5px 描边 r6 15/600，禁用 opacity .4。
2. **Auth** `app/auth.tsx` — 居中：66 白色图块内 cloud 图标；标题 26/600；说明 14/21 muted；Apple 按钮改 ink 底 r6（不用纯黑）；「或用邮箱」分隔线用 line 色；邮箱 / 验证码输入框；主按钮；脚注 11 muted。
3. **Desktop** `app/index.tsx` — 见「交互改动 1」。未读横幅：白卡 1.5px 描边，38 paper 图块内 chat 图标 20、名字 15/600、副文 12 muted。时钟 Fredoka 600 84 ls-2，副行「SUNDAY · SEP 6」13/500 muted ls1。天气卡：白卡描边，☾ 38、温度 Fredoka 44、右列 13/500。图标图块全部 60 白底无描边，MingCute 30 ink；角标 primary r6 min 22 Fredoka 12。Dock：白卡描边 102 高，内图块 60 paper 底。
4. **Dating** `app/apps/dating.tsx` — 顶栏右侧留空；toggle（白底 r6 内距 3，选中块 r4 primary）与口味 chip（白底 r6 8×12，accent 13/600「男生 ▾」）并排居中；「配对 · 3 天不聊会过期」eyebrow 12/500 muted；配对头像 54；牌堆卡白底描边 r6，上半 paper 圆形 118r 托大首字 Noto Serif 120，下半信息块以 1.5px 分区线隔开：名 28/600、身份 13 muted、钩子 13/1.45、热度 Fredoka 12 accent「◆ 1.2万 人心动」；按钮：略过 54 白图块 close 22 muted，心动 66 primary 描边 heart 30 白；底部提示 12 muted（略过后原位换 toast，见改动 2）。
5. **Trial chat** `app/chat/[characterId].tsx` — 顶栏：‹、头像 36、名 17/600、身份 12 muted、右侧「还剩 N 天」白底 r6 11；**吸顶心动条**（见改动 3）；聊天流涂鸦壁纸；offer 卡在输入栏上方（白卡描边：标题 14/600、副文 11 muted、primary 描边按钮 13/600「交换联系方式」）；输入栏白底 1.5px 上沿，+ / mic / 输入框 paper r6 38 高 / 表情。
6. **Adopt** `app/adopt/[characterId].tsx` — 居中：头像 84、标题 22/600、槽位卡（白卡描边 accent 15/600「羁绊槽位 4/5」）、主按钮「开始缔结」、「再想想」13 muted。
7. **Messages** `app/apps/messages.tsx` — 白色通栏列表（结构元素不做卡片）：行 10×14，头像 54，名 16/600，预览 13 muted，时间 Fredoka 11 muted，未读 primary r6 19 高；分隔 1px line 色。去掉 LINE 绿。
8. **Bond chat** `app/bond/[bondId].tsx` — 顶栏：‹、头像 36、名 17/600、「羁绊 LV3 · 心里有你 ›」12/500 primary、右 phone 22 ink；ink 系统条 12 白字 r6；LV1 提示条（改动 4）；气泡：对方白 r 6/6/6/2，我 primary 白字 r 6/6/2/6；时间戳 Fredoka 11 muted。
9. **Bond profile**（`bond/[bondId].tsx` 的 profile Modal，改动 4）— 见标注。
10. **Contacts** `app/apps/contacts.tsx` — 白卡描边行：头像 44、名 15/600、「心动中」标签（accentSoft 底 accent 10/600 r4）、副文 12 muted。
11. **Phone** `app/apps/phone.tsx` — 同上，右侧 42 primary 描边方块内 phone 20 白。
12. **Call** `app/call/[characterId].tsx` — 保持深底 `#1C1A1E`；头像 132 r6；侧键 72 r6 白 12%；挂断 80 r6 **accent** 底（不再用红），图标旋转 135°。
13. **X** `app/apps/moments.tsx` — 白通栏；头像 40；名 15/600 + @handle 13 muted；正文 15/21；动作行 Fredoka 12 muted，已赞 primary；回复缩进头像 26；我的头像 paper 底 accent 字。
14. **Album** `app/apps/album.tsx` — 日期标题 13/600；拍立得：白框 1.5px 描边 r6 内距 6/6/16，照片区 1:1，说明 Fredoka 10 muted，倾斜 ±0.6–1.8°。
15. **Calendar** `app/apps/calendar.tsx` — 月切换 Fredoka 26 primary；周头 12 muted；日格 34 r6，选中 primary 白字，今日不再有 accentSoft 底（选中即今日）；三层圆点 5px：节日 ink / 纪念 primary / 日程 accent（去掉橙蓝）；详情白卡描边 r6 内距 14；约定行右侧「赴约 ›」（改动 7）；添加行：paper 输入框 + primary 描边按钮。
16. **Outing** `app/apps/outing.tsx` — 天气条白 r6 9×14；约定条（改动 8）；广场卡 accentSoft 底描边；地点卡：白卡描边，上 100 高 paper 底放 emoji 40、角标白 r4 10/600 accent，卡下名 14/600、钩子 11 muted。
17. **Outing scene** `app/outing/[placeId].tsx` — 顶栏 ‹ + 名 16/600 + 副文 11 muted + 「结束外出」白 r6 11/600 muted；ink 场景条；气泡同会话；拍照两按钮白 r6 13/600；输入栏。
18. **Create** `app/apps/create.tsx` — 顶栏右「我创建的」；提示 13 muted；描述框白 r6 min 120；计数 Fredoka 11；「自动解析」primary 描边 13/600 禁用 .4；字段标签 14/600；chips 同 onboarding。
19. **My characters** `app/apps/my-characters.tsx` — 白卡描边行：头像 48、名 15/600、身份 12、标签 r4 11（已缔结 accentSoft/accent，其余 line/muted）、「编辑」1.5px 描边 r6 primary 13/600。
20. **Notes** `app/apps/notes.tsx` — 顶栏右 pencil 22 primary；白卡描边：标题 15/600、时间 Fredoka 11 muted、预览 12 muted 单行省略。
21. **Phones** `app/apps/phones.tsx` — 白卡描边行：手机壳 56×92 r10 描边角色色底 + 40 头像 + 22×3 白条；两按钮：「看 TA 的手机」paper 底、「让 TA 看我的手机」primary 描边；二次确认卡（改动 6）。
22. **Phone lock** `components/phone-lock.tsx` — 角色色底 + 白 8% 菱格（去渐变）；lock 18；时钟 Fredoka 84/92 ls-2 白；日期 16 白 85%；「输入密码」18；密码点 13 白描边 1.2；TA 的回复气泡（改动 5）；键 78 r6 白 22%，数字 Fredoka 34、字母 10 ls2；底部两文字 16 白。
23. **His phone** `components/his-phone.tsx` — 标题 16/600 居中 + ×；锁屏预览块 accentSoft r6 22 内距；小节 eyebrow Fredoka 12 muted；记事本卡 `#FFFBEA` 描边；日历 / Message 卡白描边；时间 Fredoka 11。
24. **Settings** `app/apps/settings.tsx` — 分区标题 13/600 muted；白卡描边 r6，行 13×12，行间 1.5px ink 分区线（不用 hairline）；语言分段：paper 底 / 选中 primary 白字 r6；主题点 34 r6 选中 ink outline 2.5；壁纸块 52×88 r6 选中 primary outline 2；槽位超额（改动 9）。
25. **Identity** `app/apps/identity.tsx` — 头像 84 r6 白底 accent 首字 30/600；「更换头像」12/600 primary；字段同 onboarding。
26. **Weather** `app/weather.tsx` — 今日白卡描边居中：☾ Fredoka 52、温度 54、标签 15/600、说明 12、城市 12 muted；「使用当前位置」白 r6 600；搜索行 paper 输入 + primary 描边按钮；7 天卡白描边，行 12 内距、1.5px 分区线，Fredoka 数字。
27. **Desktop p2** — 翻页第 2 页示意（改动 1）。

## Interactions & Behavior（交互改动，与画布标注一致）
1. **桌面翻页 + 未读合并** `app/index.tsx`
   - 多个 bond 有未读时横幅合并「A、B · N 条新消息」→ `/apps/messages`；单人未读仍直达会话。`topUnread` 改为 `bonds.filter(b => b.unread > 0)`。
   - 图标网格改水平翻页：每页 `rows × 4` 格，`store.desktopSlots` 的 slot 跨页连续（`page = floor(slot / slotsPerPage)`），Dock、时钟、天气、横幅不随页滑。
   - 页码点：Dock 上方 14px，6px 圆点，当前 ink、其余 ink 30%，仅 ≥2 页显示。编辑模式拖到屏幕边缘 600ms 自动翻页。
2. **交友：口味 chip + 略过撤销** `app/apps/dating.tsx`
   - 去掉顶栏「偏好」，toggle 右侧放 chip 显示 `lovePref` label + ▾，点开原 prefSheet。
   - 左滑略过后，按钮下方提示文字原位换成 ink 底 toast「已略过一位 · 撤销」，3s 后换回；撤销 = 从 `swipedIds` 移除并 `unmarkDatingPass`（store 新增），卡回牌顶。飞出动画中不响应再次滑动。
3. **试聊：心动条吸顶** `app/chat/[characterId].tsx`
   - 心动条移出 `ChatThread.banner`，改为 header 下方通栏（白底、1.5px ink 下沿），不随消息滚动。<100 显示「心动」+ 进度 + n/100（accent）；满 100 保持满格。
   - offer 仍用输入栏上方的 cta 卡（贴近拇指），按钮 → `/adopt/[characterId]`。
   - 顶栏右标签「刚刚配对」→ 倒计时「还剩 N 天」（3 − 距 `lastActiveAt` 天数），最后 1 天 accent 色；自创角色仍显示「你创造的 TA」。
4. **会话：+ 面板预告 + TA 的主页** `app/bond/[bondId].tsx`
   - LV1 首次进入插入一条提示「试试「+」里的外出邀请，把相处从屏幕里拿出来」（白底 accent 字，非 ink 系统条），只出现一次，`bond.hintPlusSeen` 记录。
   - profile Modal 扩成「TA 的主页」：统计卡下加三个动作图块（60 白底无描边、图标 ink 30、标签 12）：电话 → `/call/[characterId]`；查手机 → PhoneLock / PhoneSheet；约 TA → 外出的 plan 流程（人已定，选地点 → 选时间）。信息行白卡描边，1.5px 分区线。
5. **锁屏：原地显示 TA 的回复** `components/phone-lock.tsx`
   - 「问 TA 要密码」仍调 `askPasscode`，但锁屏不关闭；监听 `bond.messages` 最新一条 him，以气泡（白底 r 6/6/6/2 + 28 头像）显示在密码点下方；拒绝时同样显示。会话里照常留下这两条。
6. **查手机：二次确认** `app/apps/phones.tsx`
   - 「让 TA 看我的手机」先弹底部确认卡（遮罩 ink 45%；白卡描边 r6 内距 16；标题 16/600；说明 13/20 muted：TA 会读到记事本全部、与其他人的最近聊天，看完会发消息，不可撤回；取消 paper 底 / 确认 primary 描边），确认后再 `peekMyPhone`。
7. **日历 → 赴约** `app/apps/calendar.tsx`：来自 `outingPlans` 的条目右侧「纪念」换成 primary「赴约 ›」→ `/outing/[placeId]`。
8. **外出：约定只表达一次** `app/apps/outing.tsx`：删约定列表；天气条下方一条约定条（白卡描边 r6，28 头像，「今晚 20:30 · 街角咖啡馆 · 和沈之言」13/500 + primary「赴约 ›」），按时间排最多 2 条，其余折叠「还有 n 个约定」；地点卡角标保留；取消约定改长按约定条。
9. **设置：槽位超额** `app/apps/settings.tsx`：`bonds.length > slotLimit(plan)` 时数值 accent 色，下加一行 accent 11「超出的羁绊不会消失，但不能再新增」。
10. **通话挂断键 / 日历圆点 / 锁屏底色**：去掉 palette 外的红、橙、蓝、渐变，见各屏说明。

## State Management（新增）
- `store.unmarkDatingPass(id)`；`swipedIds` 撤销
- `bond.hintPlusSeen: boolean`
- 桌面翻页只需派生：`slotsPerPage = rows × 4`，无新持久化字段
- 锁屏内回复：订阅当前 bond 最新 him 消息，`askedAt` 时间戳之后的才显示

## Assets
- MingCute 图标：全部来自 `components/mingcute.tsx`（chat / phoneSimple / close / heart / contacts / album / calendar / location / magicHat / settings / notebook / phoneEye / pic / mic / emoji）。设计稿另用了 plus / pencil / lock / cloud 四个简单图标，需在 mingcute.tsx 里补对应 MingCute filled 路径（add_line → add_fill、edit_fill、lock_fill、cloud_fill）
- 聊天壁纸与菱格 SVG：见 HTML 内联 data URI
- 无位图

## Files
- `Everylove Paper UI.html` — 27 屏 + 标注（自包含）
- `Everylove Design System.html` — 设计系统说明页（色彩 / 字体 / 形状 / 图案 / 组件 / 间距 / 原则）
- 代码库对应：`constants/design.ts`、`constants/theme.ts`（THEMES.paper）、`components/card.tsx`

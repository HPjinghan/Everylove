# 发包手册（TestFlight / Expo Go 试装）

两条分发通道（D-059 / D-087）：

| 通道 | 给谁 | 命令 | 渠道 |
|---|---|---|---|
| Expo Go 试装 | 朋友，免安装包 | `npx eas-cli update --channel preview --message "..."` | `preview` |
| TestFlight | 正式测试 | `eas build` → `eas submit`（下文） | `production` |

所有命令在项目根目录跑；`eas-cli` 不用全局装，`npx eas-cli@latest ...` 即可。

## 0. 前置条件（一次性）

- **Apple Developer Program** 已付费并生效（TestFlight 的硬门槛）。
- Expo 账号在 `harperzs-team` 组织里：`npx eas-cli login`，`npx eas-cli whoami` 确认。
- **EAS 环境变量（production）**——只放 Supabase 公开配置，**不放任何 AI key**（分发包 AI 走服务端代理）：

  ```powershell
  npx eas-cli env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
  npx eas-cli env:create --environment production --scope project --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ...
  ```

  （语音音色 `EXPO_PUBLIC_SPEECH_TTS_VOICE_*`、`EXPO_PUBLIC_BAIDU_TTS_PER` 等按需同法添加。`.env.local` 不会被上传。）
- **Supabase → Authentication → Providers → Apple → Client IDs** 追加 `com.kotoko.everylove`（逗号分隔，保留 `host.exp.Exponent` 给 Expo Go）。不加的话正式包里 Apple 登录会报 audience 不匹配。

## 0.5 已完成的一次性配置（2026-09-04 首次发包记录）

- **Apple Team = 公司的第二个组织账号**（同事的 App 所在的那个；第一个组织账号里 Admin 也看不到它，因为不是同一个 Team）。第一次 build 误用了第一个 Team，App ID 已从那边删除、在第二个 Team 重新登记；EAS 里第一个 Team 的旧证书未删（无害）。
- EAS 已存：第二个 Team 的 Distribution Certificate + Provisioning Profile、**App Store Connect API Key**（以后 submit 不再登录 Apple）。推送密钥**没有生成**（本机通知用不着，做远程推送时 `eas credentials` 补，不用重新 build）。
- App Store Connect 的 App 记录是**手动建的**（名称「全自动恋爱」、SKU `everylove`），**用户访问权限 = 限制访问**——只有名单里的人和 管理/财务/报告 职能能看到。
- EAS production 环境变量：`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`；Supabase Apple provider 的 Client IDs 已加 `com.kotoko.everylove`。
- Supabase Auth 已开 **Anonymous sign-ins**（D-088）：分发包没本地 key，游客靠匿名会话走服务端代理；关掉它 = 没登录的人聊不了。
- 出口合规已在 app.json 预答（`ITSAppUsesNonExemptEncryption=false`），TestFlight 里不会再弹「缺少合规证明」。

## 1. 构建（每次发包）

```powershell
npx eas-cli build -p ios --profile production
```

首次会交互式问：
- 登录 Apple ID（开发者账号，走 2FA）、选 Team；
- 是否让 EAS 生成 **Distribution Certificate** 与 **Provisioning Profile** → 都选是（EAS 托管，同时把 Sign in with Apple 能力同步到 App ID）；
- 是否配置 **Push Notifications key** → 现在可以跳过（试装只用本地通知）。

之后在云端排队构建，10~25 分钟；进度看终端或 expo.dev 的 Builds 页。构建号由 EAS 远程自增，不用手改。

## 2. 提交到 TestFlight

```powershell
npx eas-cli submit -p ios --latest --profile production
```

首次会问 Apple 登录并**代建 App Store Connect 的 App 记录**（名字可先用「全自动恋爱」，正式名定了再改；bundle id 必须是 `com.kotoko.everylove`）。想一步到位可在 build 时加 `--auto-submit`。

上传后 App Store Connect → **TestFlight** 等处理（10~30 分钟）：
- **内部测试**：App Store Connect 团队成员（最多 100 人）加进内部群组即可装，不用审核；
- **外部测试**：建外部群组 → 开「公开链接」发人；**第一个 build 要过 Beta App Review**（通常一天内），之后同版本号的新 build 一般免审。
- 装包的人手机装 **TestFlight** App，点链接/接受邀请即可。Build 有效期 90 天。

## 3. 之后改动怎么发

- **只改了 JS / 文案 / 资源**：热更，TestFlight 包下次冷启动拿到（第一次打开后台下载、第二次打开生效）。**打包时不能带 AI key**（`expo export` 默认会读 `.env.local`），所以用 `EXPO_NO_DOTENV=1` 跳过 env 文件、只把 Supabase 公开配置手工传入，导出后 grep 校验再发布。PowerShell（项目根目录）：

  ```powershell
  $lines = Get-Content .env.local
  $env:EXPO_NO_DOTENV = '1'
  $env:EXPO_PUBLIC_SUPABASE_URL = (($lines | ? { $_ -match '^EXPO_PUBLIC_SUPABASE_URL=' }) -replace '^[^=]+=','').Trim('"')
  $env:EXPO_PUBLIC_SUPABASE_ANON_KEY = (($lines | ? { $_ -match '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' }) -replace '^[^=]+=','').Trim('"')
  npx expo export --platform ios --max-workers 4
  Select-String -Path dist_expostaticjsios* -Pattern 'bce-v3|sk-ant-' -List   # 有输出 = 泄漏，别发
  npx eas-cli@latest update --channel production --platform ios --skip-bundler --non-interactive --message "..."
  ```

  Expo Go 朋友那条同理，`--channel production` 换成 `--channel preview`。导出如果在 90% 左右报 worker 被 SIGTERM，多半是机器上还挂着别的 node 进程（如没退出的 vitest），杀掉再跑。

- **动了 `app.json` 插件、原生依赖（新的 expo-* 原生模块、react-native-maps 之类）、SDK**：必须重新 `build` + `submit`，**不要**只推 update（runtimeVersion 用的是 sdkVersion 策略，同 runtime 的旧包会拿到不兼容的 JS）。
- 朋友的 Expo Go 试装照旧 `--channel preview`，两个渠道互不影响。

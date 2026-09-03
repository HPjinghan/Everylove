# 发包手册（TestFlight / Expo Go 试装）

两条分发通道（D-059 / D-085）：

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
- **Supabase → Authentication → Providers → Apple → Client IDs** 追加 `com.harperz.everylove`（逗号分隔，保留 `host.exp.Exponent` 给 Expo Go）。不加的话正式包里 Apple 登录会报 audience 不匹配。

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

首次会问 Apple 登录并**代建 App Store Connect 的 App 记录**（名字可先用「全自动恋爱」，正式名定了再改；bundle id 必须是 `com.harperz.everylove`）。想一步到位可在 build 时加 `--auto-submit`。

上传后 App Store Connect → **TestFlight** 等处理（10~30 分钟）：
- **内部测试**：App Store Connect 团队成员（最多 100 人）加进内部群组即可装，不用审核；
- **外部测试**：建外部群组 → 开「公开链接」发人；**第一个 build 要过 Beta App Review**（通常一天内），之后同版本号的新 build 一般免审。
- 装包的人手机装 **TestFlight** App，点链接/接受邀请即可。Build 有效期 90 天。

## 3. 之后改动怎么发

- **只改了 JS / 文案 / 资源**：`npx eas-cli update --channel production --message "..."`，TestFlight 包下次冷启动拿到。
- **动了 `app.json` 插件、原生依赖（新的 expo-* 原生模块、react-native-maps 之类）、SDK**：必须重新 `build` + `submit`，**不要**只推 update（runtimeVersion 用的是 sdkVersion 策略，同 runtime 的旧包会拿到不兼容的 JS）。
- 朋友的 Expo Go 试装照旧 `--channel preview`，两个渠道互不影响。

# design/

Claude Design 的产物，供工程改界面时对照。不进构建（Metro 只打包被 import 的文件）。

- `design-system.page.html` — 「Everylove - Design System」的页面源码（从 Claude Design 导出的 bundle 里解出的 `__bundler/template`），三页：色彩 / 字体 / 形状描边阴影 / 表面图案 / 组件 / 间距 / 原则。**这是设计规格的原文。**
- `Everylove Design System.html` — Claude Design 的原始导出（4.6 MB，含查看器运行时），不进 git；要看原样在浏览器里打开即可。

映射进工程的位置（D-083）：

- 色彩 → `constants/theme.ts` 的 `THEMES.paper`（新装机默认主题）
- 形状 / 字号 / 间距 / 图案 / 原则 → `constants/design.ts`
- 界面逐屏按设计稿重做时，以这两个文件为 token 来源，不再回头翻 HTML。

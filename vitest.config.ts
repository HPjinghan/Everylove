/**
 * 单元测试（D-086）：只测纯逻辑——prompt 装配（快照）、回合管线、注册表、引擎工具函数。
 * 不跑 React Native：涉及 expo / react-native 的模块在测试里用 vi.mock 替换（见 tests/setup.ts）。
 * 跑法：npm test（vitest run）；改 prompt 后快照不一致 = 你改到了模型看到的东西，确认无误再 `npx vitest -u`。
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});

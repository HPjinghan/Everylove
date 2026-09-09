// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .expo 是生成物；supabase/functions 是 Deno（npm: 说明符），不走 Node 解析
    ignores: ['dist/*', '.expo/*', 'supabase/functions/**'],
  },
]);

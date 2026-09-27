#!/usr/bin/env node
/**
 * 热更（D-183）：`npm run update:production -- "message"` / `npm run update:preview -- "message"`
 * 1. 工作区必须干净（expo export 打的是磁盘，不是 HEAD；脏了到 worktree 里发，见 docs/RELEASE.md）；
 * 2. 只带 Supabase 公开配置导出（EXPO_NO_DOTENV=1，其余 EXPO_PUBLIC_* 一律不进环境）；
 * 3. 扫 dist 里有没有 .env.local 的任何一个 key 值、或 sk-ant- / bce-v3 这类前缀——有就中止，不发；
 * 4. eas update --skip-bundler 发这份 dist。
 * 传 --dirty 跳过第 1 步（自担风险）。
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dirtyOk = args.includes('--dirty');
const rest = args.filter((a) => a !== '--dirty');
const channel = rest[0] ?? 'production';
const message = rest.slice(1).join(' ') || `update ${new Date().toISOString().slice(0, 16)}`;
const KEEP = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

const sh = (cmd, env = process.env) => execSync(cmd, { stdio: 'inherit', env, shell: true });
const out = (cmd) => execSync(cmd, { encoding: 'utf8', shell: true });

/* 1. 工作区干净 */
const status = out('git status --porcelain').trim();
if (status && !dirtyOk) {
  console.error('工作区不干净，expo export 打的是磁盘不是 HEAD：先提交 / 收起，或到 worktree 里发（docs/RELEASE.md §3）。要硬发加 --dirty。\n' + status);
  process.exit(1);
}

/* 2. 读 .env.local：公开配置带上，其余的值记下来当作要扫的秘密 */
const dotenv = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const kv = {};
for (const line of dotenv.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) kv[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const env = { ...process.env, EXPO_NO_DOTENV: '1' };
for (const k of Object.keys(env)) if (k.startsWith('EXPO_PUBLIC_') && !KEEP.includes(k)) delete env[k];
for (const k of KEEP) if (kv[k]) env[k] = kv[k];
const secrets = Object.entries(kv)
  .filter(([k, v]) => !KEEP.includes(k) && v.length >= 12)
  .map(([k, v]) => ({ name: k, value: v }));
const PATTERNS = [/sk-ant-[A-Za-z0-9_-]{8,}/, /bce-v3\/[A-Za-z0-9_\/-]{8,}/];

/* 3. 导出 */
sh('npx expo export --platform ios --max-workers 4', env);

/* 4. 扫 dist：任何一个 key 值或前缀出现 = 泄漏 */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(hbc|js|json|map)$/.test(name)) files.push(p);
  }
};
walk('dist');
let leaked = false;
for (const f of files) {
  const text = readFileSync(f, 'latin1');
  for (const s of secrets) if (text.includes(s.value)) { console.error(`泄漏：${f} 里有 ${s.name} 的值`); leaked = true; }
  for (const re of PATTERNS) if (re.test(text)) { console.error(`泄漏：${f} 匹配 ${re}`); leaked = true; }
}
if (leaked) {
  console.error('dist 里有上游 key，不发。');
  process.exit(1);
}
console.log(`dist 干净（扫了 ${files.length} 个文件、${secrets.length} 个值）。`);

/* 5. 发布 */
sh(`npx eas-cli@latest update --channel ${channel} --environment ${channel} --platform ios --skip-bundler --non-interactive --message "${message.replace(/"/g, "'")}"`, env);

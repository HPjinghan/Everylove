/**
 * 拉 ElevenLabs 官方默认声线的候选清单（D-241）：
 *   node ./scripts/eleven-voices.mjs [--out scripts/out/eleven-voices.json]
 * 只取 category = premade（官方默认声线；声库里的社区声线是真人克隆、作者随时能撤，一把不收），
 * 每把带试听样音地址、标签（性别 / 年龄 / 口音 / 用途）与描述。
 * **只写候选清单，不改 content/voices.ts**——音色池按恋爱类型人工定（听样音、看描述），定好再手改那份文件。
 * key 从环境变量 ELEVENLABS_API_KEY 拿，没有就读 .env.local 里的 EXPO_PUBLIC_ELEVENLABS_API_KEY（npm run eleven-voices 直接可用）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function envLocal(name) {
  if (!existsSync('.env.local')) return '';
  const m = readFileSync('.env.local', 'utf8').match(new RegExp('^' + name + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const KEY = process.env.ELEVENLABS_API_KEY || process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || envLocal('EXPO_PUBLIC_ELEVENLABS_API_KEY');
if (!KEY) {
  console.error('缺 ELEVENLABS_API_KEY');
  process.exit(1);
}
const args = process.argv.slice(2);
const i = args.indexOf('--out');
const OUT = i >= 0 ? args[i + 1] : 'scripts/out/eleven-voices.json';

const all = [];
let token = '';
for (let page = 0; page < 20; page++) {
  const q = new URLSearchParams({ category: 'premade', page_size: '100' });
  if (token) q.set('next_page_token', token);
  const r = await fetch(`https://api.elevenlabs.io/v2/voices?${q}`, { headers: { 'xi-api-key': KEY } });
  if (!r.ok) throw new Error(`list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  all.push(...(data.voices ?? []));
  if (!data.has_more || !data.next_page_token) break;
  token = data.next_page_token;
}

const rows = all.map((v) => ({
  id: v.voice_id,
  name: v.name,
  labels: v.labels ?? {},
  description: v.description ?? '',
  sample: v.preview_url ?? '',
  languages: (v.verified_languages ?? []).map((l) => l.language),
}));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`${rows.length} 把官方默认声线 → ${OUT}`);
for (const r of rows) console.log(`${r.id}  ${r.name.padEnd(12)} ${[r.labels.gender, r.labels.age, r.labels.accent, r.labels.descriptive ?? r.labels.description, r.labels.use_case].filter(Boolean).join(' · ')}`);

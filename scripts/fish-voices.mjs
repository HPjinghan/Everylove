/**
 * 拉 Fish Audio 官方声线的候选清单（D-139 / D-230）：
 *   node ./scripts/fish-voices.mjs [--langs zh,en,ja,ko] [--out scripts/out/fish-official-voices.json]
 * 只取作者 = Fish Official 的公开 tts 声线（社区声线大量克隆真人 / IP，红线 1，一把不收），
 * 每把带试听样音地址、Fish 的描述与标签、使用量；童声 / 青少年 / 老人 / 粤语的直接筛掉。
 * **只写候选清单，不改 content/voices.ts**——音色池按恋爱类型人工定（听样音、看描述），定好再手改那份文件。
 * key 从环境变量 FISH_API_KEY 拿，没有就读 .env.local 里的 EXPO_PUBLIC_FISH_API_KEY（npm run fish-voices 直接可用）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function envLocal(name) {
  if (!existsSync('.env.local')) return '';
  const m = readFileSync('.env.local', 'utf8').match(new RegExp('^' + name + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const KEY = process.env.FISH_API_KEY || process.env.EXPO_PUBLIC_FISH_API_KEY || envLocal('EXPO_PUBLIC_FISH_API_KEY');
if (!KEY) {
  console.error('缺 FISH_API_KEY');
  process.exit(1);
}
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const LANGS = opt('langs', 'zh,en,ja,ko').split(',');
const OUT = opt('out', 'scripts/out/fish-official-voices.json');

/** Fish 官方账号（Fish Official）的作者 id */
const FISH_OFFICIAL = 'd8b0991f96b44e489422ca2ddf0bd31d';
/** 不收：童声、青少年、老人、粤语（念普通话会带粤语腔） */
const SKIP = /\b(child|teen|old|cantonese|yue-hk)\b/i;

const all = [];
for (let page = 1; page <= 20; page++) {
  const q = new URLSearchParams({ page_size: '100', page_number: String(page), author_id: FISH_OFFICIAL });
  const r = await fetch(`https://api.fish.audio/model?${q}`, { headers: { authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  all.push(...(data.items ?? []));
  if (!data.has_more) break;
}

const rows = all
  .filter((m) => m.type === 'tts' && m.visibility === 'public' && m.state === 'trained' && !m.dmca_taken_down)
  .map((m) => ({
    id: m._id,
    title: m.title,
    lang: LANGS.find((l) => m.languages?.includes(l)),
    tags: m.tags ?? [],
    description: m.description ?? '',
    sample: m.samples?.[0]?.audio ?? '',
    uses: m.task_count ?? 0,
  }))
  .filter((v) => v.lang && !SKIP.test(v.tags.join(' ')));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2));
for (const l of LANGS) console.log(`${l}: ${rows.filter((v) => v.lang === l).length} 把`);
console.log(`写入 ${OUT}。听样音、对照恋爱类型，再手改 content/voices.ts。`);
